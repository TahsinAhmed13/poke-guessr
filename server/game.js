import { Actions } from "./protocol.js";
import PokePicker from "./picker.js";

class Player {
  constructor(name, socket) {
    this.name = name; 
    this.socket = socket; 
    this.closed = false; 
    this.socket.on('close', () => this.closed = true); 
  }
}

class Round {
  constructor(choices, answer, players) {
    this.choices = choices; 
    this.answer = answer; 
    this.players = players; 
  }

  run(timeout) {
    return new Promise((resolve) => {
      const results = new Array(this.players.length).fill('');  
      const callbacks = new Array(this.players.length); 
      const cleanup = () => {
        for(let i = 0; i < this.players.length; ++i) {
          const { socket } = this.players[i]; 
          socket.removeEventListener('message', callbacks[i].onmessage); 
          socket.removeEventListener('message', callbacks[i].onclose); 
        }
        for(let i = 0; i < this.players.length; ++i) {
          const { socket } = this.players[i]; 
          socket.send(JSON.stringify({
            action: Actions.ANSWER,
            answer: this.answer,
            correct: this.choices[this.answer] === results[i] 
          })); 
        } 
        resolve(results); 
      }
      for(const { socket } of this.players) {
        socket.send(JSON.stringify({
          action: Actions.QUESTION,
          choices: this.choices
        }));
      }
      let responses = 0; 
      for(let i = 0; i < this.players.length; ++i) {
        const { name, socket } = this.players[i]; 
        callbacks[i] = {
          onmessage: ({ data }) => { 
            try {
              const { action, selection } = JSON.parse(data);              
              if(action === Actions.RESPOND) {
                if(!selection) {
                  throw new Error('No selection specified'); 
                }
                if(!this.choices[selection]) {
                  throw new Error('Invalid selection'); 
                }
                if(results[i]) {
                  throw new Error('Already responded'); 
                }
                results[i] = this.choices[selection]; 
                responses++; 
                this.players.forEach(({ socket }) => {
                  socket.send(JSON.stringify({
                    action: Actions.RESPONDED,
                    name
                  })); 
                }); 
                if(responses >= this.players.length) {
                  cleanup(); 
                }
              }
            } catch({ message }) {
              socket.send(JSON.stringify({
                action: Actions.ERROR,
                message 
              }));  
            }
          },
          onclose: () => {
            if(!results[i]) {
              responses++; 
              if(responses >= this.players.length) {
                cleanup(); 
              }
            }
          }
        }; 
        socket.addEventListener('message', callbacks[i].onmessage); 
        socket.addEventListener('close', callbacks[i].onclose); 
      }
      if(timeout != Infinity) {
        setTimeout(cleanup, timeout); 
      }
    }); 
  }
}

class Game {
  constructor(game_reg, id, hostname, hostws, options = {}) {
    const {
      gen = 0,
      rounds = 10,
      count = 4,
      timeout = Infinity // ie no timeout
    } = options; 
    this.game_reg = game_reg; 
    this.id = id; 
    this.started = false; 
    this.players = new Map(); 
    this.players.set(hostname, new Player(hostname, hostws));  
    this.gen = gen; 
    this.rounds = rounds; 
    this.count = count; 
    this.timeout = timeout; 
    hostws.on('message', async (msg) => {
      try {
        const { action = Actions.NONE } = JSON.parse(msg); 
        switch(action) {
          case Actions.NONE:
            throw new Error('No action specified'); 
          case Actions.LEAVE:
            if(!this.started) {
              this.cancel(); 
            } else {
              this.remove_player(hostname); 
            }
            break; 
          case Actions.START:
            if(!this.started) {
              await this.start(); 
            } else {
              throw new Error(`Game '${this.id}' already started`); 
            }
            break;
          case Actions.CANCEL:
            if(!this.started) {
              this.cancel(); 
            } else {
              throw new Error(`Game '${this.id}' alreday started`); 
            }
            break; 
          case Actions.RESPOND: 
            break; 
          default: 
            throw new Error(`Action '${action}' not recognized`); 
        }
      } catch({ message }) {
        hostws.send(JSON.stringify({
          action: Actions.ERROR,
          message
        })); 
      }
    });
    hostws.on('close', () => {
      if(!this.started) {
        this.cancel(); 
      } else {
        this.remove_player(hostname); 
      }
    }); 
  } 

