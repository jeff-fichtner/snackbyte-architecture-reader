/**
 * The one error that stops a run. Its message is everything the person running the reader is told:
 * it names the cause, and the file and position where there is one.
 */
export class StopError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StopError';
  }
}
