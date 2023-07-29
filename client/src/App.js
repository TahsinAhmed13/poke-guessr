import { 
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
} from 'react';
import {
  createBrowserRouter,
  Link,
  RouterProvider,
  useNavigate,
} from 'react-router-dom'; 
import logo from './assets/logo.png'; 
import frame from './assets/frame.png'; 
import './App.css'; 
import { Actions } from './protocol'; 

import BSForm from 'react-bootstrap/Form';
import BSStack from 'react-bootstrap/Stack'; 
import BSNav from 'react-bootstrap/Nav'; 
import BSNavbar from 'react-bootstrap/Navbar'; 

const Phases = Object.freeze({
  IDLEING: Symbol('IDLEING'),
  WAITING: Symbol('WAITING'),
  STARTING: Symbol('STARTING'),
  PLAYING: Symbol('PLAYING'), 
}); 

const GameContext = createContext();  

export default function App() {
  /* GLOBALS */
  const [socket, setSocket] = useState(null); 
  const [phase, setPhase] = useState(Phases.IDLEING); 
  const [errMsg, setErrMsg] = useState(''); 
  /* WAITING PHASE */
  const [id, setId] = useState(''); 
  const [players, setPlayers] = useState([]); 
  const [isHost, setIsHost] = useState(false); 
  /* PLAYING PHASE */
  const [choices, setChoices] = useState([]); 
  const [dataUrl, setDataUrl] = useState(''); 
  const [pixelation, setPixelation] = useState(1/256); 
  const [delay, setDelay] = useState(3); 
  const [timeout, setTimeout] = useState(-1); 
  const [count, setCount] = useState(0); 
  const [answer, setAnswer] = useState(0); 
  const [leaderboard, setLeaderboard] = useState([]); 
  /* CONSTANTS */
  const revealTime = 3000; 
  const revealInterval = 500; 

  const router = createBrowserRouter([
    {
      path: '/',
      element: (
        <>
          <Navbar/>
          <Home/>
        </>
      ),
    },
    {
      path: '/host',
      element: (
        <>
          <Navbar/>
          <Host/>
        </>
      ),
    },
    {
      path: '/join',
      element: (
        <>
          <Navbar/>
          <Join/>
        </>
      ),
    },
    {
      path: '/lobby',
      element: (
        <>
          <Navbar/>
          <Lobby
            id={id}
            players={players}
            isHost={isHost}
          />
        </>
      ),
    },
    {
      path: '/play',
      element: (
        <>
          <Navbar/>
          <Play
            leaderboard={leaderboard}
            choices={choices}
            dataUrl={dataUrl}
            pixelation={pixelation}
            delay={delay}
            timeout={timeout}
            count={count}
            answer={answer}
          />
        </>
      ),
    },
  ]);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000'); 
    ws.onopen = () => {
      let pixelation = 0; 
      ws.addEventListener('message', ({ data }) => {
        const res = JSON.parse(data); 
        setErrMsg(''); 
        switch(res.action) {
          case Actions.HOSTED:
            setPhase(Phases.WAITING); 
            setId(res.id);  
            setPlayers(res.players);  
            setIsHost(true); 
            break; 
          case Actions.JOINED:
            setPhase(Phases.WAITING); 
            setId(res.id); 
            setPlayers(res.players); 
            break; 
          case Actions.LEFT:
            if(!res.id) {
              setPhase(Phases.IDLEING); 
              setIsHost(false); 
            }
            setId(res.id); 
            setPlayers(res.players); 
            break; 
          case Actions.STARTED:
            setPhase(Phases.STARTING); 
            break; 
          case Actions.CANCELLED:
            setPhase(Phases.IDLEING); 
            setId(''); 
            setPlayers([]); 
            setIsHost(false); 
            break; 
          case Actions.QUESTION:
            setPhase(Phases.PLAYING); 
            setChoices(res.choices); 
            setDataUrl(res.dataUrl); 
            setPixelation(res.pixelation); 
            setDelay(res.delay); 
            setTimeout(res.timeout); 
            setCount(0); 
            setAnswer(0); 
            pixelation = res.pixelation; 
            break; 
          case Actions.RESPONDED:
            setCount(res.count); 
            break; 
          case Actions.ANSWER:
            setAnswer(res.answer); 
            setLeaderboard(res.leaderboard); 
            const delta = pixelation / (revealTime / revealInterval); 
            const intervalId = setInterval(() => {
              pixelation = Math.max(0, pixelation-delta); 
              setPixelation(pixelation); 
              if(!pixelation) {
                clearInterval(intervalId); 
              }
            }, revealInterval); 
            break; 
          case Actions.ENDED:
            setPhase(Phases.IDLEING); 
            setId(''); 
            setPlayers([]); 
            setIsHost(false); 
            break; 
          case Actions.ERROR:
            setErrMsg(res.message); 
            break; 
          default: 
        }
      }); 
    }; 
    setSocket(ws); 
    return () => ws.close();
  }, []); 

  return (
    <GameContext.Provider value={{ socket, phase, errMsg }}>
      <RouterProvider router={router}/>
    </GameContext.Provider>
  ); 
}

