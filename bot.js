const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, Colors } = require('discord.js');
const fs = require('fs');
const path = require('path');
const VintedMonitor = require('./monitor');
const SearchManager = require('./searches');

const DB_PATH = path.join(__dirname, '../data/searches.json');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const searchManager = new SearchManager(DB_PATH);
const monitor = new VintedMonitor(searchManager);

// ─── Slash Commands Definition ───────────────────────────────────────────────
const commands = [
  new SlashCommandBuilder()
    .setName('ajouter')
    .setDescription('Ajouter une alerte Vinted')
    .addStringOption(opt =>
      opt.setName('recherche').setDescription('Ex: Nike Air Max 42').setRequired(true))
    .addNumberOption(opt =>
      opt.setName('prix_max').setDescription('Prix maximum en €').setRequired(false))
    .addStringOption(opt =>
      opt.setName('pays').setDescription('Pays: fr, uk, pl, tous').setRequired(false)
        .addChoices(
          { name: '🇫🇷 France', value: 'fr' },
          { name: '🇬🇧 UK', value: 'uk' },
          { name: '🇵🇱 Pologne', value: 'pl' },
          { name: '🌍 Tous les pays', value: 'tous' },
        )),

  new SlashCommandBuilder()
    .setName('mes-alertes')
    .setDescription('Voir toutes vos alertes actives'),

  new SlashCommandBuilder()
    .setName('supprimer')
    .setDescription('Supprimer une alerte')
    .addIntegerOption(opt =>
      opt.setName('id').setDescription('ID de l\'alerte (voir /mes-alertes)').setRequired(true)),

  new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Mettre en pause / reprendre une alerte')
    .addIntegerOption(opt =>
      opt.setName('id').setDescription('ID de l\'alerte').setRequired(true)),

  new SlashCommandBuilder()
    .setName('statut')
    .setDescription('Voir le statut du bot et les statistiques'),
].map(c => c.toJSON());

// ─── Register Commands ────────────────────────────────────────────────────────
async function registerCommands(token, clientId) {
  const rest = new REST({ version: '10' }).setToken(token);
  try {
    console.log('📡 Enregistrement des commandes slash...');
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log('✅ Commandes enregistrées !');
  } catch (err) {
    console.error('❌ Erreur commandes:', err);
  }
}

// ─── Bot Ready ────────────────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`\n🤖 Bot connecté : ${client.user.tag}`);
  console.log(`📊 Serveurs : ${client.guilds.cache.size}`);
  client.user.setActivity('🔍 Surveillance Vinted FR/UK/PL', { type: 3 });

  await registerCommands(process.env.DISCORD_TOKEN, client.user.id);

  // Démarrer la surveillance
  monitor.start(async (item, search) => {
    await sendAlert(item, search);
  });
});

// ─── Send Alert Embed ─────────────────────────────────────────────────────────
async function sendAlert(item, search) {
  try {
    const channel = await client.channels.fetch(search.channelId);
    if (!channel) return;

    const countryEmoji = { fr: '🇫🇷', uk: '🇬🇧', pl: '🇵🇱' };
    const countryName = { fr: 'France', uk: 'United Kingdom', pl: 'Pologne' };
    const countryColor = { fr: 0x09B1BA, uk: 0x012169, pl: 0xDC143C };

    const embed = new EmbedBuilder()
      .setTitle(`${countryEmoji[item.country] || '🌍'} ${item.title}`)
      .setURL(item.url)
      .setColor(countryColor[item.country] || 0x09B1BA)
      .addFields(
        { name: '💰 Prix', value: `**${item.price}${item.currency}**`, inline: true },
        { name: '📦 État', value: item.condition || 'Non précisé', inline: true },
        { name: '📍 Pays', value: countryName[item.country] || item.country, inline: true },
        { name: '🔍 Alerte', value: `\`${search.query}\``, inline: true },
        { name: '👤 Vendeur', value: item.seller || 'Inconnu', inline: true },
        { name: '⏱️ Publié', value: item.publishedAt || 'À l\'instant', inline: true },
      )
      .setFooter({ text: `Vinted Bot • ${new Date().toLocaleTimeString('fr-FR')}`, iconURL: 'https://www.vinted.fr/favicon.ico' })
      .setTimestamp();

    if (item.photo) embed.setThumbnail(item.photo);

    const mention = search.userId ? `<@${search.userId}>` : '';
    await channel.send({ content: mention ? `${mention} 🔔 Nouvelle annonce trouvée !` : '🔔 Nouvelle annonce trouvée !', embeds: [embed] });
  } catch (err) {
    console.error('❌ Erreur envoi alerte:', err.message);
  }
}

