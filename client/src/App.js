import { 
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from 'react';
import {
  createBrowserRouter,
  Link,
  RouterProvider,
  useNavigate,
} from 'react-router-dom'; 
import logo from './logo.png'
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
  /* STARTING PHASE */
  const [leaderboard, setLeaderboard] = useState([]); 
  /* PLAYING PHASE */
  const [choices, setChoices] = useState([]); 
  const [dataUrl, setDataUrl] = useState(''); 
  const [count, setCount] = useState(0); 

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
      element: <Play
        choices={choices}
        dataUrl={dataUrl}
        count={count}
        leaderboard={leaderboard}
      />
    },
  ]);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000'); 
    ws.onopen = () => {
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
          case Actions.RESPONDED:
            setCount(res.count); 
            break; 
          case Actions.QUESTION:
            setPhase(Phases.PLAYING); 
            setChoices(res.choices); 
            setDataUrl(res.dataUrl); 
            setCount(0); 
            break; 
          case Actions.ANSWER:
            setLeaderboard(res.leaderboard); 
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
    <BSStack className='home' gap={4}>
      <BSStack className='home-titles' gap={1}>
        <h1>PokéGuessr</h1>
        <h2>Shiny Edition</h2>
      </BSStack>
      <button onClick={() => navigate('/host')}>Host</button>
      <button onClick={() => navigate('/join')}>Join</button>
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
    socket.send(JSON.stringify({ action: Actions.HOST, name }));
  }; 

  return (
    <BSForm method='POST' onSubmit={handleSubmit}>
      <BSStack className='host' gap={4}>
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
      <BSStack className='join' gap={4}>
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
      </BSStack>
    </BSForm>
  ); 
}

function Floor({ players }) {
  return (
    <div className='floor p-2 rounded'>
      <ul className='p-0 m-0'>
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
    <BSStack className='lobby' gap={4}>
      <h1>{id}</h1>
      <Floor players={players}/>
      <button onClick={handleStart} disabled={!socket || !isHost}>Start</button>
      <button onClick={handleLeave} disabled={!socket}>Leave</button>
    </BSStack>
  ); 
}

function Play({ leaderboard, ...roundProps }) {
  const { phase } = useContext(GameContext); 
  const navigate = useNavigate(); 

  useEffect(() => {
    let ignore = false; 
    if(!ignore && phase === Phases.IDLEING) {
      navigate('/'); 
    }
    return () => ignore = true; 
  }, [phase, navigate]); 

  return (
    phase === Phases.STARTING
      ? <Leaderboard leaderboard={leaderboard}/>
      : <Round {...roundProps}/>
  ); 
}

function Round({ choices, dataUrl, count }) {
  const size = 256; 
  const { socket, errMsg } = useContext(GameContext); 
  const canvasRef = useRef(null); 
  const [choice, setChoice] = useState(0); 

  useEffect(() => {
    const img = new Image(); 
    const handleImageLoad = () => {
      const canvas = canvasRef.current; 
      const context = canvas.getContext('2d', { willReadFrequently: true }); 
      context.drawImage(img, 0, 0, size, size); 
    };
    img.src = dataUrl; 
    img.addEventListener('load', handleImageLoad); 
    return () => img.removeEventListener('load', handleImageLoad); 
  }, [dataUrl]); 

  const handleRespond = (choice) => {
    socket.send(JSON.stringify({ action: Actions.RESPOND, choice })); 
    setChoice(choice); 
  }; 

  return (
    <div>
      <canvas width={size} height={size} ref={canvasRef}>
      </canvas>
      <div>
        {choices.map((species, index) => 
          <div key={species}>
            <button onClick={handleRespond.bind(null, index+1)} disabled={!socket || choice}>
              {species}
            </button>
          </div>
        )}
      </div>
      <p>{count}</p>
      <p style={{color: 'tomato'}}>{errMsg}</p>
    </div>
  );
}

function Leaderboard({ leaderboard }) {
  const { socket, errMsg } = useContext(GameContext); 
  const [ready, setReady] = useState(false); 
  
  const handleReady = () => {
    socket.send(JSON.stringify({ action: Actions.READY })); 
    setReady(true); 
  }; 

  return (
    <div>
      <ol>
        {leaderboard.map(({ name, score, streak }) => 
          <li key={name}>{`${name}\t${score}\t${streak}`}</li> 
        )}
      </ol>
      <button onClick={handleReady} disabled={!socket || ready}>Ready</button> 
      <p style={{color: 'tomato'}}>{errMsg}</p>
    </div>
  ); 
}