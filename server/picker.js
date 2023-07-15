import * as cheerio from 'cheerio';
import fetch from 'node-fetch';

const dbUrl = 'https://pokemondb.net/pokedex/shiny'; 

export default class PokePicker {
  constructor() {
    this.species = []; 
  }

  async initialize(gen = 0) {
    const html = await fetch(dbUrl).then(req => req.text()); 
    const $ = cheerio.load(html); 
    const genSelector = gen ? `#gen-${gen} + div` : '*'; 
    const infocards = $(genSelector).find('.infocard'); 
    this.species.length = 0; 
    infocards.find('.ent-name').each((_, element) => {
      this.species.push($(element).text()); 
    }); 
  }

  pick(count) {
    const choices = [];
    for(let i = 0; i < count && this.species.length-i-1 >= 0; ++i) {
      const index = Math.floor(Math.random() * (this.species.length-i)); 
      choices.push(this.species[index]); 
      this.species[index] = this.species[this.species.length-i-1]; 
      this.species[this.species.length-i-1] = choices[i];  
    }
    return choices; 
  }
}