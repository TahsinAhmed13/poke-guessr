import * as cheerio from 'cheerio';
import fetch from 'node-fetch';

const dbUrl = 'https://pokemondb.net/pokedex/shiny'; 

export default class PokePicker {
  constructor(gen = 0) {
    this.gen = gen; 
    this.species = []; 
    this.imgUrls = []; 
  }

  async initialize() {
    const html = await fetch(dbUrl).then(req => req.text()); 
    const $ = cheerio.load(html); 
    const genSelector = this.gen ? `#gen-${this.gen} + div` : '*'; 
    const infocards = $(genSelector).find('.infocard'); 
    this.species.length = 0; 
    infocards.find('.ent-name').each((_, elem) => {
      this.species.push($(elem).text()); 
    }); 
    this.imgUrls.length = 0; 
    infocards.find('.shinydex-sprite-shiny').each((_, elem) => {
      this.imgUrls.push($(elem).attr('src')); 
    }); 
  }

  pick(count) {
    const choices = [], imgUrls = [];
    for(let i = 0; i < count && this.species.length-i > 0; ++i) {
      const index = Math.floor(Math.random() * (this.species.length-i)); 
      choices.push(this.species[index]); 
      imgUrls.push(this.imgUrls[index]); 
      this.species[index] = this.species[this.species.length-i-1];  
      this.species[this.species.length-i-1] = choices[i];  
      this.imgUrls[index] = this.species[this.imgUrls.length-i-1]; 
      this.imgUrls[this.imgUrls.length-i-1] = imgUrls[i]; 
    }
    return [choices, imgUrls]; 
  }
}