class Player {
  constructor(socket) {
    this.socket = socket; 
  }
}

class Game {
  constructor(hostname, hostws) {
    this.players = new Map(); 
    this.add_player(hostname, hostws); 
  } 

  add_player(name, ws) {
    if(this.players.has(name)) {
      return false;   
    }
    this.players.set(name, new Player(ws)); 
    ws.on('close', this.remove_player.bind(this, name)); 
    this.players.forEach(({ socket }) => 
      socket.send(`${name} has joined the game`)); 
    return true; 
  }

  remove_player(name) {
    if(!this.players.has(name)) {
      return false; 
    }
    // TODO: figure out if player's socket is open
    this.players.delete(name); 
    this.players.forEach(({ socket }) =>
      socket.send(`${name} has left the game`)); 
    return true;    
  }
}

export default class GameRegistry {
  static ALPHANUM_CHARSET = 'abcdefghijklmnopqrstuvwxyz123456789'; 

  constructor(charset = GameRegistry.ALPHANUM_CHARSET, id_len = 6) {
    this.charset = charset; 
    this.id_len = id_len; 
    this.games = new Map(); 
  }

  gen_game_id() {
    let id;
    do {
      id = ''; 
      for(let i = 0; i < this.id_len; ++i) {
        id += this.charset[Math.floor(Math.random() * this.charset.length)];   
      }
    } while(this.games.has(id)); 
    return id;
  }

  get_game(id) {
    return this.games.get(id); 
  }

  start_game(hostname, hostws) {
    const id = this.gen_game_id(); 
    this.games.set(id, new Game(hostname, hostws)); 
    hostws.send(`${hostname} has started game ${id}`); 
    return id; 
  }
}

