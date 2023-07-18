import 'dotenv/config.js'
import http from 'node:http'; 
import { WebSocketServer } from 'ws';
import { Actions } from './protocol.js';
import ImgProxyServer from './proxy.js';
import GameRegistry from './game.js';

const port = process.env.SERVER_PORT || 8000; 
const server = http.createServer(); 
const wss = new WebSocketServer({ server }); 
const ips = new ImgProxyServer(); 
const game_reg = new GameRegistry(wss, ips); 

wss.on('connection', (ws, req) => {
  if(req) {
    console.log(`New connection from ${req.url}`); 
  }
  ws.on('close', () => console.log(`Close connection from ${req.url}`)); 
  ws.on('message', (msg) => {
    try {
      const {
        action = Actions.NONE,
        name, 
        id,
        options = {}
      } = JSON.parse(msg); 
      switch(action) {
        case Actions.NONE: 
          throw new Error('No action specified'); 
        case Actions.HOST: 
          if(!name) {
            throw new Error('No name specified'); 
          }
          ws.removeAllListeners(); 
          ws.on('close', () => console.log(`Close connection from ${req.url}`)); 
          if(!game_reg.new_game(name, ws, options)) {
            wss.emit('connection', ws);  
          }
          break;
        case Actions.JOIN:
          if(!name) {
            throw new Error('No name specified'); 
          }
          if(!id) {
            throw new Error('No id specified'); 
          }
          const game = game_reg.get_game(id); 
          if(!game) {
            throw new Error(`Invalid game id '${id}'`); 
          }
          ws.removeAllListeners(); 
          ws.on('close', () => console.log(`Close connection from ${req.url}`)); 
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
