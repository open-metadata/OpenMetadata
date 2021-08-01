/* eslint no-console: 0 */
/* eslint prefer-rest-params: 0 */
const error = console.error;

console.error = function (message) {
  error.apply(console, arguments); // keep default behaviour

  throw message instanceof Error ? message : new Error(message);
};