function Navbar() {
  const { socket, phase } = useContext(GameContext); 
  
  const confirmNavigation = (event) => {
    if(phase !== Phases.IDLEING) {
      const confirmation = window.confirm('Are you sure you want to leave this game?'); 
      if(confirmation) {
        socket.send(JSON.stringify({ action: Actions.LEAVE })); 
      } else {
        event.preventDefault(); 
      }
    }
  }; 

  return (
    <BSNavbar fixed='top' className='navbar shadow'>
      <BSNavbar.Brand className='ms-3'>
        <Link to='/' onClick={confirmNavigation}>
          <img src={logo} alt='Shiny Charm' width='30'/>
        </Link>
      </BSNavbar.Brand>
      <BSNav className='me-auto'>
        <BSNav.Link>
          <Link to='/host' onClick={confirmNavigation}>Host</Link>
        </BSNav.Link>
        <BSNav.Link>
          <Link to='/join' onClick={confirmNavigation}>Join</Link>
        </BSNav.Link>
      </BSNav>
    </BSNavbar>
  ); 
}

function Home() {
  const navigate = useNavigate(); 

  return (
    <BSStack className='home page' gap={4}>
      <BSStack className='home-titles' gap={1}>
        <h1>PokéGuessr</h1>
        <h2>Shiny Edition</h2>
      </BSStack>
      <button onClick={() => navigate('/host')}>Host</button>
      <button onClick={() => navigate('/join')}>Join</button>
      <div className='footer'></div>
    </BSStack>
  ); 
}

function Host() {
  const { socket , phase, errMsg } = useContext(GameContext); 
  const navigate = useNavigate(); 
  const [waiting, setWaiting] = useState(false); 
  const hostBtnRef = useRef(); 

  useEffect(() => {
    let ignore = false; 
    if(!ignore)  {
      if(phase === Phases.WAITING) {
        setWaiting(false); 
        navigate('/lobby'); 
      } else if(errMsg) {
        setWaiting(false);  
        hostBtnRef.current.setCustomValidity(errMsg); 
        hostBtnRef.current.reportValidity(); 
      }
    }
    return () => ignore = true; 
  }, [phase, errMsg, navigate]); 

  const handleSubmit = (event) => {
    event.preventDefault(); 
    setWaiting(true); 
    const formData = new FormData(event.target); 
    const { name } = Object.fromEntries(formData); 
    socket.send(JSON.stringify({ action: Actions.HOST, name, 
      options: {pixelation: 0.08, timeout: 10000} }));
  }; 

  return (
    <BSForm method='POST' onSubmit={handleSubmit}>
      <BSStack className='host page' gap={4}>
        <h1>Host</h1>
        <input 
          className='px-2'
          type='text' 
          name='name' 
          placeholder='Enter nickname'
          disabled={waiting}
          required
        />
        <input 
          ref={hostBtnRef}
          type='submit' 
          value="Let's go!" 
          disabled={!socket || waiting}
        />
        <div className='footer'></div>
      </BSStack>
    </BSForm>
  ); 
}

