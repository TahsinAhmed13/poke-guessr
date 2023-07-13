import { Actions } from "./protocol.js";

class Player {
  constructor(socket) {
    this.socket = socket; 
    this.closed = false; 
    this.socket.on('close', () => this.closed = true); 
  }

  close(code, reason) {
    if(!this.closed) {
      this.socket.close(code, reason); 
      this.closed = true; 
    }
  }
}

class Game {
  constructor(game_reg, id, hostname, hostws) {
    this.game_reg = game_reg; 
    this.id = id; 
    this.started = false; 
    this.players = new Map(); 
    this.players.set(hostname, new Player(hostws));  
    hostws.on('message', (msg) => {
      try {
        const { action } = JSON.parse(msg); 
        if(!action) {
          throw new Error('No action specified'); 
        }
        switch(action) {
          case Actions.LEAVE:
            this.remove_player(hostname); 
            if(!this.started) {
              this.cancel(); 
            }
            break; 
          case Actions.START:
            this.start(); 
            break;
          case Actions.CANCEL:
            this.cancel(); 
            break; 
          default: 
            throw new Error(`${action} action is not recognized`); 
        }
      } catch({ message }) {
        hostws.send(JSON.stringify({
          action: Actions.ERROR,
          message
        })); 
      }
    });
    hostws.on('close', () => {
      this.remove_player(hostname); 
      if(!this.started) {
        this.cancel(); 
      }
    }); 
  } 

  add_player(name, ws) {
    if(this.players.has(name)) {
      ws.send(JSON.stringify({
        action: Actions.ERROR,
        message: `Player ${name} already exists`
      })); 
      return false; 
    }
    if(this.started) {
      ws.send(JSON.stringify({
        action: Actions.ERROR,
        message: `Game ${this.id} has already started` 
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
        const { action } = JSON.parse(msg); 
        if(!action) {
          throw new Error('No action specified'); 
        }
        switch(action) {
          case Actions.LEAVE: 
            this.remove_player(name); 
            break;
          case Actions.START:
            throw new Error('Only host can start game'); 
          case Actions.CANCEL:
            throw new Error('Only host can cancel game'); 
          default: 
            throw new Error(`${action} action not recognized`); 
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
      return false; 
    }
    this.players.get(name).close(); 
    this.players.delete(name); 
    this.players.forEach(({ socket }) => {
      socket.send(JSON.stringify({
        action: Actions.LEFT,
        name
      })); 
    });
    return true;    
  }
  
  start() {
    this.started = true; 
    for(const player of this.players.values()) {
      player.socket.send(JSON.stringify({
        action: Actions.STARTED
      })); 
    }
  }

  cancel() {
    for(const player of this.players.values()) {
      player.socket.send(JSON.stringify({
        action: Actions.CANCELLED
      })); 
    }
    for(const name of this.players.keys()) {
      this.remove_player(name); 
    }
    this.game_reg.delete_game(this.id); 
  }
}

export default class GameRegistry {
  static ALPHANUM_CHARSET = 'abcdefghijklmnopqrstuvwxyz123456789'; 

  constructor(options = {}) { 
    const {
      charset = GameRegistry.ALPHANUM_CHARSET,
      id_len = 6,
      tries = Infinity
    } = options; 
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

  new_game(hostname, hostws) {
    const id = this.gen_game_id(); 
    if(id) {
      this.games.set(id, new Game(this, id, hostname, hostws)); 
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
  
  delete_game(id) {
    return this.games.delete(id); 
  } 
}

