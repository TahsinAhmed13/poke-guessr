class Player {
  constructor(socket) {
    this.socket = socket; 
    this.closed = false; 
  }
}

class Game {
  constructor(game_reg, id, hostname, hostws) {
    this.game_reg = game_reg; 
    this.id = id; 
    this.players = new Map(); 
    this.started = false; 
    const host = this.add_player(hostname, hostws); 
    hostws.on('message', (msg) => {
      if(!this.started) {
        try {
          const { action } = JSON.parse(msg); 
          if(!action) {
            throw new Error('No action specified'); 
          }
          switch(action) {
            case 'start': 
              this.start(); 
              break;
            case 'cancel': 
              this.cancel(); 
              break; 
            default: 
              throw new Error('Invalid action');  
          }
        } catch({ name, message }) {
          if(name === 'SyntaxError') {
            message = 'Failed to parse JSON'; 
          }
          hostws.send(JSON.stringify({
            event: 'error',
            message
          })); 
        }
      }
    }); 
    hostws.on('close', (_, reason) => {
      if(!this.started) {
        this.cancel(); 
      }
    }); 
  } 

  add_player(name, ws) {
    if(this.players.has(name)) {
      ws.close(1007, `Player ${name} already exists`); 
      return null; 
    }
    if(this.started) {
      ws.close(1007, `Game ${this.id} has already started`); 
      return null; 
    }
    const player = new Player(ws); 
    this.players.set(name, player); 
    this.players.forEach(({ socket }) => { 
      socket.send(JSON.stringify({
        event: 'join', 
        name
      })); 
    }); 
    ws.on('close', (_, reason) => {
      player.closed = true; 
      this.remove_player(name, reason); 
    }); 
    return player; 
  }

  remove_player(name, reason) {
    if(!this.players.has(name)) {
      return false; 
    }
    const player = this.players.get(name); 
    if(!player.closed) {
      player.socket.close(1007, reason); 
    }
    this.players.delete(name); 
    this.players.forEach(({ socket }) => {
      socket.send(JSON.stringify({
        event: 'leave',
        name
      })); 
    });
    return true;    
  }
  
  start() {
    this.started = true; 
    for(const player of this.players.values()) {
      player.socket.send(JSON.stringify({ event: 'start' })); 
    }
  }

  cancel() {
    for(const name of this.players.keys()) {
      this.remove_player(name, 'Game has been cancelled'); 
    }
    this.game_reg.games.delete(this.id); 
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

  start_game(hostname, hostws) {
    const id = this.gen_game_id(); 
    if(id) {
      this.games.set(id, new Game(this, id, hostname, hostws)); 
      hostws.send(JSON.stringify({
        event: 'host', 
        id
      })); 
    } else {
      hostws.send(JSON.stringify({
        event: 'error',
        message: 'Failed to generate game id'
      })); 
    }
    return id; 
  }
}

