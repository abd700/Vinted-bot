const fs = require('fs');
const path = require('path');

class SearchManager {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.searches = [];
    this.nextId = 1;
    this.load();
  }

  // ─── Persistence ────────────────────────────────────────────────────────────
  load() {
    try {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      if (fs.existsSync(this.dbPath)) {
        const raw = fs.readFileSync(this.dbPath, 'utf8');
        const data = JSON.parse(raw);
        this.searches = data.searches || [];
        this.nextId = data.nextId || (this.searches.length > 0
          ? Math.max(...this.searches.map(s => s.id)) + 1
          : 1);
        console.log(`📂 ${this.searches.length} alerte(s) chargée(s)`);
      }
    } catch (err) {
      console.warn('⚠️ Erreur chargement DB:', err.message);
      this.searches = [];
      this.nextId = 1;
    }
  }

  save() {
    try {
      fs.writeFileSync(
        this.dbPath,
        JSON.stringify({ searches: this.searches, nextId: this.nextId }, null, 2),
        'utf8'
      );
    } catch (err) {
      console.error('❌ Erreur sauvegarde DB:', err.message);
    }
  }

  // ─── CRUD ───────────────────────────────────────────────────────────────────
  add({ query, prixMax, countries, userId, channelId, guildId }) {
    const id = this.nextId++;
    const search = {
      id,
      query,
      prixMax,
      countries: countries || ['fr', 'uk', 'pl'],
      userId,
      channelId,
      guildId,
      paused: false,
      createdAt: new Date().toISOString(),
    };
    this.searches.push(search);
    this.save();
    return id;
  }

  remove(id, userId) {
    const idx = this.searches.findIndex(s => s.id === id && s.userId === userId);
    if (idx === -1) return false;
    this.searches.splice(idx, 1);
    this.save();
    return true;
  }

  togglePause(id, userId) {
    const search = this.searches.find(s => s.id === id && s.userId === userId);
    if (!search) return null;
    search.paused = !search.paused;
    this.save();
    return search.paused;
  }

  getAll() {
    return this.searches;
  }

  getByUser(userId) {
    return this.searches.filter(s => s.userId === userId);
  }
}

module.exports = SearchManager;
