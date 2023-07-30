import { uptime } from 'node:process';
import { Actions } from "./protocol.js";
import PokePicker from "./picker.js";

const BASE_POINTS_PER_ROUND = 100;

class Player {
  constructor(socket, request) {
    this.closed = false; 
    this.socket = socket; 
    this.request = request;  
    this.score = 0; 
    this.streak = 0;  
    this.socket.on('close', () => {
      this.closed = true; 
      console.log(`[${Math.floor(uptime())}] Close connection from ${request.headers.host}${request.url}`); 
    });
  }

  update(correct) {
    if(correct) {
      this.score += BASE_POINTS_PER_ROUND;
      this.streak++; 
    } else {
      this.streak = 0; 
    }
  }
  
  static get_leaderboard(players) {
    return Array.from(players)
      .map(([name, { score, streak }]) => ({ name, score, streak }))
      .sort((a, b) => {
        if(a.score !== b.score) {
          return b.score - a.score; 
        }
        if(a.streak !== b.streak) {
          return b.streak - a.streak; 
        }
        return a.name.localeCompare(b.name); 
      });
  }
}

class Round {
  constructor(choices, answer, dataUrl, pixelation, players) {
    this.choices = choices; 
    this.answer = answer; 
    this.dataUrl = dataUrl; 
    this.pixelation = pixelation; 
    this.players = players; 
  }