function Join() {
  const { socket, phase, errMsg }= useContext(GameContext); 
  const navigate = useNavigate(); 
  const [waiting, setWaiting] = useState(false); 
  const joinBtnRef = useRef(); 

  useEffect(() => {
    let ignore = false; 
    if(!ignore) {
      if(phase === Phases.WAITING) {
        setWaiting(false); 
        navigate('/lobby'); 
      } else if(errMsg) {
        setWaiting(false); 
        joinBtnRef.current.setCustomValidity(errMsg); 
        joinBtnRef.current.reportValidity(); 
      }
    }
    return () => ignore = true; 
  }, [phase, errMsg, navigate]); 

  const handleSubmit = (event) => {
    event.preventDefault(); 
    setWaiting(true); 
    const formData = new FormData(event.target); 
    const { id, name } = Object.fromEntries(formData); 
    socket.send(JSON.stringify({ action: Actions.JOIN, id, name })); 
  };  

  return (
    <BSForm method='POST' onSubmit={handleSubmit}>
      <BSStack className='join page' gap={4}>
        <h1>Join</h1>
        <input 
          className='px-2'
          type='text' 
          name='id' 
          placeholder='Enter game id'
          pattern='^[a-z0-9]{6}$'
          disabled={waiting}
          required
        />
        <input 
          className='px-2'
          type='text' 
          name='name' 
          placeholder='Enter nickname'
          disabled={waiting}
          required
        />
        <input 
          ref={joinBtnRef}
          type='submit' 
          value="Let's go!" 
          disabled={!socket || waiting}
        />
        <div className='footer'></div>
      </BSStack>
    </BSForm>
  ); 
}

function Floor({ players }) {
  return (
    <div className='floor p-2 rounded'>
      <ul className='floor-list'>
        {players.map(name => <li key={name} className='m-2'>{name}</li>)}
      </ul>
    </div>
  ); 
}

function Lobby({ id, players, isHost }) {
  const { socket, phase } = useContext(GameContext); 
  const navigate = useNavigate(); 

  useEffect(() => {
    let ignore = false; 
    if(!ignore) {
      switch(phase) {
        case Phases.IDLEING:
          navigate('/'); 
          break;
        case Phases.STARTING:
          socket.send(JSON.stringify({ action: Actions.READY })); 
          break; 
        case Phases.PLAYING:
          navigate('/play'); 
          break;
        default:
      }
    }
    return () => ignore = true; 
  }, [socket, phase, navigate]); 

  const handleStart = () => {
    socket.send(JSON.stringify({ action: Actions.START })); 
  }; 

  const handleLeave = () => {
    socket.send(JSON.stringify({ action: Actions.LEAVE })); 
  }; 

  return (
    <BSStack className='lobby page' gap={4}>
      <h1>{id}</h1>
      <Floor players={players}/>
      <button onClick={handleStart} disabled={!socket || !isHost}>Start</button>
      <button onClick={handleLeave} disabled={!socket}>Leave</button>
      <div className='footer'></div>
    </BSStack>
  ); 
}

function Play({ leaderboard, ...roundProps }) {
  const { phase } = useContext(GameContext); 
  const navigate = useNavigate(); 
  const [done, setDone] = useState(false); 

  useEffect(() => {
    let ignore = false; 
    if(!ignore) {
      switch(phase) {
        case Phases.IDLEING:
          navigate('/'); 
          break; 
        default:
      }
    }
    return () => ignore = true; 
  }, [phase, navigate]); 

  return (
    done
      ? <Leaderboard setDone={setDone} leaderboard={leaderboard}/>
      : <Round setDone={setDone} {...roundProps}/>
  ); 
}

function Leaderboard({ setDone, leaderboard }) {
  const { socket } = useContext(GameContext); 
  const [ready, setReady] = useState(false); 
  
  const handleReady = () => {
    socket.send(JSON.stringify({ action: Actions.READY })); 
    setDone(false); 
    setReady(true); 
  }; 

  return (
    <BSStack className='leaderboard page'>
      <ol className='leaderboard-list'>
        {leaderboard.map(({ name, score, streak }) => 
          <li key={name}>{`${name}\t${score}\t${streak}`}</li> 
        )}
      </ol>
      <button onClick={handleReady} disabled={!socket || ready}>Ready</button> 
    </BSStack>
  ); 
}

