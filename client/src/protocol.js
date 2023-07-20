/**
 * Replicated from server. See ../server/protocol.js for original.
 * 
 * Protocol for websocket communications between server and client.
 * All requests and responses are JSON-encoded strings.
 * 
 * Required fields for client actions: 
 * HOST: name: string
 * JOIN: id: string, name: string
 * RESPOND: selection: int
 * 
 * Recieved field from server actions: 
 * HOSTED: id: string, name: string, players: [string]
 * JOINED: id: string, name: string, players: [string]
 * LEFT: id: string, name: string, players: [string]
 * RESPONDED: name: string
 * QUESTION: choices: [string]
 * ANSWER: answer: int, correct: bool, leaderboard: [(string, int)]
 * ENDED: leaderboard: [(string, int)]
 * ERROR: message: string
 */
export const Actions = Object.freeze({
  NONE: 'NONE',
  /* client to server actions */
  HOST: 'HOST',
  JOIN: 'JOIN',
  LEAVE: 'LEAVE',
  START: 'START',
  CANCEL: 'CANCEL',
  RESPOND: 'RESPOND',
  READY: 'READY',
  /* server to client actions */
  HOSTED: 'HOSTED',
  JOINED: 'JOINED',
  LEFT: 'LEFT',
  STARTED: 'STARTED',
  CANCELLED: 'CANCELLED',
  RESPONDED: 'RESPONDED',
  QUESTION: 'QUESTION',
  ANSWER: 'ANSWER',
  ENDED: 'ENDED',
  ERROR: 'ERROR',
}); 
  