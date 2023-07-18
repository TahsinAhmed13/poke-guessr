import { useContext, useState } from 'react';
import { Actions } from '../protocol';
import { AppContext } from '../App';

export default function Root() {
  const { 
    socket, 
    id, 
    players, 
    errMsg 
  } = useContext(AppContext); 
  const [name, setName] = useState(''); 
  const [joinId, setJoinId] = useState(''); 
  
  const handleHost = () => {
    socket.send(JSON.stringify({
      action: Actions.HOST,
      name
    }));
  }; 

  const handleJoin = () => {
    socket.send(JSON.stringify({
      action: Actions.JOIN,
      id: joinId,
      name,
    }));
  }

  const handleLeave = () => {
    socket.send(JSON.stringify({
      action: Actions.LEAVE,
    }));
  }

  return (
    <div>
      <div>
        <label htmlFor='name'>Name: </label>
        <input type='text' value={name} onChange={(e) => setName(e.target.value)}/>
        <br />
        <label htmlFor='id'>ID: </label>
        <input type='text' value={joinId} onChange={(e) => setJoinId(e.target.value)}/>
        <br />
        <button onClick={handleHost}>Host</button>
        <br />
        <button onClick={handleJoin}>Join</button>
        <br />
        <button onClick={handleLeave}>Leave</button>
      </div>
      <p style={{color: errMsg ? 'red' : ''}}>{errMsg || 'All good!'}</p> 
      <p style={{fontStyle: id ? 'normal' : 'italic'}}>{id || 'No id'}</p>
      <ul>
        {players.map((name) => <li key={name}>{name}</li>)}
      </ul>
    </div>
  ); 
}