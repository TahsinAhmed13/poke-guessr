/**
 * Protocol for websocket communications between server and client.
 * All requests and responses are JSON-encoded strings.
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
  /* server to client actions */
  HOSTED: 'hosted',
  JOINED: 'joined',
  LEFT: 'left',
  STARTED: 'started',
  CANCELLED: 'cancelled',
  RESPONDED: 'responded',
  QUESTION: 'question',
  ANSWER: 'answer',
  ERROR: 'error',
}); 