# 🛍️ Vinted Discord Bot

Bot Discord de surveillance **Vinted France 🇫🇷 / UK 🇬🇧 / Pologne 🇵🇱**  
Recevez des alertes instantanées avec embed stylisé dès qu'une annonce correspond à vos critères.

---

## ✨ Fonctionnalités

- 🔍 **Surveillance multi-pays** : France, UK, Pologne simultanément
- 🔔 **Alertes en temps réel** avec embed Discord (photo, prix, état, vendeur)
- 💰 **Filtre prix maximum** par alerte
- ⏸️ **Pause / reprise** d'alertes sans les supprimer
- 💾 **Persistance** : les alertes survivent aux redémarrages
- ⚡ **Scan toutes les 30 secondes** (configurable)

---

## 📋 Commandes Slash

| Commande | Description | Exemple |
|----------|-------------|---------|
| `/ajouter` | Créer une alerte | `/ajouter recherche:Nike Air Max 42 prix_max:80 pays:tous` |
| `/mes-alertes` | Voir vos alertes actives | `/mes-alertes` |
| `/supprimer` | Supprimer une alerte | `/supprimer id:3` |
| `/pause` | Pause / reprendre | `/pause id:2` |
| `/statut` | Statut du bot | `/statut` |

---

## 🚀 Installation

### 1. Prérequis
- [Node.js](https://nodejs.org/) version **18 ou supérieure**
- Un compte [Discord Developer](https://discord.com/developers/applications)

### 2. Créer le bot Discord

1. Va sur https://discord.com/developers/applications
2. Clique **New Application** → donne un nom
3. Va dans **Bot** → clique **Add Bot**
4. Clique **Reset Token** → **copie le token** (tu en auras besoin)
5. Sous **Privileged Gateway Intents**, active :
   - ✅ Server Members Intent
   - ✅ Message Content Intent
6. Va dans **OAuth2 > URL Generator** :
   - Coche `bot` + `applications.commands`
   - Permissions bot : `Send Messages`, `Embed Links`, `Read Message History`
   - Copie l'URL générée et ouvre-la pour **inviter le bot** sur ton serveur

### 3. Configurer le projet

```bash
# Cloner / dézipper le projet
cd vinted-discord-bot

# Installer les dépendances
npm install

# Créer le fichier de configuration
cp .env.example .env
```

Édite le fichier `.env` :
```env
DISCORD_TOKEN=TON_TOKEN_ICI
SCAN_INTERVAL=30
```

### 4. Lancer le bot

```bash
npm start
```

Tu devrais voir :
```
🤖 Bot connecté : VintedBot#1234
📡 Enregistrement des commandes slash...
✅ Commandes enregistrées !
🚀 Surveillance démarrée (intervalle: 30s)
```

---

## 📦 Hébergement (pour tourner 24/7)

### Option A — Railway (gratuit / payant)
1. Crée un compte sur [railway.app](https://railway.app)
2. **New Project** → **Deploy from GitHub** (upload ton code)
3. Ajoute la variable `DISCORD_TOKEN` dans **Variables**
4. Le bot tourne en continu ✅

### Option B — VPS (Contabo, OVH, etc.)
```bash
# Installer PM2 pour garder le bot actif
npm install -g pm2
pm2 start src/bot.js --name vinted-bot
pm2 save
pm2 startup
```

### Option C — Render (gratuit)
1. Crée un compte sur [render.com](https://render.com)
2. **New Web Service** → connecte ton repo GitHub
3. **Build Command** : `npm install`
4. **Start Command** : `npm start`
5. Ajoute `DISCORD_TOKEN` dans Environment Variables

---

## 📁 Structure du projet

```
vinted-discord-bot/
├── src/
│   ├── bot.js          # Bot principal + commandes Discord
│   ├── monitor.js      # Surveillance Vinted FR/UK/PL
│   └── searches.js     # Gestion des alertes (CRUD + persistence)
├── data/
│   └── searches.json   # Base de données des alertes (auto-créé)
├── .env.example        # Modèle de configuration
├── package.json
└── README.md
```

---

## ⚠️ Notes importantes

- Ce bot utilise l'API non officielle de Vinted (scraping public)
- L'intervalle minimum recommandé est **30 secondes** pour éviter les blocages
- Les cookies de session sont renouvelés automatiquement
- Vinted peut modifier son API à tout moment

---

## 🛒 Revente du bot

Si tu revends ce bot sur des serveurs Discord :
- Fournis ce README complet à l'acheteur
- Chaque acheteur doit créer **son propre bot Discord** (token unique)
- Le fichier `.env` est **propre à chaque instance**

---

*Made with ❤️ — Vinted Monitor Bot v1.0*
