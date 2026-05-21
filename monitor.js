const https = require('https');
const http = require('http');

// ─── Vinted country configs ───────────────────────────────────────────────────
const VINTED_CONFIGS = {
  fr: {
    baseUrl: 'www.vinted.fr',
    currency: '€',
    itemUrl: 'https://www.vinted.fr/items',
  },
  uk: {
    baseUrl: 'www.vinted.co.uk',
    currency: '£',
    itemUrl: 'https://www.vinted.co.uk/items',
  },
  pl: {
    baseUrl: 'www.vinted.pl',
    currency: 'zł',
    itemUrl: 'https://www.vinted.pl/items',
  },
};

const CONDITION_MAP = {
  1: 'Neuf avec étiquette',
  2: 'Neuf sans étiquette',
  3: 'Très bon état',
  4: 'Bon état',
  5: 'Satisfaisant',
};

class VintedMonitor {
  constructor(searchManager) {
    this.searchManager = searchManager;
    this.seenItems = new Map(); // key: `${country}_${itemId}` → true
    this.callback = null;
    this.interval = null;
    this.sessionCookies = {}; // country → cookie string
  }

  // ─── Start monitoring loop ──────────────────────────────────────────────────
  start(callback) {
    this.callback = callback;
    const intervalMs = (parseInt(process.env.SCAN_INTERVAL) || 30) * 1000;
    console.log(`🚀 Surveillance démarrée (intervalle: ${intervalMs / 1000}s)`);

    this.scan(); // immediate first scan
    this.interval = setInterval(() => this.scan(), intervalMs);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
  }

  // ─── Main scan loop ─────────────────────────────────────────────────────────
  async scan() {
    const searches = this.searchManager.getAll().filter(s => !s.paused);
    if (searches.length === 0) return;

    console.log(`🔍 Scan de ${searches.length} alerte(s)...`);

    for (const search of searches) {
      for (const country of search.countries) {
        try {
          await this.scanSearch(search, country);
          await this.sleep(1500); // polite delay between requests
        } catch (err) {
          console.error(`❌ Erreur scan ${country}/${search.query}:`, err.message);
        }
      }
    }
  }

  // ─── Scan one search on one country ────────────────────────────────────────
  async scanSearch(search, country) {
    const config = VINTED_CONFIGS[country];
    if (!config) return;

    // Get session cookie if needed
    if (!this.sessionCookies[country]) {
      await this.fetchSessionCookie(country);
    }

    const items = await this.fetchItems(search.query, country, search.prixMax);

    for (const item of items) {
      const key = `${country}_${item.id}`;
      if (this.seenItems.has(key)) continue;

      this.seenItems.set(key, true);

      // Cleanup old seen items (keep last 10,000)
      if (this.seenItems.size > 10000) {
        const firstKey = this.seenItems.keys().next().value;
        this.seenItems.delete(firstKey);
      }

      console.log(`🆕 Nouvel article [${country}]: ${item.title} - ${item.price}${item.currency}`);

      if (this.callback) {
        await this.callback(item, search);
      }
    }
  }

  // ─── Fetch Vinted session cookie ────────────────────────────────────────────
  async fetchSessionCookie(country) {
    const config = VINTED_CONFIGS[country];
    return new Promise((resolve) => {
      const options = {
        hostname: config.baseUrl,
        path: '/',
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        },
      };

      const req = https.request(options, (res) => {
        const cookies = res.headers['set-cookie'];
        if (cookies) {
          this.sessionCookies[country] = cookies
            .map(c => c.split(';')[0])
            .join('; ');
          console.log(`🍪 Cookie obtenu pour ${country}`);
        }
        resolve();
      });

      req.on('error', (err) => {
        console.warn(`⚠️ Impossible d'obtenir le cookie pour ${country}:`, err.message);
        resolve();
      });

      req.setTimeout(10000, () => { req.destroy(); resolve(); });
      req.end();
    });
  }

  // ─── Fetch items from Vinted API ────────────────────────────────────────────
  async fetchItems(query, country, prixMax = null) {
    const config = VINTED_CONFIGS[country];

    const params = new URLSearchParams({
      search_text: query,
      order: 'newest_first',
      per_page: '20',
    });

    if (prixMax) {
      // Convert to local currency approx
      const price = country === 'uk' ? Math.round(prixMax * 0.86) : prixMax;
      params.append('price_to', price.toString());
    }

    const path = `/api/v2/catalog/items?${params.toString()}`;

    return new Promise((resolve) => {
      const options = {
        hostname: config.baseUrl,
        path,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'fr-FR,fr;q=0.9',
          'Referer': `https://${config.baseUrl}/`,
          'Origin': `https://${config.baseUrl}`,
          ...(this.sessionCookies[country] ? { 'Cookie': this.sessionCookies[country] } : {}),
        },
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            if (res.statusCode === 401 || res.statusCode === 403) {
              // Cookie expired, reset
              delete this.sessionCookies[country];
              return resolve([]);
            }

            const json = JSON.parse(data);
            const items = (json.items || []).map(item => this.parseItem(item, country, config));
            resolve(items);
          } catch (e) {
            console.warn(`⚠️ Parse error [${country}]:`, e.message);
            resolve([]);
          }
        });
      });

      req.on('error', (err) => {
        console.warn(`⚠️ Request error [${country}]:`, err.message);
        resolve([]);
      });

      req.setTimeout(15000, () => { req.destroy(); resolve([]); });
      req.end();
    });
  }

  // ─── Parse a Vinted item ────────────────────────────────────────────────────
  parseItem(item, country, config) {
    const photo = item.photos?.[0]?.url || item.photo?.url || null;
    const conditionId = item.status_id || item.condition?.id;

    return {
      id: String(item.id),
      country,
      title: item.title || 'Sans titre',
      price: item.price_numeric || item.price || '?',
      currency: config.currency,
      condition: CONDITION_MAP[conditionId] || item.status || 'Inconnu',
      seller: item.user?.login || 'Inconnu',
      photo,
      url: `${config.itemUrl}/${item.id}`,
      publishedAt: item.created_at_ts
        ? new Date(item.created_at_ts * 1000).toLocaleString('fr-FR')
        : null,
      size: item.size_title || null,
      brand: item.brand_title || null,
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = VintedMonitor;
