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

const WebSocketContext = createContext();  

export default function App() {
  const [socket, setSocket] = useState(null); 
  const [id, setId] = useState(''); 
  const [players, setPlayers] = useState([]); 
  const [isHost, setIsHost] = useState(false); 
  const [started, setStarted] = useState(false); 
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
        started={started}
      />,
    },
    {
      path: '/game',
      element: <Game
        choices={choices}
        dataUrl={dataUrl}
        count={count}
      />
    },
  ]);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000'); 
    ws.onopen = () => {
      ws.addEventListener('message', ({ data }) => {
        const {
          action,
          id,
          players,
          choices,
          dataUrl, 
          count,
        } = JSON.parse(data); 
        switch(action) {
          case Actions.HOSTED:
            setId(id);  
            setPlayers(players);  
            setIsHost(true); 
            setStarted(false); 
            break; 
          case Actions.JOINED:
            setId(id); 
            setPlayers(players); 
            setStarted(false); 
            break; 
          case Actions.LEFT:
            setId(id); 
            setPlayers(players); 
            setIsHost(false); 
            setStarted(false); 
            break; 
          case Actions.STARTED:
            setStarted(true); 
            break; 
          case Actions.CANCELLED:
            setId(''); 
            setPlayers([]); 
            setIsHost(false); 
            setStarted(false); 
            break; 
          case Actions.RESPONDED:
            setCount(count); 
            break; 
          case Actions.QUESTION:
            setChoices(choices); 
            setDataUrl(dataUrl); 
            setStarted(false); 
            setCount(0); 
            break; 
          case Actions.ENDED:
            setId(''); 
            setPlayers([]); 
            setIsHost(false); 
            setStarted(false); 
            break; 
          default: 
            break; 
        }
      }); 
    }; 
    setSocket(ws); 
    return () => ws.close();
  }, []); 

  return (
    <WebSocketContext.Provider value={ socket }>
      <RouterProvider router={router}/>
    </WebSocketContext.Provider>
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
  const socket = useContext(WebSocketContext); 
  const navigate = useNavigate(); 
  const [errMsg, setErrMsg] = useState(''); 

  const handleSubmit = (event) => {
    event.preventDefault(); 
    const formData = new FormData(event.target); 
    const { name } = Object.fromEntries(formData); 
    socket.addEventListener('message', ({ data }) => {
      const { action, message } = JSON.parse(data); 
      if(action === Actions.HOSTED) {
        navigate('/lobby');  
      } else if(action === Actions.ERROR) {
        setErrMsg(message); 
      }
    }, { once: true }); 
    socket.send(JSON.stringify({
      action: Actions.HOST,
      name
    }));
    setErrMsg(''); 
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
  const socket = useContext(WebSocketContext); 
  const navigate = useNavigate(); 
  const [errMsg, setErrMsg] = useState(''); 

  const handleSubmit = (event) => {
    event.preventDefault(); 
    const formData = new FormData(event.target); 
    const { id, name } = Object.fromEntries(formData); 
    socket.addEventListener('message', ({ data }) => {
      const { action, message } = JSON.parse(data); 
      if(action === Actions.JOINED) {
        navigate('/lobby'); 
      } else if(action === Actions.ERROR) {
        setErrMsg(message); 
      } 
    }, { once: true }); 
    socket.send(JSON.stringify({
      action: Actions.JOIN,
      id, name
    })); 
    setErrMsg(''); 
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

function Lobby({ id, players, isHost, started }) {
  const socket = useContext(WebSocketContext); 
  const navigate = useNavigate(); 

  useEffect(() => {
    let ignore = false; 
    if(!ignore && !id) {
      navigate('/'); 
    }
    if(!ignore && started) {
      socket.send(JSON.stringify({ action: Actions.READY })); 
      navigate('/game'); 
    }
    return () => ignore = true; 
  }, [id, started, socket, navigate]); 

  const handleStart = () => {
    socket.send(JSON.stringify({ action: Actions.START })); 
  }; 

  const handleLeave = () => {
    socket.send(JSON.stringify({ action: Actions.LEAVE })); 
  }; 

  return (
    <div>
      <p>{id}</p>
      <ul>{players.map(name => <li key={name}>{name}</li>)}</ul>
      <button onClick={handleStart} disabled={!isHost || !socket}>Start</button><br/>
      <button onClick={handleLeave} disabled={!socket}>Leave</button><br/>
    </div>
  ); 
}

function Game({ choices, dataUrl, count }) {
  const size = 200; 
  const socket = useContext(WebSocketContext); 
  const canvasRef = useRef(null); 

  useEffect(() => {
    const img = new Image(); 
    const handleImageLoad = () => {
      const canvas = canvasRef.current; 
      const ctx = canvas.getContext('2d', { willReadFrequently: true }); 
      ctx.drawImage(img, 0, 0, size, size); 
    };
    img.src = dataUrl; 
    img.addEventListener('load', handleImageLoad); 
    return () => img.removeEventListener('load', handleImageLoad); 
  }, [dataUrl]); 

  const handleRespond = (choice) => {
    socket.send(JSON.stringify({
      action: Actions.RESPOND,
      choice
    })); 
  }; 

  return (
    <div>
      <canvas width={size} height={size} ref={canvasRef}>
      </canvas>
      <div>
        {choices.map((species, index) => 
          <div key={species}>
            <button onClick={handleRespond.bind(null, index)}>{species}</button>
          </div>
        )}
      </div>
      <p>{count}</p>
    </div>
  ); 
}