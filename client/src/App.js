import { 
  createContext, 
  useState,
  useEffect
} from 'react';
import {
  createBrowserRouter,
  RouterProvider, 
} from 'react-router-dom'; 
import { Actions } from './protocol'; 
import Root from './routes/root';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Root />
  },
]);

export const AppContext = createContext(); 

export default function App() {
  const [socket, setSocket] = useState(null); 
  const [id, setId] = useState(''); 
  const [players, setPlayers] = useState([]); 
  const [errMsg, setErrMsg] = useState(''); 
  
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000'); 
    ws.onopen = () => {
      ws.onmessage = ({ data }) => {
        setErrMsg(''); 
        const { 
          action, 
          id, 
          players,
          message
        } = JSON.parse(data); 
        switch(action) {
          case Actions.HOSTED: 
            setId(id); 
            setPlayers(players); 
            break;
          case Actions.JOINED:
            setId(id); 
            setPlayers(players); 
            break;
          case Actions.LEFT:
            setId(id); 
            setPlayers(players); 
            break; 
          case Actions.ERROR: 
            setErrMsg(message); 
            break; 
          default:
            console.log(`Unexpected action '${action}'`); 
            break; 
        }
      } 
    }
    setSocket(ws); 
    return () => ws.close();
  }, []); 

  return (
    <AppContext.Provider value={{ socket, id, players, errMsg }}>
      <RouterProvider router={router}/>
    </AppContext.Provider>
  ); 
}