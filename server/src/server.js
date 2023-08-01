import 'dotenv/config'; 
import { WebSocketServer } from 'ws';
import { Actions } from './protocol.js';
import ImgProxyServer from './proxy.js';
import GameRegistry from './game.js';

const PORT = process.env.PORT || 8000; 
const wss = new WebSocketServer({ port: PORT }); 
const ips = new ImgProxyServer(); 
const game_reg = new GameRegistry(wss, ips); 

wss.on('connection', (ws, req) => {
  ws.on('message', (msg) => {
    try {
      const {
        action = Actions.NONE,
        name, 
        id,
        options = {}
      } = JSON.parse(msg); 
      const game = game_reg.get_game(id); 
      switch(action) {
        case Actions.NONE: 
          throw new Error('No action specified'); 
        case Actions.HOST: 
          if(!name) {
            throw new Error('No name specified'); 
          }
          ws.removeAllListeners(); 
          if(!game_reg.new_game(name, ws, req, options)) {
            wss.emit('connection', ws, req);  
          }
          break;
        case Actions.JOIN:
          if(!name) {
            throw new Error('No name specified'); 
          }
          if(!id) {
            throw new Error('No id specified'); 
          }
          if(!game) {
            throw new Error('Invalid game id'); 
          }
          ws.removeAllListeners(); 
          if(!game.add_player(name, ws, req)) {
            wss.emit('connection', ws, req); 
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
