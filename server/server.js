import * as cheerio from 'cheerio';
import express from 'express'; 
import fetch from 'node-fetch'; 

const app = express(); 
const port = 8000; 

app.get('/api/species', async (req, res) => {
  const dbUrl = 'https://pokemondb.net/pokedex/shiny'; 
  try {
    const badGen = req.query.hasOwnProperty('gen') 
      && (isNaN(req.query.gen) || parseInt(req.query.gen) < 0); 
    if(badGen) {
      throw new Error('Gen must be a positive integer'); 
    }

    const html = await fetch(dbUrl).then(req => req.text()); 
    const $ = cheerio.load(html); 
    const genSelector = req.query.hasOwnProperty('gen') 
      ? `#gen-${req.query.gen} + div` : '*'; 
    const infocards = $(genSelector).find('.infocard'); 
    const index = Math.floor(Math.random() * infocards.length); 
    const species = infocards.eq(index).find('a').prop('innerText')
      .toLocaleLowerCase().replaceAll(' ', '-');    

    res.status(200)
      .type('json')
      .end(JSON.stringify({
        status: 'OK',
        species
      })); 
  } catch(err) {
    console.log(err); 
    res.status(400)
      .type('json')
      .end(JSON.stringify({
        status: 'FAILED', 
        error: err.message
      }));
  }  
}); 

app.get('/api/sprite', async (req, res) => {
  const baseUrl = 'https://img.pokemondb.net/sprites/home/shiny';
  try {
    if(!req.query.hasOwnProperty('species')) {
      throw new Error('No Pokemon species specified'); 
    }

    const { species } = req.query; 
    const imgUrl = `${baseUrl}/${species.toLowerCase()}.png`; 
    const { ok, body } = await fetch(imgUrl); 

    if(ok) {
      res.status(200).type('png'); 
      body.pipe(res);
    } else {
      throw new Error('The Pokemon species does not exist'); 
    }
  } catch(err) {
    console.log(`URL: ${req.url}`); 
    console.log(err); 
    res.status(400)
      .type('json')
      .end(JSON.stringify({
        error: err.message  
      })); 
  }
}); 
 
app.listen(port, () => 
  console.log(`Server started on port ${port}`)); 
