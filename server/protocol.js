/**
 * Protocol for websocket communications between server and client.
 * All requests and responses are JSON-encoded strings.
 */
export const Actions = Object.freeze({
  /* client to server actions */
  LEAVE: 'leave',
  START: 'start',
  CANCEL: 'cancel',
  /* server to client actions */
  HOSTED: 'hosted',
  JOINED: 'joined',
  LEFT: 'left',
  STARTED: 'started',
  CANCELLED: 'cancelled',
  ERROR: 'error',
}); 