function useCountdown(delay, interval = 1000) {
  delay = Math.max(0, delay); 
  const [countdown, setCountdown] = useState(delay); 
  useEffect(() => {
    let countdown = delay; 
    const intervalId = setInterval(() => {
      countdown = Math.max(0, countdown-interval); 
      setCountdown(countdown); 
      if(!countdown) {
        clearInterval(intervalId);  
      }
    }, interval);
  }, [delay, interval]); 
  return countdown; 
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
  step = Math.max(1, step); 
  const channels = 4; 
  const destCtx = dest.getContext('2d', { willReadFrequently: true }); 
  const srcCtx = src.getContext('2d', { willReadFrequently: true }); 
  const pixelArray = destCtx.createImageData(src.width, src.height); 
  for(let i = 0; i < src.height; i += step) {
    for(let j = 0; j < src.width; j += step) {
      const imgData = srcCtx.getImageData(j, i, step, step); 
      const color = getAverageColor(imgData.data, channels); 
      for(let y = i; y < i+step && y < src.height; ++y) {
        for(let x = j; x < j+step && x < src.width; ++x) {
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

function Round({ setDone, choices, dataUrl, pixelation, delay, timeout, count, answer }) {
  const { socket } = useContext(GameContext); 
  const frameRef = useRef(null);
  const bufCanvasRef = useRef(null); 
  const drawCanvasRef = useRef(null); 
  const [choice, setChoice] = useState(0); 
  const countdown = useCountdown(delay); 
  const timer = useCountdown(delay+timeout, 10); 
  const timerWidth = (timeout && !answer) 
    ? `${Math.min(1,timer/timeout)*100}%` : 0; 

  useEffect(() => {
    if(countdown) {
      return () => {}; 
    }
    const origScreenRect = { x: 63, y: 69, width: 1040, height: 546 }; 
    const frame = frameRef.current; 
    const img = new Image(); 
    
    const handleImageLoad = () => {
      const bufCanvas = bufCanvasRef.current; 
      const bufCtx = bufCanvas.getContext('2d', { willReadFrequently: true }); 
      const drawCanvas = drawCanvasRef.current; 
      const size = bufCanvas.height; 
      const sx = (bufCanvas.width - size) / 2; 
      bufCtx.fillStyle = 'white'; 
      bufCtx.fillRect(0, 0, bufCanvas.width, bufCanvas.height); 
      bufCtx.drawImage(img, sx, 0, size, size); 
      pixelate(drawCanvas, bufCanvas, Math.ceil(size*pixelation)); 
    };

    const handleFrameResize = () => {
      const origFrameRect = { 
        x: 0, y: 0, 
        width: frame.naturalWidth, 
        height: frame.naturalHeight
      }; 
      const frameRect = frame.getBoundingClientRect(); 
      const scale = frameRect.width / origFrameRect.width;  
      const width = origScreenRect.width * scale; 
      const height = origScreenRect.height * scale; 
      const top = origScreenRect.y * scale; 
      bufCanvasRef.current.width = width; 
      bufCanvasRef.current.height = height; 
      drawCanvasRef.current.width = width; 
      drawCanvasRef.current.height = height; 
      drawCanvasRef.current.style.top = `${top}px`;  
      img.removeEventListener('load', handleImageLoad); 
      img.src = dataUrl; 
      img.addEventListener('load', handleImageLoad); 
    }
    
    const handleFrameLoad = () => {
      handleFrameResize(); 
      window.addEventListener('resize', handleFrameResize); 
    }

    if(frame.complete) {
      handleFrameLoad(); 
    } else {
      frame.addEventListener('load', handleFrameLoad); 
    }
    return () => {
      img.removeEventListener('load', handleImageLoad); 
      window.removeEventListener('resize', handleFrameResize); 
      frame.removeEventListener('load', handleFrameLoad); 
    }; 
  }, [dataUrl, pixelation, countdown]); 

  const handleRespond = (choice) => {
    setChoice(choice); 
    socket.send(JSON.stringify({ action: Actions.RESPOND, choice })); 
  }; 

  return (
    countdown
      ? (<BSStack className='countdown page'>
            <h1>{Math.floor(countdown/1000)}</h1>
          </BSStack>)
      : (<>
          <BSStack className='round page' gap={3}>
            <img ref={frameRef} alt='frame' src={frame} className='frame'/>
            <canvas ref={bufCanvasRef} className='buffer-canvas'></canvas>
            <canvas ref={drawCanvasRef} className='draw-canvas'></canvas>
            {pixelation
              ? (<BSStack className='round-choices' gap={4}>
                  {choices.map((species, index) => 
                    <button 
                      key={species}
                      onClick={handleRespond.bind(null, index+1)} 
                      disabled={!socket || choice || (timeout && !timer)}
                    >{species}</button>
                  )}
                </BSStack>)
              : (<BSStack className='round-answer' gap={4}>
                  <h1>{choices[answer-1]}</h1>
                  <button onClick={() => setDone(true)}>Ok, got it!</button>
                </BSStack>)
            }
            <div className='footer'></div>
          </BSStack>
          <div className='timer' style={{width: timerWidth}}></div>
        </>)
  );
}