  add_player(name, ws) {
    if(this.players.has(name)) {
      ws.send(JSON.stringify({
        action: Actions.ERROR,
        message: `Player '${name}' already exists`
      })); 
      return false; 
    }
    if(this.started) {
      ws.send(JSON.stringify({
        action: Actions.ERROR,
        message: `Game '${this.id}' already started` 
      }));
      return false; 
    }
    this.players.set(name, new Player(name, ws)); 
    this.players.forEach(({ socket }) => { 
      socket.send(JSON.stringify({
        action: Actions.JOINED,
        name 
      }));
    });
    ws.on('message', (msg) => {
      try {
        const { action = Actions.NONE } = JSON.parse(msg); 
        switch(action) {
          case Actions.NONE: 
            throw new Error('No action specified'); 
          case Actions.LEAVE: 
            this.remove_player(name); 
            break;
          case Actions.START:
            throw new Error(`Only host can start game '${this.id}'`); 
          case Actions.CANCEL:
            throw new Error(`Only host can cancel game '${this.id}'`); 
          case Actions.RESPOND: 
            break; 
          default: 
            throw new Error(`Action '${action}' not recognized`);
        }
      } catch({ message }) {
        ws.send(JSON.stringify({
          action: Actions.ERROR,
          message 
        })); 
      }
    }); 
    ws.on('close', this.remove_player.bind(this, name)); 
    return true; 
  }

  remove_player(name) {
    if(!this.players.has(name)) {
      return null; 
    }
    const player = this.players.get(name); 
    this.players.forEach(({ socket }) => {
      socket.send(JSON.stringify({
        action: Actions.LEFT,
        name
      })); 
    });
    this.players.delete(name);
    if(!player.closed) {
      player.socket.removeAllListeners(); 
      this.game_reg.wss.emit('connection', player.socket); 
    } 
    return player; 
  }
  
  async start() {
    this.started = true; 
    for(const player of this.players.values()) {
      player.socket.send(JSON.stringify({
        action: Actions.STARTED
      })); 
    }
    const picker = new PokePicker(); 
    await picker.initialize(this.gen);  
    for(let i = 0; i < this.rounds; ++i) {
      const choices = picker.pick(this.count); 
      const answer = Math.floor(Math.random() * this.count); 
      const round = new Round(choices, answer, Array.from(this.players.values())); 
      await round.run(this.timeout); 
    } 
  }

  cancel() {
    for(const player of this.players.values()) {
      player.socket.send(JSON.stringify({
        action: Actions.CANCELLED
      })); 
    }
    for(const { name } of this.players.values()) {
      this.remove_player(name); 
    }
    this.game_reg.games.delete(this.id); 
  }
}

export default class GameRegistry {
  static ALPHANUM_CHARSET = 'abcdefghijklmnopqrstuvwxyz123456789'; 

  constructor(wss, options = {}) { 
    const {
      charset = GameRegistry.ALPHANUM_CHARSET,
      id_len = 6,
      tries = Infinity
    } = options; 
    this.wss = wss; 
    this.charset = charset; 
    this.id_len = Math.max(1, id_len); 
    this.tries = Math.max(1, tries); 
    this.games = new Map(); 
  }

  get_game(id) {
    return this.games.get(id); 
  }

  gen_game_id() {
    for(let i = 0; i < this.tries; ++i) {
      let id = ''; 
      for(let i = 0; i < this.id_len; ++i) {
        id += this.charset[Math.floor(Math.random() * this.charset.length)];   
      }
      if(!this.games.has(id)) {
        return id; 
      }
    }
    return null; 
  }

  new_game(hostname, hostws, options = {}) {
    const id = this.gen_game_id(); 
    if(id) {
      this.games.set(id, new Game(this, id, hostname, hostws, options)); 
      hostws.send(JSON.stringify({
        action: Actions.HOSTED,
        id
      })); 
    } else {
      hostws.send(JSON.stringify({
        action: Actions.ERROR,
        message: 'Failed to generate game id'
      })); 
    }
    return id; 
  }
}

