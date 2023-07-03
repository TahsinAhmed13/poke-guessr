import { useState, useRef, useEffect } from 'react';
import { useLoaderData } from 'react-router-dom';
import './root.css'; 

export async function loader({ params }) { 
  if(!params.hasOwnProperty('species')) {
    const url = '/api/species' + (params.hasOwnProperty('gen') ? `?gen=${params.gen}` : ''); 
    const req = await fetch(url); 
    const data = await req.json(); 
    if(data.status === 'OK') {
      params.species = data.species; 
    }
  }
  return params; 
}

export default function Root({ size = 400, step = Number(size * 0.05) }) {
  const [pixelation, setPixelation] = useState(size * 0.1); 
  const bufCanvasRef = useRef(null); 
  const drawCanvasRef = useRef(null); 
  const { species } = useLoaderData(); 

  useEffect(() => {
    const img = new Image(); 
    const handleImageLoad = () => {
      const bufCanvas = bufCanvasRef.current; 
      const bufCtx = bufCanvas.getContext('2d', { willReadFrequently: true }); 
      const drawCanvas = drawCanvasRef.current; 
      bufCtx.clearRect(0, 0, size, size); 
      bufCtx.drawImage(img, 0, 0, size, size); 
      pixelate(drawCanvas, bufCanvas, pixelation); 
    };
    img.src = `/api/sprite?species=${species}`
    img.addEventListener('load', handleImageLoad); 
    return () => img.removeEventListener('load', handleImageLoad); 
  }, [size, pixelation, species]); 

  const markers = []
  for(let i = 0; i <= size; i += step) {
    markers.push(i); 
  }

  return (
    <div className='container'>
      <canvas ref={bufCanvasRef} width={size} height={size} className='buf-canvas'>
      </canvas>
      <canvas ref={drawCanvasRef} width={size} height={size} className='draw-canvas'>
        <h1>{species}</h1>
      </canvas>
      <label htmlFor='pixelation'><i>Pixelation</i></label>
      <div className='slider'>
        <input 
          name='pixelation' 
          type='range' 
          min='1' max={size} 
          list='markers'
          defaultValue={pixelation}
          onChange={e => setPixelation(parseInt(e.target.value))}
        />
        <label htmlFor='pixelation'>{pixelation}</label>
      </div>
      <datalist id='markers'>
        {markers.map(mark => <option key={mark} value={mark} label={mark}></option>)}
      </datalist>
    </div>
  ); 
}

function getAverageColor(data, channels) {
  const pixels = data.length / channels; 
  const color = new Array(channels).fill(0);  
  for(let i = 0; i < data.length; i += channels) {
    for(let j = 0; j < channels; ++j) {
      color[j] += data[i+j]*data[i+j]; 
    }
  }
  for(let i = 0; i < channels; ++i) {
    color[i] = Math.round(Math.sqrt(color[i] / pixels)); 
  }
  return new Uint8ClampedArray(color); 
}

function pixelate(dest, src, step) {
  const channels = 4; 
  const destCtx = dest.getContext('2d', { willReadFrequently: true }); 
  const srcCtx = src.getContext('2d', { willReadFrequently: true }); 
  const pixelArray = destCtx.createImageData(src.width, src.height); 
  
  for(let i = 0; i < src.height; i += step) {
    for(let j = 0; j < src.width; j += step) {
      const imgData = srcCtx.getImageData(j, i, step, step); 
      const color = getAverageColor(imgData.data, channels); 
      for(let y = i; y < i+step; ++y) {
        for(let x = j; x < j+step; ++x) {
          const start = channels*(y*src.width+x); 
          for(let k = 0; k < channels; ++k) {
            pixelArray.data[start+k] = color[k]; 
          }
        }
      } 
    }
  }   
  destCtx.clearRect(0, 0, destCtx.width, destCtx.height); 
  destCtx.putImageData(pixelArray, 0, 0); 
}