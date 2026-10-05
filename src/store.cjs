const fs = require('node:fs');
const path = require('node:path');
const { emptyState, validateState } = require('./model.cjs');

class Store {
  constructor(file) { this.file = file; this.state = null; }
  load() {
    try { this.state = validateState(JSON.parse(fs.readFileSync(this.file, 'utf8'))); }
    catch (error) {
      if (error.code !== 'ENOENT') throw new Error(`Your saved data could not be opened. It has been left untouched. ${error.message}`);
      this.state = emptyState();
    }
    return this.state;
  }
  save(state) {
    validateState(state);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temporary = `${this.file}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(state, null, 2), { mode: 0o600 });
    fs.renameSync(temporary, this.file);
    this.state = state;
    return state;
  }
}
module.exports = { Store };
