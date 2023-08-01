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
  useRouteError,
} from 'react-router-dom'; 
import logo from './assets/logo.png'; 
import frame from './assets/frame.png'; 
import './App.css'; 
import { Actions } from './protocol'; 

import BSForm from 'react-bootstrap/Form';
import BSStack from 'react-bootstrap/Stack'; 
import BSNav from 'react-bootstrap/Nav'; 
import BSNavbar from 'react-bootstrap/Navbar'; 

import Select from 'react-select'; 

const WSS = process.env.REACT_APP_WSS || 'ws://localhost:8000'; 

const Phases = Object.freeze({
  IDLEING: Symbol('IDLEING'),
  WAITING: Symbol('WAITING'),
  STARTING: Symbol('STARTING'),
  PLAYING: Symbol('PLAYING'), 
  FINISHED: Symbol('FINISHED'),
}); 

const leaveMessage = 'Are you sure you want to leave this game?'; 
const invalidMessage = 'No game in session or disconnected! Returning home.'; 

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
  const [pixelation, setPixelation] = useState(0); 
  const [delay, setDelay] = useState(0); 
  const [timeout, setTimeout] = useState(0); 
  const [answer, setAnswer] = useState(0); 
  const [leaderboard, setLeaderboard] = useState([]); 
  /* CONSTANTS */
  const revealTime = 3000; 
  const revealRate = 500; 

  const router = createBrowserRouter([
    {
      path: '/',
      element: (
        <>
          <Navbar/>
          <Home/>
        </>
      ),
      errorElement: (
        <>
          <Navbar/>
          <ErrorPage/>
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
            choices={choices}
            dataUrl={dataUrl}
            pixelation={pixelation}
            delay={delay}
            timeout={timeout}
            answer={answer}
            leaderboard={leaderboard}
          />
        </>
      ),
    },
  ]);

  useEffect(() => {
    let ws = null; 
    const connect = () => { 
      ws = new WebSocket(WSS); 
      ws.addEventListener('open', () => {
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
              setAnswer(0); 
              pixelation = res.pixelation; 
              break; 
            case Actions.ANSWER:
              setAnswer(res.answer); 
              setLeaderboard(res.leaderboard); 
              const delta = pixelation / (revealTime / revealRate); 
              const intervalId = setInterval(() => {
                pixelation = Math.max(0, pixelation-delta); 
                setPixelation(pixelation); 
                if(!pixelation) {
                  clearInterval(intervalId); 
                }
              }, revealRate); 
              break; 
            case Actions.ENDED:
              setPhase(Phases.FINISHED); 
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
        ws.addEventListener('close', connect); 
        setSocket(ws); 
      }); 
      setSocket(null); 
      setPhase(Phases.IDLEING); 
    }; 
    connect(); 
    return () => {
      ws?.removeEventListener('close', connect); 
      ws?.close(); 
    }; 
  }, []); 
  
  useEffect(() => {
    const handleBeforeUnload = (event) => {
      event.preventDefault();  
      event.returnValue = leaveMessage; 
      return leaveMessage; 
    }; 
    if(id) {
      window.addEventListener('beforeunload', handleBeforeUnload); 
    }
    return () => window.removeEventListener('beforeunload', handleBeforeUnload); 
  }, [id]); 

  useEffect(() => {
    const handlePopState = (event) => {
      const confirmation = window.confirm(leaveMessage); 
      if(confirmation) {
        socket.send(JSON.stringify({ action: Actions.LEAVE })); 
      } else {
        event.preventDefault(); 
      }
    }
    if(id) {
      window.addEventListener('popstate', handlePopState); 
    }
    return () => window.removeEventListener('popstate', handlePopState); 
  }, [socket, id]); 

  return (
    <GameContext.Provider value={{ socket, phase, errMsg }}>
      <RouterProvider router={router}/>
    </GameContext.Provider>
  ); 
}

