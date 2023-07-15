/**
 * Protocol for websocket communications between server and client.
 * All requests and responses are JSON-encoded strings.
 * 
 * Required fields for client actions: 
 * HOST: name: string
 * JOIN: name: string, id: string
 * RESPOND: selection: int
 * 
 * Recieved field from server actions: 
 * HOSTED: name: string
 * JOINED: name: string
 * LEFT: name: string
 * RESPONDED: name: string
 * QUESTION: choices: [string]
 * ANSWER: answer: int, correct: bool, leaderboard: [(string, int)]
 * ENDED: leaderboard: [(string, int)]
 * ERROR: message: string
 */
export const Actions = Object.freeze({
  NONE: 'none',
  /* client to server actions */
  HOST: 'host',
  JOIN: 'join',
  LEAVE: 'leave',
  START: 'start',
  CANCEL: 'cancel',
  RESPOND: 'respond',
  READY: 'ready',
  /* server to client actions */
  HOSTED: 'hosted',
  JOINED: 'joined',
  LEFT: 'left',
  STARTED: 'started',
  CANCELLED: 'cancelled',
  RESPONDED: 'responded',
  QUESTION: 'question',
  ANSWER: 'answer',
  ENDED: 'ended',
  ERROR: 'error',
}); 