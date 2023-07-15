import { Actions } from "./protocol.js";
import PokePicker from "./picker.js";

class Player {
  constructor(socket) {
    this.socket = socket; 
    this.closed = false; 
    this.socket.on('close', () => this.closed = true); 
  }
}

class Round {
  constructor(choices, answer, dataUrl, players) {
    this.choices = choices; 
    this.answer = answer; 
    this.dataUrl = dataUrl; 
    this.players = players; 
  }

  ready(timeout = Infinity) {
    return new Promise((resolve) => {
      const responses = new Set(); 
      const callbacks = new Map(); 
      const cleanup = () => {
        this.players.forEach(({ socket }, name) => {
          socket.removeEventListener('message', callbacks[name].onmessage); 
          socket.removeEventListener('close', callbacks[name].onclose); 
        }); 
        resolve(responses); 
      }
      for(const [ name, { socket } ] of this.players.entries()) {
        callbacks[name] = {
          onmessage: ({ data }) => { 
            try {
              const { action } = JSON.parse(data);              
              if(action === Actions.READY) {
                responses.add(name); 
                if(responses.size >= this.players.size) {
                  cleanup(); 
                }
              }
            } catch({ message }) {
              console.log(message); 
              socket.send(JSON.stringify({
                action: Actions.ERROR,
                message 
              }));  
            }
          },
          onclose: () => {
            responses.delete(name); 
            if(responses.size >= this.players.size) {
              cleanup(); 
            }  
          }
        };
        socket.addEventListener('message', callbacks[name].onmessage); 
        socket.addEventListener('close', callbacks[name].onclose); 
      }  
      if(timeout != Infinity) {
        setTimeout(cleanup, timeout); 
      }
    }); 
  }

  run(timeout = Infinity) {
    return new Promise((resolve) => {
      const results = new Map(); 
      const callbacks = new Map(); 
      const cleanup = () => {
        this.players.forEach(({ socket }, name) => {
          socket.removeEventListener('message', callbacks[name].onmessage); 
          socket.removeEventListener('close', callbacks[name].onclose); 
        }); 
        this.players.forEach(({ socket }, name) => {
          socket.send(JSON.stringify({
            action: Actions.ANSWER,
            answer: this.answer,
            correct: this.choices[this.answer] === results.get(name) 
          }));
        }); 
        resolve(results); 
      }
      for(const [ name, { socket } ] of this.players.entries()) {
        callbacks[name] = {
          onmessage: ({ data }) => { 
            try {
              const { action, selection } = JSON.parse(data);              
              if(action === Actions.RESPOND) {
                if(!this.choices[selection]) {
                  throw new Error('No selection or selection invalid'); 
                }
                if(results.has(name)) {
                  throw new Error('Already responded'); 
                }
                results.set(name, this.choices[selection]); 
                this.players.forEach(({ socket }) => {
                  socket.send(JSON.stringify({
                    action: Actions.RESPONDED,
                    name
                  })); 
                }); 
                if(results.size >= this.players.size) {
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
            results.delete(name); 
            if(results.size >= this.players.size) {
              cleanup(); 
            }  
          }
        }; 
        socket.addEventListener('message', callbacks[name].onmessage); 
        socket.addEventListener('close', callbacks[name].onclose); 
      }
      this.players.forEach(({ socket }) => {
        socket.send(JSON.stringify({
          action: Actions.QUESTION,
          choices: this.choices,
          dataUrl: this.dataUrl 
        }));
      });
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
      timeouts = {}
    } = options; 
    this.game_reg = game_reg; 
    this.id = id; 
    this.started = false; 
    this.players = new Map(); 
    this.players.set(hostname, new Player(hostws));  
    this.picker = new PokePicker(gen); 
    this.rounds = rounds; 
    this.count = count; 
    this.timeouts = {
      ready: Infinity,
      run: Infinity,
      ...timeouts
    }
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
          case Actions.READY: 
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
    this.players.set(name, new Player(ws)); 
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
          case Actions.READY: 
            break; 
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
    this.players.forEach(({ socket }) => {
      socket.send(JSON.stringify({
        action: Actions.STARTED
      }));
    }); 
    await this.picker.initialize(); 
    for(let i = 0; i < this.rounds; ++i) {
      const choices = this.picker.pick(this.count); 
      const answer = Math.floor(Math.random() * this.count); 
      const species = choices[answer].toLowerCase().replace(' ', '-'); 
      const dataUrl = await this.game_reg.ips.getDataUrl(species); 
      const round = new Round(choices, answer, dataUrl, this.players); 
      await round.ready(this.timeouts.ready); 
      await round.run(this.timeouts.run); 
    } 
    this.players.forEach(({ socket }) => {
      socket.send(JSON.stringify({
        action: Actions.ENDED
      }));
    }); 
    const names = Array.from(this.players.keys()); 
    names.forEach((name) => this.remove_player(name)); 
    this.game_reg.games.delete(this.id); 
  }

  cancel() {
    this.players.forEach(({ socket }) => {
      socket.send(JSON.stringify({
        action: Actions.CANCELLED
      }));
    }); 
    const names = Array.from(this.players.keys()); 
    names.forEach((name) => this.remove_player(name)); 
    this.game_reg.games.delete(this.id); 
  }
}

export default class GameRegistry {
  static ALPHANUM_CHARSET = 'abcdefghijklmnopqrstuvwxyz123456789'; 

  constructor(wss, ips, options = {}) { 
    const {
      charset = GameRegistry.ALPHANUM_CHARSET,
      id_len = 6,
      tries = Infinity
    } = options; 
    this.wss = wss; 
    this.ips = ips; 
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