// ─── Interaction Handler ──────────────────────────────────────────────────────
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, user, channelId } = interaction;

  // /ajouter
  if (commandName === 'ajouter') {
    const query = interaction.options.getString('recherche');
    const prixMax = interaction.options.getNumber('prix_max') || null;
    const pays = interaction.options.getString('pays') || 'tous';

    const countries = pays === 'tous' ? ['fr', 'uk', 'pl'] : [pays];
    const id = searchManager.add({ query, prixMax, countries, userId: user.id, channelId, guildId: interaction.guildId });

    const embed = new EmbedBuilder()
      .setColor(0x09B1BA)
      .setTitle('✅ Alerte créée !')
      .addFields(
        { name: '🔍 Recherche', value: `\`${query}\``, inline: true },
        { name: '💰 Prix max', value: prixMax ? `${prixMax}€` : 'Aucun', inline: true },
        { name: '🌍 Pays', value: countries.map(c => ({ fr: '🇫🇷 France', uk: '🇬🇧 UK', pl: '🇵🇱 Pologne' }[c])).join(', '), inline: false },
        { name: '🆔 ID Alerte', value: `\`${id}\``, inline: true },
      )
      .setFooter({ text: 'Utilisez /mes-alertes pour voir toutes vos alertes' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // /mes-alertes
  else if (commandName === 'mes-alertes') {
    const userSearches = searchManager.getByUser(user.id);

    if (userSearches.length === 0) {
      return interaction.reply({ content: '📭 Vous n\'avez aucune alerte active. Utilisez `/ajouter` pour en créer une !', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(0x09B1BA)
      .setTitle(`🔔 Vos alertes (${userSearches.length})`)
      .setDescription(userSearches.map(s => {
        const status = s.paused ? '⏸️' : '✅';
        const countries = s.countries.map(c => ({ fr: '🇫🇷', uk: '🇬🇧', pl: '🇵🇱' }[c])).join('');
        const price = s.prixMax ? ` • max ${s.prixMax}€` : '';
        return `${status} **ID ${s.id}** — \`${s.query}\` ${countries}${price}`;
      }).join('\n'));

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // /supprimer
  else if (commandName === 'supprimer') {
    const id = interaction.options.getInteger('id');
    const success = searchManager.remove(id, user.id);

    if (success) {
      await interaction.reply({ content: `🗑️ Alerte **#${id}** supprimée !`, ephemeral: true });
    } else {
      await interaction.reply({ content: `❌ Alerte #${id} introuvable ou vous n'en êtes pas le propriétaire.`, ephemeral: true });
    }
  }

  // /pause
  else if (commandName === 'pause') {
    const id = interaction.options.getInteger('id');
    const result = searchManager.togglePause(id, user.id);

    if (result === null) {
      await interaction.reply({ content: `❌ Alerte #${id} introuvable.`, ephemeral: true });
    } else {
      await interaction.reply({ content: result ? `⏸️ Alerte **#${id}** mise en pause.` : `▶️ Alerte **#${id}** réactivée !`, ephemeral: true });
    }
  }

  // /statut
  else if (commandName === 'statut') {
    const allSearches = searchManager.getAll();
    const active = allSearches.filter(s => !s.paused).length;

    const embed = new EmbedBuilder()
      .setColor(0x09B1BA)
      .setTitle('📊 Statut du Bot Vinted')
      .addFields(
        { name: '🟢 Statut', value: 'En ligne', inline: true },
        { name: '🔍 Alertes totales', value: `${allSearches.length}`, inline: true },
        { name: '✅ Alertes actives', value: `${active}`, inline: true },
        { name: '🌍 Pays surveillés', value: '🇫🇷 France • 🇬🇧 UK • 🇵🇱 Pologne', inline: false },
        { name: '⏱️ Intervalle', value: `${process.env.SCAN_INTERVAL || 30} secondes`, inline: true },
        { name: '🖥️ Serveurs', value: `${client.guilds.cache.size}`, inline: true },
      )
      .setTimestamp()
      .setFooter({ text: 'Vinted Monitor Bot' });

    await interaction.reply({ embeds: [embed] });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ DISCORD_TOKEN manquant dans .env !');
  process.exit(1);
}

client.login(token);
