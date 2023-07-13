import http from 'node:http'; 
import { URL } from 'node:url';
import { WebSocketServer } from 'ws';
import GameRegistry from './game.js';

const port = 8000; 
const server = http.createServer(); 
const wss = new WebSocketServer({ server }); 
const game_reg = new GameRegistry(); 

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `ws://${req.headers.host}/`); 
  const name = url.searchParams.get('name'); 
  if(!name) {
    ws.close(1007, 'No name provided'); 
    return; 
  }
  switch(url.pathname) {
    case '/api/host': 
      if(!game_reg.new_game(name, ws)) {
        ws.close(1007, 'Failed to create new game');   
      }
      break; 
    case '/api/join': 
      const id = url.searchParams.get('id'); 
      if(!id) {
        ws.close(1007, 'No id provided'); 
        return; 
      }
      const game = game_reg.get_game(id); 
      if(!game) {
        ws.close(1007, `Invalid game id ${id}`); 
        return; 
      }
      if(!game.add_player(name, ws)) {
        ws.close(1007, `Failed to join game ${id}`);   
      }
      break;
    default: 
      ws.close(1007, 'Invalid endpoint'); 
  }
}); 

server.listen(port, () => {
  console.log(`Server started on port ${port}`); 
}); 
