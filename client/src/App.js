import { 
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  useNavigate,
} from 'react-router-dom'; 
import { Actions } from './protocol'; 

const Phases = Object.freeze({
  IDLEING: Symbol('IDLEING'),
  WAITING: Symbol('WAITING'),
  STARTING: Symbol('STARTING'),
  PLAYING: Symbol('PLAYING'), 
}); 

const GameContext = createContext();  

export default function App() {
  const [socket, setSocket] = useState(null); 
  const [phase, setPhase] = useState(Phases.NONE); 
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
      element: <Root/>,
    },
    {
      path: '/host',
      element: <Host/>,
    },
    {
      path: '/join',
      element: <Join/>,
    },
    {
      path: '/lobby',
      element: <Lobby 
        id={id} 
        players={players}
        isHost={isHost} 
      />,
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

function Root() {
  const navigate = useNavigate(); 

  return (
    <div>
      <h1>Poke Guessr</h1>
      <button onClick={() => navigate('/host')}>Host</button><br/>
      <button onClick={() => navigate('/join')}>Join</button><br/>
    </div>
  ); 
}

function Host() {
  const { socket , phase, errMsg } = useContext(GameContext); 
  const navigate = useNavigate(); 

  useEffect(() => {
    let ignore = false; 
    if(!ignore && phase === Phases.WAITING) {
      navigate('/lobby'); 
    }
    return () => ignore = true; 
  }, [phase, navigate]); 

  const handleSubmit = (event) => {
    event.preventDefault(); 
    const formData = new FormData(event.target); 
    const { name } = Object.fromEntries(formData); 
    socket.send(JSON.stringify({ action: Actions.HOST, name }));
  }; 

  return (
    <form method='POST' onSubmit={handleSubmit}>
      <input type='text' name='name' placeholder='Name'></input><br/>
      <input type='submit' value='Enter' disabled={!socket}></input><br/>
      <p style={{color: 'tomato'}}>{errMsg}</p>
    </form>    
  ); 
}

function Join() {
  const { socket, phase, errMsg }= useContext(GameContext); 
  const navigate = useNavigate(); 

  useEffect(() => {
    let ignore = false; 
    if(!ignore && phase === Phases.WAITING) {
      navigate('/lobby'); 
    }
    return () => ignore = true; 
  }, [phase, navigate]); 

  const handleSubmit = (event) => {
    event.preventDefault(); 
    const formData = new FormData(event.target); 
    const { id, name } = Object.fromEntries(formData); 
    socket.send(JSON.stringify({ action: Actions.JOIN, id, name })); 
  };  

  return (
    <form method='POST' onSubmit={handleSubmit}>
      <input type='text' name='id' placeholder='Game ID'></input><br/>
      <input type='text' name='name' placeholder='Name'></input><br/>
      <input type='submit' value='Enter' disabled={!socket}></input><br/>
      <p style={{color: 'tomato'}}>{errMsg}</p>
    </form>
  ); 
}

function Lobby({ id, players, isHost }) {
  const { socket, phase, errMsg }= useContext(GameContext); 
  const navigate = useNavigate(); 
  const [started, setStarted] = useState(false); 

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
    setStarted(true); 
    socket.send(JSON.stringify({ action: Actions.START })); 
  }; 

  const handleLeave = () => {
    socket.send(JSON.stringify({ action: Actions.LEAVE })); 
  }; 

  return (
    <div>
      <p>{id}</p>
      <ul>{players.map(name => <li key={name}>{name}</li>)}</ul>
      <button onClick={handleStart} disabled={!isHost || !socket || started}>Start</button><br/>
      <button onClick={handleLeave} disabled={!socket}>Leave</button><br/>
      <p style={{color: 'tomato'}}>{errMsg}</p>
    </div>
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