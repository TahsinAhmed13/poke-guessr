import { Buffer } from 'node:buffer'; 
import fetch from "node-fetch";

export default class ImgProxyServer {
  async getDataUrl(imgUrl) {
    const res = await fetch(imgUrl); 
    if(res.ok) {
      const buf = Buffer.from(await res.arrayBuffer()); 
      return `data:image/jpeg;base64,${buf.toString('base64')}`; 
    }
    return ''; 
  }
}
