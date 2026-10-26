export class DuplicateCarNameError extends Error {
  constructor() {
    super('A car with this name already exists');
    this.name = 'DuplicateCarNameError';
  }
}
