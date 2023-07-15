import { Buffer } from 'node:buffer'; 
import fetch from "node-fetch";

const imgDbUrl = 'https://img.pokemondb.net/sprites/home/shiny/2x';

export default class ImgProxyServer {
  async getDataUrl(species) {
    const res = await fetch(imgDbUrl + `/${species}.jpg`); 
    if(res.ok) {
      const buf = Buffer.from(await res.arrayBuffer()); 
      return `data:image/jpeg;base64,${buf.toString('base64')}`; 
    }
    return ''; 
  }
}
