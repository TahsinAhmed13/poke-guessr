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
    ws.close(1000, 'No name provided'); 
  }
  if(url.pathname === '/api/host') {
    game_reg.start_game(name, ws); 
  } else if(url.pathname === '/api/join') {
    const id = url.searchParams.get('id'); 
    if(!id) {
      ws.close(1000, 'No id provided'); 
    }
    const game = game_reg.get_game(id); 
    if(!game) {
      ws.close(1000, `Invalid game id ${id}`); 
    }
    if(!game.add_player(name, ws)) {
      ws.close(1000, `Cannot join game ${id}`); 
    }
  } else {
    ws.close(1000, 'Invalid endpoint'); 
  }
}); 

server.listen(port, () => {
  console.log(`Server started on port ${port}`); 
}); 