function Navbar() {
  const { socket, phase } = useContext(GameContext); 
  
  const handleConfirmNavigation = (event) => {
    if(phase !== Phases.IDLEING && phase !== Phases.FINISHED) {
      const confirmation = window.confirm(leaveMessage); 
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
        <Link to='/' onClick={handleConfirmNavigation} replace>
          <img src={logo} alt='Shiny Charm' width='30'/>
        </Link>
      </BSNavbar.Brand>
      <BSNav className='me-auto'>
          <Link 
            to='/host' 
            className='nav-link' 
            onClick={handleConfirmNavigation}
            replace>Host</Link>
          <Link 
            to='/join' 
            className='nav-link' 
            onClick={handleConfirmNavigation}
            replace>Join</Link>
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
      <button onClick={() => navigate('/host', { replace: true })}>Host</button>
      <button onClick={() => navigate('/join', { replace: true })}>Join</button>
      <iframe src={"https://ghbtns.com/github-btn.html?" +
        "user=TahsinAhmed13&repo=poke-guessr&type=star&count=false&size=large"} 
        width="75" height="30" title="GitHub">
      </iframe>
      <div className='footer'></div>
    </BSStack>
  ); 
}

function Host() {
  const { socket , phase, errMsg } = useContext(GameContext); 
  const navigate = useNavigate(); 
  const [waiting, setWaiting] = useState(false); 
  const hostBtnRef = useRef(); 

  const pixelationOptions = [
    { value: 0.03, label: 'Easy' },
    { value: 0.09, label: 'Medium' },
    { value: 0.15, label: 'Hard'},
  ]; 

  const timeoutOptions = [
    { value: 10000, label: 'Slow' },
    { value: 8000, label: 'Normal' },
    { value: 5000, label: 'Fast' }, 
    { value: 0, label: 'Unlimited' },
  ]; 

  const gens = 9; 
  const genOptions = [
    { value: 0, label: 'All Generations' },
    ...Array(gens).fill(0).map((_, gen) => 
      ({ value: gen+1, label: `Generation ${gen+1}` })), 
  ]; 
  
  useEffect(() => {
    let ignore = false; 
    if(!ignore)  {
      if(phase === Phases.WAITING) {
        setWaiting(false); 
        navigate('/lobby', { replace: true }); 
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
    const { name, gen, pixelation, timeout } = Object.fromEntries(formData); 
    socket.send(JSON.stringify({ action: Actions.HOST, name, 
      options: {
        gen: parseInt(gen),
        pixelation: parseFloat(pixelation), 
        timeout: parseInt(timeout)} 
      }
    ));
  }; 

  return (
    <BSForm method='POST' onSubmit={handleSubmit}>
      <BSStack className='host page' gap={4}>
        <h1>Host</h1>
        <Select
          className='host-select'
          classNames={{ menu: () => 'host-option' }}
          name='gen'
          options={genOptions}
          placeholder='Choose generation'
          isSearchable={false}
        />
        <Select 
          className='host-select' 
          classNames={{ menu: () => 'host-option' }}
          name='pixelation' 
          options={pixelationOptions}
          placeholder='Choose difficulty'
          isSearchable={false}
        />
        <Select
          className='host-select'
          classNames={{ menu: () => 'host-option' }}
          name='timeout'
          options={timeoutOptions}
          placeholder='Choose time limit'
          isSearchable={false}
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
        navigate('/lobby', { replace: true }); 
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
          alert(invalidMessage); 
          navigate('/', { replace: true }); 
          break;
        case Phases.STARTING:
          socket.send(JSON.stringify({ action: Actions.READY })); 
          break; 
        case Phases.PLAYING:
          navigate('/play', { replace: true }); 
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
      if(phase === Phases.IDLEING) {
        alert(invalidMessage); 
        navigate('/', { replace: true }); 
      }
    }
    return () => ignore = true; 
  }, [phase, navigate]); 

  return (
    !done
      ? <Round setDone={setDone} {...roundProps}/>
      : <Leaderboard setDone={setDone} leaderboard={leaderboard}/>
  ); 
}

function useCountdown(delay, rate = 10) {
  delay = Math.max(0, delay); 
  const [countdown, setCountdown] = useState(delay); 
  useEffect(() => {
    let countdown = delay; 
    let before = new Date().getTime(); 
    const intervalId = setInterval(() => {
      const now = new Date().getTime(); 
      const delta = now - before; 
      before = now; 
      countdown = Math.max(0, countdown-delta); 
      setCountdown(countdown); 
      if(!countdown) {
        clearInterval(intervalId);  
      }
    }, rate);
  }, [delay, rate]); 
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

function Round({ setDone, choices, dataUrl, pixelation, delay, timeout, answer }) {
  const { socket } = useContext(GameContext); 
  const frameRef = useRef(null);
  const bufCanvasRef = useRef(null); 
  const drawCanvasRef = useRef(null); 
  const [choice, setChoice] = useState(0); 
  const countdown = useCountdown(delay); 
  const timer = useCountdown(delay+timeout); 
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
            <h1>{Math.ceil(countdown/1000)}</h1>
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
                      key={index}
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

function Leaderboard({ setDone, leaderboard }) {
  const { socket, phase } = useContext(GameContext); 
  const navigate = useNavigate(); 
  const [ready, setReady] = useState(false); 
  
  useEffect(() => {
    let ignore = false; 
    if(!ignore) {
      if(phase === Phases.PLAYING) {
        setDone(false); 
      }
    }
    return () => ignore = true;     
  }, [setDone, phase]); 

  const handleNext = () => {
    socket.send(JSON.stringify({ action: Actions.READY })); 
    setReady(true); 
  }; 

  const handlePlayAgain = () => {
    navigate('/', { replace: true }); 
  }

  return (
    <BSStack className='leaderboard page' gap={4}>
      <h1>Leaderboard</h1>
      <BSStack className='leaderboard-list-container'>
        <table className='leaderboard-list'>
          <colgroup>
            <col style={{width: '10%'}}></col>
            <col style={{width: '30%'}}></col>
            <col style={{width: '30%'}}></col>
            <col style={{width: '30%'}}></col>
          </colgroup>
          <thead>
            <tr style={{position: 'sticky', zIndex: 2}}>
              <th>#</th>
              <th>Name</th> 
              <th>Score</th>
              <th>Strk</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map(({ name, score, streak }, index) => 
              <tr key={name}>
                <td>{index+1}</td>
                <td>{name}</td>    
                <td>{score}</td>
                <td>{streak}</td>
              </tr>
            )}
          </tbody>
        </table>
      </BSStack>
      <button 
        disabled={!socket || ready}
        onClick={phase === Phases.STARTING 
          ? handleNext : handlePlayAgain}
      >
        {phase === Phases.STARTING ? 'Next' : 'Play Again'}
      </button> 
      <div className='footer'></div>
    </BSStack>
  ); 
}

function ErrorPage() {
  const error = useRouteError();   

  return (
    <BSStack className='error page'>
      <h1>Oops!</h1>
      <p>Sorry, an unexpected error has occured</p>
      <p><i>{error.statusText || error.message}</i></p>
    </BSStack>
  ); 
}