  ready() {
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
      for(const [ name, player ] of this.players.entries()) {
        callbacks[name] = {
          onmessage: ({ data }) => { 
            try {
              const { action } = JSON.parse(data);              
              switch(action) {
                case Actions.READY:
                  responses.add(name); 
                  if(responses.size >= this.players.size) {
                    cleanup(); 
                  }
                  break;
                case Actions.RESPOND:
                  throw new Error('Round has not started yet'); 
              }
            } catch({ message }) {
              player.socket.send(JSON.stringify({
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
        player.socket.addEventListener('message', callbacks[name].onmessage); 
        player.socket.addEventListener('close', callbacks[name].onclose); 
      }  
      this.players.forEach(({ socket }) => 
        socket.send(JSON.stringify({ action: Actions.STARTED })) 
      ); 
    }); 
  }

  run(delay, timeout) {
    return new Promise((resolve) => {
      const results = new Map(); 
      const callbacks = new Map(); 
      let done = false; 
      const cleanup = () => {
        if(!done) {
          done = true; 
          this.players.forEach(({ socket }, name) => {
            socket.removeEventListener('message', callbacks[name].onmessage); 
            socket.removeEventListener('close', callbacks[name].onclose); 
          }); 
          this.players.forEach(({ socket }) => {
            socket.send(JSON.stringify({
              action: Actions.ANSWER,
              answer: this.answer,
              leaderboard: Player.get_leaderboard(this.players)
            }));
          }); 
          resolve(results);
        } 
      }
      for(const [ name, player ] of this.players.entries()) {
        callbacks[name] = {
          onmessage: ({ data }) => { 
            try {
              const { action, choice } = JSON.parse(data);              
              switch(action) {
                case Actions.READY: 
                  throw new Error('Round already started'); 
                case Actions.RESPOND:
                  if(!this.choices[choice-1]) {
                    throw new Error('No choice or choice invalid'); 
                  }
                  if(results.has(name)) {
                    throw new Error('Already responded'); 
                  }
                  results.set(name, this.choices[choice-1]); 
                  player.update(choice === this.answer); 
                  this.players.forEach(({ socket }) => {
                    socket.send(JSON.stringify({
                      action: Actions.RESPONDED,
                      count: results.size 
                    })); 
                  }); 
                  if(results.size >= this.players.size) {
                    cleanup(); 
                  }
                  break; 
              }
            } catch({ message }) {
              player.socket.send(JSON.stringify({
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
        player.socket.addEventListener('message', callbacks[name].onmessage); 
        player.socket.addEventListener('close', callbacks[name].onclose); 
      }
      this.players.forEach(({ socket }) => {
        socket.send(JSON.stringify({
          action: Actions.QUESTION,
          choices: this.choices,
          dataUrl: this.dataUrl,
          pixelation: this.pixelation,
          delay, timeout,
        }));
      });
      if(timeout) {
        setTimeout(cleanup, delay+timeout); 
      }
    }); 
  }
}

class Game {
  constructor(game_reg, id, hostname, hostws, hostreq, options = {}) {
    const {
      gen = 0,
      rounds = 10,
      count = 4,
      pixelation = 0,
      delay = 3000,
      timeout = 0,
    } = options; 
    this.game_reg = game_reg; 
    this.id = id; 
    this.started = false; 
    this.players = new Map(); 
    this.players.set(hostname, new Player(hostws, hostreq));  
    this.picker = new PokePicker(gen); 
    this.rounds = rounds; 
    this.count = count; 
    this.pixelation = pixelation; 
    this.delay = delay; 
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
              throw new Error('Game already started'); 
            }
            break;
          case Actions.CANCEL:
            if(!this.started) {
              this.cancel(); 
            } else {
              throw new Error('Game alreday started'); 
            }
            break; 
          case Actions.READY: 
            if(!this.started) {
              throw new Error('Game has not started yet');  
            }
            break; 
          case Actions.RESPOND: 
            if(!this.started) {
              throw new Error('Game has not started yet'); 
            }
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
    hostws.send(JSON.stringify({
      action: Actions.HOSTED,
      id: this.id,
      players: Array.from(this.players.keys())
    })); 
  } 

  add_player(name, ws, req) {
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
        message: 'Game already started' 
      }));
      return false; 
    }
    this.players.set(name, new Player(ws, req)); 
    this.players.forEach(({ socket }) => { 
      socket.send(JSON.stringify({
        action: Actions.JOINED,
        id: this.id,
        players: Array.from(this.players.keys()) 
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
            throw new Error('Only host can start game'); 
          case Actions.CANCEL:
            throw new Error('Only host can cancel game'); 
          case Actions.READY: 
            if(!this.started) {
              throw new Error('Game has not started yet'); 
            }
            break; 
          case Actions.RESPOND: 
            if(!this.started) {
              throw new Error('Game has not started yet'); 
            }
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
    if(this.players.has(name)) {
      const { closed, socket, request } = this.players.get(name); 
      this.players.delete(name);
      this.players.forEach(({ socket }) => {
        socket.send(JSON.stringify({
          action: Actions.LEFT,
          id: this.id,
          players: Array.from(this.players.keys())
        })); 
      });
      socket.send(JSON.stringify({
        action: Actions.LEFT,
        id: '',
        players: []
      })); 
      if(!closed) {
        socket.removeAllListeners(); 
        this.game_reg.wss.emit('connection', socket, request); 
      }
      if(!this.players.size) {
        this.game_reg.games.delete(this.id); 
      }
    }
  }
  
  async start() {
    this.started = true; 
    this.game_reg.games.delete(this.id); 
    await this.picker.initialize(); 
    for(let i = 0; i < this.rounds; ++i) {
      const choices = this.picker.pick(this.count); 
      const answer = Math.floor(Math.random() * this.count) + 1; 
      const species = choices[answer-1].toLowerCase().replace(' ', '-'); 
      const dataUrl = await this.game_reg.ips.getDataUrl(species); 
      const round = new Round(choices, answer, dataUrl, this.pixelation, this.players); 
      await round.ready(); 
      await round.run(this.delay, this.timeout); 
    } 
    this.players.forEach(({ socket, request }) => {
      socket.send(JSON.stringify({ action: Actions.ENDED }));
      this.game_reg.wss.emit('connection', socket, request); 
    }); 
    this.players.clear();  
  }

  cancel() {
    this.game_reg.games.delete(this.id); 
    this.players.forEach(({ socket, request }) => {
      socket.send(JSON.stringify({ action: Actions.CANCELLED })); 
      this.game_reg.wss.emit('connection', socket, request); 
    }); 
    this.players.clear(); 
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

  new_game(hostname, hostws, hostreq, options = {}) {
    const id = this.gen_game_id(); 
    if(id) {
      this.games.set(id, new Game(this, id, hostname, hostws, hostreq, options)); 
    } else {
      hostws.send(JSON.stringify({
        action: Actions.ERROR,
        message: 'Failed to generate game id'
      })); 
    }
    return id; 
  }
}

