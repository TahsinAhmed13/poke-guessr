import http from 'node:http'; 
import { WebSocketServer } from 'ws';
import { Actions } from './protocol.js';
import GameRegistry from './game.js';

const port = 8000; 
const server = http.createServer(); 
const wss = new WebSocketServer({ server }); 
const game_reg = new GameRegistry(wss); 

wss.on('connection', (ws) => {
  ws.on('message', (msg) => {
    try {
      const {
        action = Actions.NONE,
        name, 
        id,
        options = {}
      } = JSON.parse(msg); 
      if(!name) {
        throw new Error('No name specified'); 
      }
      switch(action) {
        case Actions.NONE: 
          throw new Error('No action specified'); 
        case Actions.HOST: 
          ws.removeAllListeners(); 
          if(!game_reg.new_game(name, ws, options)) {
            wss.emit('connection', ws);  
          }
          break;
        case Actions.JOIN:
          if(!id) {
            throw new Error('No id specified'); 
          }
          const game = game_reg.get_game(id); 
          if(!game) {
            throw new Error(`Invalid game id '${id}'`); 
          }
          ws.removeAllListeners(); 
          if(!game.add_player(name, ws)) {
            wss.emit('connection', ws); 
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
}); 

server.listen(port, () => {
  console.log(`Server started on port ${port}`); 
}); 
