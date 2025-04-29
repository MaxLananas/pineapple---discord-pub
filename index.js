// Importation des modules nécessaires
const { Client, GatewayIntentBits, EmbedBuilder, ActivityType, Events, REST, Routes, ApplicationCommandOptionType, PermissionsBitField, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, Collection, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { createWriteStream } = require('fs');
const axios = require('axios');

// Débogage - Vérifiez si le token est disponible
console.log("DISCORD_TOKEN disponible:", process.env.DISCORD_TOKEN ? "Oui" : "Non");

// Création d'un client Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// Ajoutez express pour le serveur web
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;

// Ajouter un gestionnaire d'événements ready
client.once('ready', () => {
  console.log(`Bot connecté en tant que ${client.user.tag}!`);
  client.user.setActivity('en ligne 24/7', { type: ActivityType.Playing });
});

// Gérer les erreurs
client.on('error', error => {
  console.error('Erreur Discord:', error);
});

// Se connecter à Discord
client.login(token).catch(error => {
  console.error('Erreur de connexion:', error);
});

// Serveur web pour le ping
app.get('/', (req, res) => {
  res.send('Bot is running!');
});

app.listen(port, () => {
  console.log(`Serveur web en écoute sur le port ${port}`);
});

// Salon où envoyer les messages de bienvenue
const welcomeChannelId = '1366151996654096524';

// ID du rôle à attribuer automatiquement
const autoRoleId = '1366148210824839239';

// URLs des salons importants
const rulesChannelUrl = 'https://discord.com/channels/1366148210824839230/1366148212343177299';
const announcementChannelUrl = 'https://discord.com/channels/1366148210824839230/1366148212343177300';
const guideChannelUrl = 'https://discord.com/channels/1366148210824839230/1366148212343177298';

// Lien d'invitation du serveur
const inviteLink = 'https://discord.gg/qXzzHNz285';

// Configuration du compteur de membres
let memberCountChannelId = null;

// Canaux de pub où le bot répondra après chaque message
const pubChannels = [
  '1366148212783714438', '1366148212783714439', '1366148212783714440',
  '1366148213060407387', '1366148213060407388', '1366148213060407389',
  '1366148213060407390', '1366148213060407391', '1366148213060407392',
  '1366148213060407393', '1366148213060407394', '1366148213060407396',
  '1366148213282832476', '1366148213282832477', '1366148213282832478',
  '1366168052823228496', '1366168127569657927'
];

// Stockage pour les giveaways
const giveaways = new Collection();

// Collection pour les rappels
const reminders = new Collection();

// Système de stockage pour les données des tickets
let ticketData = {
  categoryId: null,
  channelId: null,
  guildId: null,
  messageId: null,
  staffRoleId: null,
  archiveCategoryId: null
};

// Créer le dossier pour les archives de tickets s'il n'existe pas
if (!fs.existsSync('./ticket-archives')) {
  fs.mkdirSync('./ticket-archives');
}

// Configuration pour les logs
let logsConfig = {
  enabled: false,
  guildId: null,
  categoryId: null,
  channels: {
    moderation: null,
    messages: null,
    joins: null,
    voice: null,
    server: null
  }
};

// Collection pour les avertissements
const warnings = new Collection();

const lastPubBotMessages = new Map();

const pubStats = new Collection();
const pubStatsFile = './pubStats.json';

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./pubStats.db'); // Crée une base de données locale

// Créer une table pour les pubs si elle n'existe pas
db.run('CREATE TABLE IF NOT EXISTS pubStats (userId TEXT, count INTEGER)');

// Fonction pour ajouter une pub
function addPub(userId) {
  db.get('SELECT count FROM pubStats WHERE userId = ?', [userId], (err, row) => {
    if (err) {
      console.error(err);
      return;
    }
    if (row) {
      const newCount = row.count + 1;
      db.run('UPDATE pubStats SET count = ? WHERE userId = ?', [newCount, userId]);
    } else {
      db.run('INSERT INTO pubStats (userId, count) VALUES (?, ?)', [userId, 1]);
    }
  });
}

// Fonction pour récupérer les stats
function getStats(callback) {
  db.all('SELECT userId, count FROM pubStats ORDER BY count DESC LIMIT 10', [], callback);
}



// Fonction pour sauvegarder la configuration des logs
function saveLogsConfig() {
  try {
    fs.writeFileSync('./logsConfig.json', JSON.stringify(logsConfig), 'utf8');
    console.log('Configuration des logs sauvegardée');
  } catch (error) {
    console.error('Erreur lors de la sauvegarde de la configuration des logs:', error);
  }
}

// Fonction pour charger la configuration des logs
function loadLogsConfig() {
  try {
    if (fs.existsSync('./logsConfig.json')) {
      const data = fs.readFileSync('./logsConfig.json', 'utf8');
      logsConfig = JSON.parse(data);
      console.log('Configuration des logs chargée');
    }
  } catch (error) {
    console.error('Erreur lors du chargement de la configuration des logs:', error);
  }
}

// Fonction pour sauvegarder les avertissements
function saveWarnings() {
  try {
    const warningsData = {};
    warnings.forEach((userWarnings, userId) => {
      warningsData[userId] = userWarnings;
    });
    
    fs.writeFileSync('./warnings.json', JSON.stringify(warningsData), 'utf8');
    console.log('Avertissements sauvegardés');
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des avertissements:', error);
  }
}

// Fonction pour charger les avertissements
function loadWarnings() {
  try {
    if (fs.existsSync('./warnings.json')) {
      const data = fs.readFileSync('./warnings.json', 'utf8');
      const warningsData = JSON.parse(data);
      
      for (const [userId, userWarnings] of Object.entries(warningsData)) {
        warnings.set(userId, userWarnings);
      }
      
      console.log('Avertissements chargés');
    }
  } catch (error) {
    console.error('Erreur lors du chargement des avertissements:', error);
  }
}

try {
  const statsObject = Object.fromEntries(pubStats);
  console.log("Tentative de sauvegarde des stats dans pubStats.json..."); // Log pour déboguer
  fs.writeFileSync(pubStatsFile, JSON.stringify(statsObject, null, 2), 'utf8');
  console.log('📈 pubStats sauvegardés avec succès.');
} catch (error) {
  console.error('Erreur lors de la sauvegarde des pubStats:', error);
}

function loadPubStats() {
try {
  if (fs.existsSync(pubStatsFile)) {
    const data = fs.readFileSync(pubStatsFile, 'utf8');
    const parsed = JSON.parse(data);
    console.log("pubStats chargés avec succès :", parsed); // Log pour voir ce qui a été chargé
    for (const [userId, count] of Object.entries(parsed)) {
      pubStats.set(userId, count);
    }
    console.log('📈 pubStats chargés avec succès.');
  } else {
    console.log("pubStats.json n'existe pas. Aucune donnée à charger.");
  }
} catch (error) {
  console.error('Erreur lors du chargement des pubStats:', error);
}
}

// Fonction pour sauvegarder les statistiques de pub
function savePubStats() {
  try {
    const statsObject = Object.fromEntries(pubStats);
    fs.writeFileSync(pubStatsFile, JSON.stringify(statsObject, null, 2), 'utf8');
    console.log('📈 pubStats sauvegardés avec succès.');
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des pubStats:', error);
  }
}

// Fonction pour charger les statistiques de pub
function loadPubStats() {
  try {
    if (fs.existsSync(pubStatsFile)) {
      const data = fs.readFileSync(pubStatsFile, 'utf8');
      const parsed = JSON.parse(data);
      for (const [userId, count] of Object.entries(parsed)) {
        pubStats.set(userId, count);
      }
      console.log('📈 pubStats chargés avec succès.');
    }
  } catch (error) {
    console.error('Erreur lors du chargement des pubStats:', error);
  }
}


// Charger la configuration des logs et les avertissements au démarrage
loadLogsConfig();
loadWarnings();

// Définition des commandes slash
const commands = [
  {
    name: 'purge',
    description: 'Supprime un nombre spécifique de messages',
    options: [
      {
        name: 'nombre',
        description: 'Nombre de messages à supprimer (entre 1 et 100)',
        type: ApplicationCommandOptionType.Integer,
        required: true,
        min_value: 1,
        max_value: 100
      }
    ]
  },
  {
    name: 'info',
    description: 'Affiche des informations détaillées sur un membre',
    options: [
      {
        name: 'membre',
        description: 'Le membre dont vous souhaitez voir les informations',
        type: ApplicationCommandOptionType.User,
        required: true
      }
    ]
  },
  {
    name: 'ping',
    description: 'Affiche la latence du bot'
  },
  {
    name: 'ban',
    description: 'Bannir un membre du serveur',
    options: [
      {
        name: 'membre',
        description: 'Le membre à bannir',
        type: ApplicationCommandOptionType.User,
        required: true
      },
      {
        name: 'raison',
        description: 'Raison du bannissement',
        type: ApplicationCommandOptionType.String,
        required: false
      }
    ]
  },
  {
    name: 'kick',
    description: 'Expulser un membre du serveur',
    options: [
      {
        name: 'membre',
        description: 'Le membre à expulser',
        type: ApplicationCommandOptionType.User,
        required: true
      },
      {
        name: 'raison',
        description: 'Raison de l\'expulsion',
        type: ApplicationCommandOptionType.String,
        required: false
      }
    ]
  },
  {
    name: 'timeout',
    description: 'Mettre un membre en timeout',
    options: [
      {
        name: 'membre',
        description: 'Le membre à mettre en timeout',
        type: ApplicationCommandOptionType.User,
        required: true
      },
      {
        name: 'duree',
        description: 'Durée du timeout en minutes',
        type: ApplicationCommandOptionType.Integer,
        required: true,
        min_value: 1,
        max_value: 10080 // 7 jours en minutes
      },
      {
        name: 'raison',
        description: 'Raison du timeout',
        type: ApplicationCommandOptionType.String,
        required: false
      }
    ]
  },
  {
    name: 'stats',
    description: 'Affiche les statistiques du serveur'
  },
  {
    name: 'rolelog',
    description: 'Active ou désactive le log des changements de rôles',
    options: [
      {
        name: 'etat',
        description: 'Activer ou désactiver le log',
        type: ApplicationCommandOptionType.String,
        required: true,
        choices: [
          {
            name: 'Activer',
            value: 'on'
          },
          {
            name: 'Désactiver',
            value: 'off'
          }
        ]
      }
    ]
  },
  {
    name: 'giveaway',
    description: 'Créer un nouveau giveaway',
    options: [
      {
        name: 'duree',
        description: 'Durée du giveaway (en minutes)',
        type: ApplicationCommandOptionType.Integer,
        required: true,
        min_value: 1
      },
      {
        name: 'gagnants',
        description: 'Nombre de gagnants',
        type: ApplicationCommandOptionType.Integer,
        required: true,
        min_value: 1,
        max_value: 10
      },
      {
        name: 'prix',
        description: 'Prix du giveaway',
        type: ApplicationCommandOptionType.String,
        required: true
      },
      {
        name: 'salon',
        description: 'Salon où créer le giveaway',
        type: ApplicationCommandOptionType.Channel,
        required: false
      }
    ]
  },
  {
    name: 'setup-ticket',
    description: 'Configure le système de tickets',
    options: [
      {
        name: 'salon',
        description: 'Salon où envoyer le message de création de tickets',
        type: ApplicationCommandOptionType.Channel,
        required: true
      },
      {
        name: 'role_staff',
        description: 'Rôle qui aura accès aux tickets',
        type: ApplicationCommandOptionType.Role,
        required: true
      }
    ]
  },
  {
    name: 'message',
    description: 'Envoyer un message en tant que bot',
    options: [
      {
        name: 'salon',
        description: 'Salon où envoyer le message',
        type: ApplicationCommandOptionType.Channel,
        required: true
      },
      {
        name: 'contenu',
        description: 'Contenu du message',
        type: ApplicationCommandOptionType.String,
        required: true
      },
      {
        name: 'couleur',
        description: 'Couleur de l\'embed (hex ou nom)',
        type: ApplicationCommandOptionType.String,
        required: false
      },
      {
        name: 'titre',
        description: 'Titre de l\'embed (laissez vide pour un message simple)',
        type: ApplicationCommandOptionType.String,
        required: false
      },
      {
        name: 'image',
        description: 'URL de l\'image à ajouter',
        type: ApplicationCommandOptionType.String,
        required: false
      }
    ]
  },
  {
    name: 'setup-counter',
    description: 'Configure un compteur de membres vocal',
    options: [
      {
        name: 'catégorie',
        description: 'Catégorie où créer le compteur vocal',
        type: ApplicationCommandOptionType.Channel,
        required: true
      }
    ]
  },
  {
    name: 'announce',
    description: 'Faire une annonce officielle',
    options: [
      {
        name: 'salon',
        description: 'Salon où envoyer l\'annonce',
        type: ApplicationCommandOptionType.Channel,
        required: true
      },
      {
        name: 'titre',
        description: 'Titre de l\'annonce',
        type: ApplicationCommandOptionType.String,
        required: true
      },
      {
        name: 'contenu',
        description: 'Contenu de l\'annonce',
        type: ApplicationCommandOptionType.String,
        required: true
      },
      {
        name: 'image',
        description: 'URL de l\'image à joindre',
        type: ApplicationCommandOptionType.String,
        required: false
      },
      {
        name: 'ping',
        description: 'Mentionner @everyone ou @here',
        type: ApplicationCommandOptionType.String,
        required: false,
        choices: [
          {
            name: 'everyone',
            value: 'everyone'
          },
          {
            name: 'here',
            value: 'here'
          },
          {
            name: 'aucun',
            value: 'none'
          }
        ]
      }
    ]
  },
  {
    name: 'poll',
    description: 'Créer un sondage',
    options: [
      {
        name: 'question',
        description: 'Question du sondage',
        type: ApplicationCommandOptionType.String,
        required: true
      },
      {
        name: 'option1',
        description: 'Option 1',
        type: ApplicationCommandOptionType.String,
        required: true
      },
      {
        name: 'option2',
        description: 'Option 2',
        type: ApplicationCommandOptionType.String,
        required: true
      },
      {
        name: 'option3',
        description: 'Option 3',
        type: ApplicationCommandOptionType.String,
        required: false
      },
      {
        name: 'option4',
        description: 'Option 4',
        type: ApplicationCommandOptionType.String,
        required: false
      },
      {
        name: 'option5',
        description: 'Option 5',
        type: ApplicationCommandOptionType.String,
        required: false
      },
      {
        name: 'option6',
        description: 'Option 6',
        type: ApplicationCommandOptionType.String,
        required: false
      },
      {
        name: 'option7',
        description: 'Option 7',
        type: ApplicationCommandOptionType.String,
        required: false
      },
      {
        name: 'option8',
        description: 'Option 8',
        type: ApplicationCommandOptionType.String,
        required: false
      },
      {
        name: 'option9',
        description: 'Option 9',
        type: ApplicationCommandOptionType.String,
        required: false
      },
      {
        name: 'option10',
        description: 'Option 10',
        type: ApplicationCommandOptionType.String,
        required: false
      }
    ]
  },
  {
    name: 'embed',
    description: 'Créer un embed personnalisé',
    options: [
      {
        name: 'salon',
        description: 'Salon où envoyer l\'embed',
        type: ApplicationCommandOptionType.Channel,
        required: true
      },
      {
        name: 'titre',
        description: 'Titre de l\'embed',
        type: ApplicationCommandOptionType.String,
        required: true
      },
      {
        name: 'description',
        description: 'Description de l\'embed',
        type: ApplicationCommandOptionType.String,
        required: true
      },
      {
        name: 'couleur',
        description: 'Couleur de l\'embed (hex)',
        type: ApplicationCommandOptionType.String,
        required: false
      },
      {
        name: 'image',
        description: 'URL de l\'image',
        type: ApplicationCommandOptionType.String,
        required: false
      },
      {
        name: 'thumbnail',
        description: 'URL de la vignette',
        type: ApplicationCommandOptionType.String,
        required: false
      },
      {
        name: 'footer',
        description: 'Texte du footer',
        type: ApplicationCommandOptionType.String,
        required: false
      }
    ]
  },
  {
    name: 'usercount',
    description: 'Affiche les statistiques de croissance du serveur'
  },
  {
    name: 'reminder',
    description: 'Crée un rappel',
    options: [
      {
        name: 'temps',
        description: 'Temps avant le rappel (en minutes)',
        type: ApplicationCommandOptionType.Integer,
        required: true,
        min_value: 1
      },
      {
        name: 'message',
        description: 'Message du rappel',
        type: ApplicationCommandOptionType.String,
        required: true
      }
    ]
  },
  {
    name: 'servericon',
    description: 'Affiche l\'icône du serveur en grand'
  },
  {
    name: 'servbanner',
    description: 'Affiche la bannière du serveur en grand'
  },
  {
    name: 'avatar',
    description: 'Affiche l\'avatar d\'un utilisateur en grand',
    options: [
      {
        name: 'utilisateur',
        description: 'Utilisateur dont vous voulez voir l\'avatar',
        type: ApplicationCommandOptionType.User,
        required: false
      }
    ]
  },
  {
    name: 'templates',
    description: 'Poster un template pré-rédigé dans un salon',
    options: [
      {
        name: 'type',
        description: 'Type de template à poster',
        type: ApplicationCommandOptionType.String,
        required: true,
        choices: [
          {
            name: 'Règlement',
            value: 'rules'
          },
          {
            name: 'Conditions de partenariat',
            value: 'partnership'
          },
          {
            name: 'Notre pub',
            value: 'promo'
          },
          {
            name: 'Guide',
            value: 'guide'
          }
        ]
      },
      {
        name: 'salon',
        description: 'Salon où poster le template',
        type: ApplicationCommandOptionType.Channel,
        required: true
      }
    ]
  },
  {
    name: 'setup-logs',
    description: 'Configure un système de logs complet',
    options: [
      {
        name: 'catégorie',
        description: 'Catégorie où créer les salons de logs',
        type: ApplicationCommandOptionType.Channel,
        required: true
      }
    ]
  },
  {
    name: 'warn',
    description: 'Avertir un membre',
    options: [
      {
        name: 'membre',
        description: 'Le membre à avertir',
        type: ApplicationCommandOptionType.User,
        required: true
      },
      {
        name: 'raison',
        description: 'Raison de l\'avertissement',
        type: ApplicationCommandOptionType.String,
        required: true
      }
    ]
  },
  {
    name: 'warnlist',
    description: 'Voir les avertissements d\'un membre',
    options: [
      {
        name: 'membre',
        description: 'Le membre dont vous voulez voir les avertissements',
        type: ApplicationCommandOptionType.User,
        required: true
      }
    ]
  },
  {
    name: 'unwarn',
    description: 'Retirer un avertissement d\'un membre',
    options: [
      {
        name: 'membre',
        description: 'Le membre dont vous voulez retirer un avertissement',
        type: ApplicationCommandOptionType.User,
        required: true
      },
      {
        name: 'id',
        description: 'ID de l\'avertissement à retirer',
        type: ApplicationCommandOptionType.String,
        required: true
      }
    ]
  },
  {
    name: 'tempmute',
    description: 'Couper temporairement le micro d\'un membre dans les salons vocaux',
    options: [
      {
        name: 'membre',
        description: 'Le membre à mute',
        type: ApplicationCommandOptionType.User,
        required: true
      },
      {
        name: 'duree',
        description: 'Durée du mute en minutes',
        type: ApplicationCommandOptionType.Integer,
        required: true,
        min_value: 1,
        max_value: 1440
      },
      {
        name: 'raison',
        description: 'Raison du mute',
        type: ApplicationCommandOptionType.String,
        required: false
      }
    ]
  },
  {
    name: 'clear-warns',
    description: 'Effacer tous les avertissements d\'un membre',
    options: [
      {
        name: 'membre',
        description: 'Le membre dont vous voulez effacer les avertissements',
        type: ApplicationCommandOptionType.User,
        required: true
      }
    ]
  }
];

// Enregistrement des commandes slash
const rest = new REST({ version: '10' }).setToken(token);

// Variable pour la fonctionnalité de rolelog
client.roleLogEnabled = false;

// Événement quand le bot est prêt
client.once('ready', async () => {
  console.log(`🍍 Connecté en tant que ${client.user.tag}`);
  
  // Enregistrer les commandes slash
  try {
    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );
    console.log('Commandes slash enregistrées avec succès!');
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement des commandes slash:', error);
  }
  
  // Mettre à jour le statut du bot avec le nombre de membres
  updateBotStatus();
  
  // Mettre à jour le statut et le compteur toutes les 5 minutes
  setInterval(() => {
    updateBotStatus();
    updateMemberCountChannel();
  }, 300000);
  
  // Vérifier les giveaways en cours toutes les 10 secondes
  setInterval(() => {
    checkGiveaways();
  }, 10000);
  
  // Vérifier les rappels toutes les 30 secondes
  setInterval(() => {
    checkReminders();
  }, 30000);
  
  // Charger les données de tickets si elles existent
  try {
    if (fs.existsSync('./ticketData.json')) {
      const data = fs.readFileSync('./ticketData.json', 'utf8');
      ticketData = JSON.parse(data);
      console.log('Données de tickets chargées');
    }
  } catch (error) {
    console.error('Erreur lors du chargement des données de tickets:', error);
  }
  
  // Charger les données du compteur de membres
  try {
    if (fs.existsSync('./memberCounterData.json')) {
      const data = fs.readFileSync('./memberCounterData.json', 'utf8');
      const counterData = JSON.parse(data);
      memberCountChannelId = counterData.channelId;
      console.log('Données du compteur de membres chargées');
      updateMemberCountChannel();
    }
  } catch (error) {
    console.error('Erreur lors du chargement des données du compteur:', error);
  }
});

// Fonction pour mettre à jour le statut du bot
function updateBotStatus() {
  const totalMembers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
  client.user.setActivity(`${totalMembers} membres`, { type: ActivityType.Watching });
}

// Fonction pour sauvegarder les données de tickets
function saveTicketData() {
  try {
    fs.writeFileSync('./ticketData.json', JSON.stringify(ticketData), 'utf8');
    console.log('Données de tickets sauvegardées');
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des données de tickets:', error);
  }
}

// Fonction pour sauvegarder les données du compteur de membres
function saveMemberCounterData() {
  try {
    fs.writeFileSync('./memberCounterData.json', JSON.stringify({ channelId: memberCountChannelId }), 'utf8');
    console.log('Données du compteur de membres sauvegardées');
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des données du compteur:', error);
  }
}

// Fonction pour mettre à jour le salon vocal compteur de membres
async function updateMemberCountChannel() {
  if (!memberCountChannelId) return;
  
  try {
    const guild = client.guilds.cache.first();
    if (!guild) return;
    
    const channel = guild.channels.cache.get(memberCountChannelId);
    if (!channel) return;
    
    await channel.setName(`🤖〃commande : ${guild.memberCount}_membres`);
    console.log('Compteur de membres mis à jour');
  } catch (error) {
    console.error('Erreur lors de la mise à jour du compteur de membres:', error);
  }
}

// Fonction pour créer une archive HTML d'un ticket
async function createTicketArchive(channel, ticketType, userId) {
  try {
    // Récupérer les messages du ticket
    const messages = await channel.messages.fetch({ limit: 100 });
    const sortedMessages = Array.from(messages.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    
    // Commencer l'archive HTML
    let html = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Archive Ticket - ${channel.name}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { background-color: #FFC83D; padding: 20px; border-radius: 5px; margin-bottom: 20px; text-align: center; }
        .message { padding: 10px; margin-bottom: 10px; border-radius: 5px; }
        .user-message { background-color: #f0f0f0; }
        .bot-message { background-color: #e6f7ff; }
        .message-header { display: flex; align-items: center; margin-bottom: 5px; }
        .avatar { width: 30px; height: 30px; border-radius: 50%; margin-right: 10px; }
        .timestamp { font-size: 0.8em; color: #777; margin-left: 10px; }
        .content { margin-left: 40px; }
        .system { font-style: italic; color: #777; text-align: center; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Archive du ticket #${channel.name}</h1>
        <p>Type: ${ticketType} | Créé par: <@${userId}> | ID: ${userId}</p>
        <p>Archivé le: ${new Date().toLocaleString()}</p>
    </div>
    <div class="messages">`;
    
    // Ajouter chaque message à l'HTML
    for (const message of sortedMessages) {
      const isBot = message.author.bot;
      const timestamp = new Date(message.createdTimestamp).toLocaleString();
      
      html += `
        <div class="message ${isBot ? 'bot-message' : 'user-message'}">
            <div class="message-header">
                <img class="avatar" src="${message.author.displayAvatarURL({ format: 'png', size: 128 })}" alt="Avatar">
                <strong>${message.author.tag}</strong>
                <span class="timestamp">${timestamp}</span>
            </div>
            <div class="content">${message.content || ''}`;
      
      // Ajouter les embeds si présents
      if (message.embeds && message.embeds.length > 0) {
        for (const embed of message.embeds) {
          html += `<div class="embed" style="border-left: 4px solid #${embed.color ? embed.color.toString(16) : 'cccccc'}; padding-left: 10px; margin: 5px 0;">`;
          
          if (embed.title) html += `<h3>${embed.title}</h3>`;
          if (embed.description) html += `<p>${embed.description}</p>`;
          
          if (embed.fields && embed.fields.length > 0) {
            for (const field of embed.fields) {
              html += `<h4>${field.name}</h4><p>${field.value}</p>`;
            }
          }
          
          html += `</div>`;
        }
      }
      
      // Ajouter les pièces jointes si présentes
      if (message.attachments && message.attachments.size > 0) {
        for (const [id, attachment] of message.attachments) {
          if (attachment.contentType && attachment.contentType.startsWith('image/')) {
            html += `<img src="${attachment.url}" alt="Attachment" style="max-width: 100%; max-height: 300px; margin-top: 10px;">`;
          } else {
            html += `<p><a href="${attachment.url}" target="_blank">Pièce jointe: ${attachment.name}</a></p>`;
          }
        }
      }
      
      html += `</div>
        </div>`;
    }
    
    // Fermer l'HTML
    html += `
    </div>
</body>
</html>`;
    
    // Créer le nom de fichier
    const fileName = `./ticket-archives/ticket-${channel.name}-${Date.now()}.html`;
    
    // Écrire l'HTML dans un fichier
    fs.writeFileSync(fileName, html);
    
    return fileName;
  } catch (error) {
    console.error('Erreur lors de la création de l\'archive du ticket:', error);
    return null;
  }
}

// Fonction pour vérifier les giveaways en cours
function checkGiveaways() {
  const now = Date.now();
  giveaways.forEach(async (giveaway, messageId) => {
    if (now >= giveaway.endTime) {
      try {
        const guild = client.guilds.cache.get(giveaway.guildId);
        if (!guild) return;
        
        const channel = guild.channels.cache.get(giveaway.channelId);
        if (!channel) return;
        
        const message = await channel.messages.fetch(messageId).catch(() => null);
        if (!message) return;
        
        const reaction = message.reactions.cache.get('🎉');
        if (!reaction) return;
        
        const users = await reaction.users.fetch();
        const validUsers = users.filter(user => !user.bot);
        
        if (validUsers.size === 0) {
          const noWinnerEmbed = new EmbedBuilder()
            .setColor('#FFC83D')
            .setTitle('🎉 Giveaway Terminé!')
            .setDescription(`**Prix: ${giveaway.prize}**\n\nAucun participant! Pas de gagnant.`)
            .setFooter({ text: 'Pineapple Giveaway' })
            .setTimestamp();
          
          await message.edit({ embeds: [noWinnerEmbed] });
          await channel.send('❌ Aucun participant pour le giveaway!');
        } else {
          const winnerIds = [];
          const actualWinnerCount = Math.min(giveaway.winnerCount, validUsers.size);
          
          for (let i = 0; i < actualWinnerCount; i++) {
            const winnerIndex = Math.floor(Math.random() * validUsers.size);
            const winner = Array.from(validUsers.values())[winnerIndex];
            winnerIds.push(winner.id);
            validUsers.delete(winner.id);
          }
          
          const winners = winnerIds.map(id => `<@${id}>`).join(', ');
          
          const winnerEmbed = new EmbedBuilder()
            .setColor('#FFC83D')
            .setTitle('🎉 Giveaway Terminé!')
            .setDescription(`**Prix: ${giveaway.prize}**\n\n**Gagnant(s):** ${winners}`)
            .setFooter({ text: 'Pineapple Giveaway' })
            .setTimestamp();
          
          await message.edit({ embeds: [winnerEmbed] });
          await channel.send(`🎊 Félicitations ${winners}! Vous avez gagné **${giveaway.prize}**!`);
        }
        
        // Supprimer le giveaway de la collection
        giveaways.delete(messageId);
      } catch (error) {
        console.error('Erreur lors de la finalisation du giveaway:', error);
      }
    }
  });
}

// Fonction pour vérifier les rappels
function checkReminders() {
  const now = Date.now();
  reminders.forEach(async (reminder, id) => {
    if (now >= reminder.endTime) {
      try {
        const user = await client.users.fetch(reminder.userId);
        if (user) {
          const reminderEmbed = new EmbedBuilder()
            .setColor('#FFC83D')
            .setTitle('⏰ Rappel')
            .setDescription(reminder.message)
            .setFooter({ text: 'Pineapple Reminder' })
            .setTimestamp();
          
          await user.send({ embeds: [reminderEmbed] });
        }
        
        // Supprimer le rappel de la collection
        reminders.delete(id);
      } catch (error) {
        console.error('Erreur lors de l\'envoi du rappel:', error);
        reminders.delete(id);
      }
    }
  });
}

// Événement : un membre rejoint le serveur
client.on('guildMemberAdd', async (member) => {
  try {
    // Attribution du rôle automatique
    try {
      await member.roles.add(autoRoleId);
      console.log(`Rôle attribué à ${member.user.tag}`);
    } catch (error) {
      console.error('Erreur lors de l\'attribution du rôle:', error);
    }

    // Message de bienvenue dans le salon
    const welcomeChannel = client.channels.cache.get(welcomeChannelId);
    if (!welcomeChannel) return;

    const welcomeEmbed = new EmbedBuilder()
      .setColor('#FFC83D')
      .setTitle(`✨ Bienvenue ${member.user.username} sur notre serveur ! ✨`)
      .setDescription(`
🍍 **Nous sommes ravis de t'accueillir parmi nous !**

📜 **Consulte nos règles :** <${rulesChannelUrl}>
📢 **Reste informé avec nos annonces :** <${announcementChannelUrl}>
📚 **Guide pour bien démarrer :** <${guideChannelUrl}>

N'hésite pas à te présenter et à interagir avec les autres membres !
      `)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setImage('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExY2QxMXBhZXg5bmtjMG1xdm1lb2V0amtyNzQ3cm5hMmI0cGg5bTgxbyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/xUPGGDNsLvqsBOhuU0/giphy.gif')
      .setFooter({ text: '🍍 Pineapple - Serveur Pub 🍍' })
      .setTimestamp();

    await welcomeChannel.send({
      content: `👋 Hey <@${member.id}> ! Bienvenue parmi nous !`,
      embeds: [welcomeEmbed]
    });

    // Envoi d'un message privé de bienvenue
    const dmEmbed = new EmbedBuilder()
      .setColor('#FFC83D')
      .setTitle('🌟 Bienvenue sur Pineapple - Serveur Pub! 🌟')
      .setDescription(`
Salut <@${member.id}> ! Merci d'avoir rejoint notre communauté !

🍍 **Notre serveur propose :**
• Promotion de ton serveur Discord
• Opportunités de partenariats
• Communauté active et chaleureuse
• Événements et concours réguliers

🔗 **Invite tes amis ici :** ${inviteLink}

Profite bien de ton expérience parmi nous !
      `)
      .setImage('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExY2QxMXBhZXg5bmtjMG1xdm1lb2V0amtyNzQ3cm5hMmI0cGg5bTgxbyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/xUPGGDNsLvqsBOhuU0/giphy.gif')
      .setFooter({ text: '🍍 Pineapple - Serveur Pub 🍍' });

    try {
      await member.send({ embeds: [dmEmbed] });
      console.log(`MP envoyé à ${member.user.tag}`);
    } catch (error) {
      console.error('Erreur lors de l\'envoi du MP:', error);
    }

    updateBotStatus();
    updateMemberCountChannel();
  } catch (error) {
    console.error('Erreur générale dans guildMemberAdd:', error);
  }
});

// --- GESTION DES PUBLICATIONS DANS LES SALONS DE PUB ---
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  
  const content = message.content.toLowerCase();
  
  if (pubChannels.includes(message.channelId)) {
    try {
      const pubEmbed = new EmbedBuilder()
        .setColor('#FFC83D')
        .setTitle('🍍 Pineapple - Serveur Pub')
        .setDescription(`
Merci pour ta publication <@${message.author.id}> !

🔗 **Rejoins notre communauté de promotion :**
• Publie ton serveur dans les salons appropriés
• Trouve des partenaires
• Développe ta visibilité

📜 **Consulte nos règles :** <${rulesChannelUrl}>
🚀 **Invite tes amis :** ${inviteLink}
        `)
        .setFooter({ text: 'Merci de soutenir notre serveur !' });

      // Supprimer le dernier message de pub du bot si existant
      const lastBotMsgId = lastPubBotMessages.get(message.channelId);
      if (lastBotMsgId) {
        try {
          const oldBotMessage = await message.channel.messages.fetch(lastBotMsgId);
          if (oldBotMessage && oldBotMessage.deletable) {
            await oldBotMessage.delete();
          }
        } catch (err) {
          console.warn('Impossible de supprimer l’ancien message du bot:', err.message);
        }
      }

      // Envoie du nouveau message du bot
      const botMessage = await message.reply({ embeds: [pubEmbed], allowedMentions: { repliedUser: false } });
      
      // Sauvegarde de l'ID du message bot pour suppression future
      lastPubBotMessages.set(message.channelId, botMessage.id);

      // Associer l'ID du message de l'utilisateur au message du bot pour suppression liée
      const userMessageId = message.id;
      message.client.once(Events.MessageDelete, async (deletedMessage) => {
        if (deletedMessage.id === userMessageId) {
          try {
            const relatedBotMessage = await message.channel.messages.fetch(botMessage.id);
            if (relatedBotMessage && relatedBotMessage.deletable) {
              await relatedBotMessage.delete();
            }
          } catch (err) {
            console.warn('Erreur lors de la suppression du message du bot lié à un message supprimé:', err.message);
          }
        }
      });

      // Gérer les statistiques de publication
      const userId = message.author.id;
      const pubCount = (pubStats.get(userId) || 0) + 1;
      pubStats.set(userId, pubCount);
      savePubStats();

      // Récompense
      const rewardThreshold = 50; 
      const rewardRoleId = '1366569803275571210'; // ID du rôle spécial
      if (pubCount === rewardThreshold) {
        try {
          const member = await message.guild.members.fetch(userId);
          await member.roles.add(rewardRoleId);
          await message.channel.send({
            content: `🎉 Bravo <@${userId}> ! Tu as atteint ${rewardThreshold} publications et gagné un rôle spécial !`
          });
        } catch (error) {
          console.error('Erreur lors de l\'attribution du rôle de récompense:', error);
        }
      }

    } catch (error) {
      console.error('Erreur lors de la gestion de la publication de pub:', error);
    }
  }
});

// Sauvegarde régulière des stats
setInterval(() => {
  savePubStats();
}, 5 * 60 * 1000);


  // --- Commande !server, !serveur ou !pineapple ---
  if (content === '!server' || content === '!serveur' || content === '!pineapple') {
    try {
      const guild = message.guild;
      const owner = await guild.fetchOwner();
      const serverEmbed = new EmbedBuilder()
        .setColor('#FFC83D')
        .setTitle(`📊 Informations sur ${guild.name}`)
        .setThumbnail(guild.iconURL({ dynamic: true }))
        .addFields(
          { name: '👑 Propriétaire', value: owner.user.tag, inline: true },
          { name: '👥 Membres', value: guild.memberCount.toString(), inline: true },
          { name: '📅 Créé le', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: true },
          { name: '🔗 Lien d\'invitation', value: inviteLink, inline: false }
        )
        .setFooter({ text: '🍍 Pineapple - Serveur Pub 🍍' })
        .setTimestamp();

      await message.reply({ embeds: [serverEmbed] });
    } catch (error) {
      console.error('Erreur lors de l\'affichage des infos serveur:', error);
    }
    return;
  }

  // --- Commande !help ou !aide ---
  if (content === '!help' || content === '!aide') {
    try {
      const helpEmbed = new EmbedBuilder()
        .setColor('#FFC83D')
        .setTitle('🍍 Commandes Pineapple Bot 🍍')
        .setDescription(`
Voici les commandes disponibles sur notre serveur:

**Commandes textuelles:**
• **!server** ou **!serveur** - Infos sur le serveur
• **!help** ou **!aide** - Liste des commandes
• **!invite** - Lien d'invitation du serveur

**Commandes slash (/):**
• /purge, /info, /ping, /ban, /kick, /timeout
• /stats, /rolelog, /giveaway, /setup-ticket
• /message, /setup-counter, /announce, /poll
• /embed, /usercount, /reminder, /avatar
• /servericon, /servbanner

N'hésite pas à consulter nos règles et notre guide pour plus d'infos !
        `)
        .setFooter({ text: '🍍 Pineapple - Serveur Pub 🍍' })
        .setTimestamp();

      await message.reply({ embeds: [helpEmbed] });
    } catch (error) {
      console.error('Erreur lors de l\'affichage de l\'aide:', error);
    }
    return;
  }

  // --- Commande !invite ---
  if (content === '!invite') {
    try {
      const inviteEmbed = new EmbedBuilder()
        .setColor('#FFC83D')
        .setTitle('🔗 Invite tes amis à rejoindre notre serveur !')
        .setDescription(`
Partage ce lien avec tes amis pour qu'ils puissent nous rejoindre :

**${inviteLink}**

Merci de contribuer à la croissance de notre communauté !
        `)
        .setFooter({ text: '🍍 Pineapple - Serveur Pub 🍍' })
        .setTimestamp();

      await message.reply({ embeds: [inviteEmbed] });
    } catch (error) {
      console.error('Erreur lors de l\'affichage du lien d\'invitation:', error);
    }
    return;
  }

  // --- Commande !pubstats ---
  if (content === '!pubstats') {
    db.all('SELECT userId, count FROM pubStats ORDER BY count DESC LIMIT 10', [], (err, rows) => {
      if (err) {
        console.error('Erreur lors de la récupération des stats :', err);
        return message.reply('Erreur lors de la récupération des stats.');
      }
  
      if (rows.length === 0) {
        return message.reply('📊 Aucun membre n\'a encore posté de pub.');
      }
  
      const leaderboard = rows.map((row, index) => `**#${index + 1}** - <@${row.userId}> : ${row.count} pub(s)`).join('\n');
  
      const statsEmbed = new EmbedBuilder()
        .setColor('#FFC83D')
        .setTitle('📊 Classement des pubs')
        .setDescription(leaderboard)
        .setFooter({ text: 'Continue à partager ton projet !' })
        .setTimestamp();
  
      message.reply({ embeds: [statsEmbed] });
    });
  }
  

});

// Gestion des commandes slash
client.on(Events.InteractionCreate, async (interaction) => {
  // Gérer les interactions de bouton
  if (interaction.isButton()) {
    // Gestion des boutons de ticket
    if (interaction.customId === 'create_collab_ticket') {
      await handleTicketCreation(interaction, 'Collaboration/Partenariat');
    } 
    else if (interaction.customId === 'create_help_ticket') {
      await handleTicketCreation(interaction, 'Aide');
    }
    // Gestion des boutons de participation au giveaway
    else if (interaction.customId.startsWith('giveaway_join_')) {
      // Ce n'est pas nécessaire car on utilise les réactions, mais c'est là au cas où
    }
    // Gestion du bouton de fermeture de ticket
    else if (interaction.customId === 'close_ticket') {
      try {
        const channel = interaction.channel;
        
        // Vérifier que c'est bien un canal de ticket
        if (!channel.name.startsWith('ticket-')) {
          return interaction.reply({ content: '❌ Ce canal n\'est pas un ticket!', ephemeral: true });
        }
        
        // Message de confirmation
        await interaction.reply({ content: '🔒 Fermeture du ticket et création de l\'archive...' });
        
        // Extraire le nom d'utilisateur du nom du canal
        const username = channel.name.replace('ticket-', '');
        
        // Trouver le membre correspondant
        const member = await interaction.guild.members.cache.find(member => 
          member.user.username.toLowerCase().replace(/\s+/g, '-') === username
        );
        
        const userId = member ? member.id : 'inconnu';
        const ticketType = channel.topic || 'Non spécifié';
        
        // Créer l'archive HTML
        const archiveFile = await createTicketArchive(channel, ticketType, userId);
        
        if (archiveFile) {
          // Créer un canal dans la catégorie d'archives
          let archiveCategory = null;
          
          if (ticketData.archiveCategoryId) {
            archiveCategory = interaction.guild.channels.cache.get(ticketData.archiveCategoryId);
          }
          
          if (!archiveCategory) {
            archiveCategory = await interaction.guild.channels.create({
              name: 'ARCHIVES-TICKETS',
              type: ChannelType.GuildCategory,
              permissionOverwrites: [
                {
                  id: interaction.guild.id,
                  deny: [PermissionsBitField.Flags.ViewChannel]
                },
                {
                  id: ticketData.staffRoleId,
                  allow: [PermissionsBitField.Flags.ViewChannel]
                }
              ]
            });
            
            ticketData.archiveCategoryId = archiveCategory.id;
            saveTicketData();
          }
          
          // Créer un canal textuel pour l'archive
          const archiveChannel = await interaction.guild.channels.create({
            name: `archive-${channel.name}`,
            type: ChannelType.GuildText,
            parent: archiveCategory,
            topic: `Archive du ticket ${channel.name} | Type: ${ticketType} | Utilisateur: <@${userId}>`
          });
          
          // Lire le fichier d'archive et le joindre
          const archiveContent = fs.readFileSync(archiveFile);
          const attachment = new AttachmentBuilder(archiveContent, { name: `${channel.name}-archive.html` });
          
          // Créer un embed d'information
          const archiveEmbed = new EmbedBuilder()
            .setColor('#FFC83D')
            .setTitle('🗃️ Archive de ticket')
            .setDescription(`
            Archive du ticket **${channel.name}**
            
            **Type:** ${ticketType}
            **Utilisateur:** <@${userId}>
            **Fermé par:** <@${interaction.user.id}>
            **Date de fermeture:** <t:${Math.floor(Date.now() / 1000)}:F>
            
            L'archive HTML est jointe à ce message.
            `)
            .setFooter({ text: 'Pineapple Ticket System' })
            .setTimestamp();
          
          // Envoyer l'archive
          await archiveChannel.send({ embeds: [archiveEmbed], files: [attachment] });
          
          // Notifier l'utilisateur que le ticket est fermé
          await interaction.editReply({ content: `✅ Ticket fermé et archivé avec succès dans <#${archiveChannel.id}>!` });
        } else {
          await interaction.editReply({ content: '⚠️ Impossible de créer une archive, fermeture du ticket...' });
        }
        
        // Attendre 5 secondes
        setTimeout(async () => {
          try {
            await channel.delete();
          } catch (error) {
            console.error('Erreur lors de la suppression du ticket:', error);
          }
        }, 5000);
      } catch (error) {
        console.error('Erreur lors de la fermeture du ticket:', error);
        await interaction.reply({ content: '❌ Une erreur est survenue lors de la fermeture du ticket.', ephemeral: true });
      }
    }
    
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  // Commande /purge
  if (commandName === 'purge') {
    // Vérifier si l'utilisateur a les permissions nécessaires
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({
        content: '⛔ Tu n\'as pas la permission de supprimer des messages!',
        ephemeral: true
      });
    }
    
    const amount = interaction.options.getInteger('nombre');
    
    try {
      // Supprimer les messages
      const deleted = await interaction.channel.bulkDelete(amount, true);
      
      // Répondre à l'interaction
      await interaction.reply({
        content: `✅ J'ai supprimé ${deleted.size} message(s)!`,
        ephemeral: true
      });
    } catch (error) {
      console.error('Erreur lors de la suppression des messages:', error);
      await interaction.reply({
        content: '❌ Je ne peux pas supprimer des messages qui datent de plus de 14 jours!',
        ephemeral: true
      });
    }
  }
  
  // Commande /info
  else if (commandName === 'info') {
    const user = interaction.options.getUser('membre');
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    
    if (!member) {
      return interaction.reply({
        content: '❌ Ce membre n\'est pas sur le serveur!',
        ephemeral: true
      });
    }
    
    // Créer un embed avec les informations du membre
    const roles = member.roles.cache.filter(role => role.id !== interaction.guild.id).map(role => `<@&${role.id}>`).join(', ') || 'Aucun rôle';
    
    const joinPosition = Array.from(interaction.guild.members.cache
      .sort((a, b) => a.joinedTimestamp - b.joinedTimestamp)
      .keys())
      .indexOf(member.id) + 1;
    
    const userFlags = user.flags ? user.flags.toArray() : [];
    const badges = userFlags.length > 0 ? 
      userFlags.map(flag => {
        switch (flag) {
          case 'Staff': return '👨‍💼 Staff Discord';
          case 'Partner': return '🤝 Partenaire Discord';
          case 'CertifiedModerator': return '🛡️ Modérateur certifié';
          case 'Hypesquad': return '🏠 HypeSquad Events';
          case 'HypeSquadOnlineHouse1': return '🏠 Maison Bravery';
          case 'HypeSquadOnlineHouse2': return '🏠 Maison Brilliance';
          case 'HypeSquadOnlineHouse3': return '🏠 Maison Balance';
          case 'BugHunterLevel1': return '🐛 Chasseur de bugs (Niveau 1)';
          case 'BugHunterLevel2': return '🐛 Chasseur de bugs (Niveau 2)';
          case 'VerifiedDeveloper': return '👨‍💻 Développeur de bot vérifié';
          case 'VerifiedBot': return '✅ Bot vérifié';
          case 'EarlySupporter': return '❤️ Soutien précoce';
          case 'PremiumEarlySupporter': return '💎 Soutien précoce premium';
          case 'Nitro': return '💎 Nitro';
          default: return flag;
        }
      }).join('\n') : 'Aucun badge';
    
    const infoEmbed = new EmbedBuilder()
      .setColor('#FFC83D')
      .setTitle(`📋 Informations sur ${user.tag}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 4096 }))
      .addFields(
        { name: '🆔 ID', value: user.id, inline: true },
        { name: '📛 Surnom', value: member.nickname || 'Aucun surnom', inline: true },
        { name: '🤖 Bot', value: user.bot ? 'Oui' : 'Non', inline: true },
        { name: '📅 Compte créé le', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>\n(<t:${Math.floor(user.createdTimestamp / 1000)}:R>)`, inline: false },
        { name: '📥 A rejoint le serveur le', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>\n(<t:${Math.floor(member.joinedTimestamp / 1000)}:R>)`, inline: false },
        { name: '📊 Position d\'arrivée', value: `${joinPosition}e membre à rejoindre`, inline: true },
        { name: '🎖️ Badges', value: badges, inline: false },
        { name: `👥 Rôles [${member.roles.cache.size - 1}]`, value: roles, inline: false }
      )
      .setFooter({ text: `Demandé par ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
      .setTimestamp();
    
    // Ajouter des statuts si présents
    if (member.presence) {
      const statusMap = {
        online: '🟢 En ligne',
        idle: '🟠 Inactif',
        dnd: '🔴 Ne pas déranger',
        offline: '⚫ Hors ligne/Invisible'
      };
      
      let statusText = statusMap[member.presence.status] || '⚫ Inconnu';
      let activities = '';
      
      if (member.presence.activities && member.presence.activities.length > 0) {
        for (const activity of member.presence.activities) {
          switch (activity.type) {
            case 0: activities += `\n🎮 Joue à **${activity.name}**`; break;
            case 1: activities += `\n📺 Stream **${activity.name}**`; break;
            case 2: activities += `\n🎧 Écoute **${activity.name}**`; break;
            case 3: activities += `\n👀 Regarde **${activity.name}**`; break;
            case 4: activities += `\n🎮 Statut personnalisé: **${activity.state || activity.name}**`; break;
            case 5: activities += `\n🏆 Participe à **${activity.name}**`; break;
          }
        }
      }
      
      if (activities) {
        statusText += activities;
      }
      
      infoEmbed.addFields({ name: '🟢 Statut', value: statusText, inline: false });
    }
    
    await interaction.reply({ embeds: [infoEmbed] });
  }
  
  // Commande /ping
  else if (commandName === 'ping') {
    const sent = await interaction.reply({ content: '🏓 Calcul du ping...', fetchReply: true });
    const pingEmbed = new EmbedBuilder()
      .setColor('#FFC83D')
      .setTitle('🏓 Pong!')
      .addFields(
        { name: '⏱️ Latence', value: `${sent.createdTimestamp - interaction.createdTimestamp}ms`, inline: true },
        { name: '💓 Latence API', value: `${Math.round(client.ws.ping)}ms`, inline: true }
      )
      .setFooter({ text: 'Pineapple Bot' })
      .setTimestamp();
    
    await interaction.editReply({ content: null, embeds: [pingEmbed] });
  }
  
  // Commande /ban
  else if (commandName === 'ban') {
    // Vérifier si l'utilisateur a les permissions nécessaires
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return interaction.reply({
        content: '⛔ Tu n\'as pas la permission de bannir des membres!',
        ephemeral: true
      });
    }
    
    const user = interaction.options.getUser('membre');
    const reason = interaction.options.getString('raison') || 'Aucune raison fournie';
    
    try {
      // Bannir le membre
      await interaction.guild.members.ban(user, { reason });
      
      // Créer un embed de confirmation
      const banEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🔨 Membre banni')
        .setDescription(`**${user.tag}** a été banni du serveur.`)
        .addFields(
          { name: '🛑 Raison', value: reason }
        )
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: `Banni par ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();
      
      await interaction.reply({ embeds: [banEmbed] });
    } catch (error) {
      console.error('Erreur lors du bannissement:', error);
      await interaction.reply({
        content: `❌ Je n'ai pas pu bannir ${user.tag}. Vérifie mes permissions ou sa position hiérarchique.`,
        ephemeral: true
      });
    }
  }
  
  // Commande /kick
  else if (commandName === 'kick') {
    // Vérifier si l'utilisateur a les permissions nécessaires
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
      return interaction.reply({
        content: '⛔ Tu n\'as pas la permission d\'expulser des membres!',
        ephemeral: true
      });
    }
    
    const user = interaction.options.getUser('membre');
    const reason = interaction.options.getString('raison') || 'Aucune raison fournie';
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    
    if (!member) {
      return interaction.reply({
        content: '❌ Ce membre n\'est pas sur le serveur!',
        ephemeral: true
      });
    }
    
    try {
      // Expulser le membre
      await member.kick(reason);
      
      // Créer un embed de confirmation
      const kickEmbed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('👢 Membre expulsé')
        .setDescription(`**${user.tag}** a été expulsé du serveur.`)
        .addFields(
          { name: '🛑 Raison', value: reason }
        )
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: `Expulsé par ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();
      
      await interaction.reply({ embeds: [kickEmbed] });
    } catch (error) {
      console.error('Erreur lors de l\'expulsion:', error);
      await interaction.reply({
        content: `❌ Je n'ai pas pu expulser ${user.tag}. Vérifie mes permissions ou sa position hiérarchique.`,
        ephemeral: true
      });
    }
  }
  
  // Commande /timeout
  else if (commandName === 'timeout') {
    // Vérifier si l'utilisateur a les permissions nécessaires
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return interaction.reply({
        content: '⛔ Tu n\'as pas la permission de modérer des membres!',
        ephemeral: true
      });
    }
    
    const user = interaction.options.getUser('membre');
    const minutes = interaction.options.getInteger('duree');
    const reason = interaction.options.getString('raison') || 'Aucune raison fournie';
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    
    if (!member) {
      return interaction.reply({
        content: '❌ Ce membre n\'est pas sur le serveur!',
        ephemeral: true
      });
    }
    
    try {
      // Mettre le membre en timeout
      await member.timeout(minutes * 60 * 1000, reason);
      
      // Formater la durée pour l'affichage
      let formattedDuration = '';
      if (minutes < 60) {
        formattedDuration = `${minutes} minute(s)`;
      } else if (minutes < 1440) {
        const hours = Math.floor(minutes / 60);
        const leftMinutes = minutes % 60;
        formattedDuration = `${hours} heure(s)${leftMinutes > 0 ? ` et ${leftMinutes} minute(s)` : ''}`;
      } else {
        const days = Math.floor(minutes / 1440);
        const leftHours = Math.floor((minutes % 1440) / 60);
        formattedDuration = `${days} jour(s)${leftHours > 0 ? ` et ${leftHours} heure(s)` : ''}`;
      }
      
      // Créer un embed de confirmation
      const timeoutEmbed = new EmbedBuilder()
        .setColor('#FFC83D')
        .setTitle('⏰ Membre mis en timeout')
        .setDescription(`**${user.tag}** a été mis en timeout pour ${formattedDuration}.`)
        .addFields(
          { name: '🛑 Raison', value: reason }
        )
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: `Mis en timeout par ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();
      
      await interaction.reply({ embeds: [timeoutEmbed] });
    } catch (error) {
      console.error('Erreur lors du timeout:', error);
      await interaction.reply({
        content: `❌ Je n'ai pas pu mettre ${user.tag} en timeout. Vérifie mes permissions ou sa position hiérarchique.`,
        ephemeral: true
      });
    }
  }
  
  // Commande /stats
  else if (commandName === 'stats') {
    const guild = interaction.guild;
    
    // Collecter des statistiques
    const totalMembers = guild.memberCount;
    const onlineMembers = guild.members.cache.filter(m => m.presence?.status === 'online').size;
    const bots = guild.members.cache.filter(m => m.user.bot).size;
    const humans = totalMembers - bots;
    const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
    const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
    const categoryChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;
    const roles = guild.roles.cache.size;
    const emojis = guild.emojis.cache.size;
    const createdAt = guild.createdAt;
    
    // Créer un embed avec les statistiques
    const statsEmbed = new EmbedBuilder()
      .setColor('#FFC83D')
      .setTitle(`📊 Statistiques de ${guild.name}`)
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .addFields(
        { name: '👥 Membres', value: `Total: ${totalMembers}\nHumains: ${humans}\nBots: ${bots}\nEn ligne: ${onlineMembers}`, inline: true },
        { name: '📝 Salons', value: `Textuels: ${textChannels}\nVocaux: ${voiceChannels}\nCatégories: ${categoryChannels}\nTotal: ${textChannels + voiceChannels + categoryChannels}`, inline: true },
        { name: '🎭 Autres', value: `Rôles: ${roles}\nEmojis: ${emojis}`, inline: true },
        { name: '📅 Créé le', value: `<t:${Math.floor(createdAt.getTime() / 1000)}:F>\n(<t:${Math.floor(createdAt.getTime() / 1000)}:R>)`, inline: false }
      )
      .setFooter({ text: `ID du serveur: ${guild.id}` })
      .setTimestamp();
    
    await interaction.reply({ embeds: [statsEmbed] });
  }
  
  // Commande /rolelog
  else if (commandName === 'rolelog') {
    // Vérifier si l'utilisateur a les permissions nécessaires
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({
        content: '⛔ Tu n\'as pas la permission d\'utiliser cette commande! Seuls les administrateurs peuvent l\'utiliser.',
        ephemeral: true
      });
    }
    
    const state = interaction.options.getString('etat');
    
    if (state === 'on') {
      client.roleLogEnabled = true;
      await interaction.reply({
        content: '✅ Le log des changements de rôles a été activé! Je vais maintenant enregistrer tous les changements de rôles dans ce salon.',
        ephemeral: false
      });
    } else {
      client.roleLogEnabled = false;
      await interaction.reply({
        content: '❌ Le log des changements de rôles a été désactivé!',
        ephemeral: false
      });
    }
  }
  
  // Commande /giveaway
  else if (commandName === 'giveaway') {
    // Vérifier si l'utilisateur a les permissions nécessaires
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageEvents)) {
      return interaction.reply({
        content: '⛔ Tu n\'as pas la permission de créer des giveaways!',
        ephemeral: true
      });
    }
    
    const duration = interaction.options.getInteger('duree');
    const winnerCount = interaction.options.getInteger('gagnants');
    const prize = interaction.options.getString('prix');
    const channel = interaction.options.getChannel('salon') || interaction.channel;
    
    if (channel.type !== ChannelType.GuildText) {
      return interaction.reply({
        content: '❌ Le giveaway ne peut être créé que dans un salon textuel!',
        ephemeral: true
      });
    }
    
    // Calculer le temps de fin
    const endTime = Date.now() + duration * 60 * 1000;
    
    // Créer un embed pour le giveaway
    const giveawayEmbed = new EmbedBuilder()
      .setColor('#FFC83D')
      .setTitle('🎉 GIVEAWAY 🎉')
      .setDescription(`
      **Prix: ${prize}**
      
      Réagissez avec 🎉 pour participer!
      
      **Fin:** <t:${Math.floor(endTime / 1000)}:R>
      **Nombre de gagnants:** ${winnerCount}
      **Créé par:** <@${interaction.user.id}>
      `)
      .setFooter({ text: 'Pineapple Giveaway' })
      .setTimestamp(endTime);
    
    try {
      // Envoyer l'embed dans le salon choisi
      const message = await channel.send({ embeds: [giveawayEmbed] });
      
      // Ajouter la réaction 🎉
      await message.react('🎉');
      
      // Stocker les informations du giveaway
      giveaways.set(message.id, {
        prize,
        winnerCount,
        endTime,
        channelId: channel.id,
        guildId: interaction.guild.id,
        messageId: message.id
      });
      
      // Confirmer la création du giveaway
      await interaction.reply({
        content: `✅ Giveaway créé avec succès dans le salon ${channel}!`,
        ephemeral: true
      });
    } catch (error) {
      console.error('Erreur lors de la création du giveaway:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue lors de la création du giveaway.',
        ephemeral: true
      });
    }
  }
  
  // Commande /setup-ticket
  else if (commandName === 'setup-ticket') {
    // Vérifier si l'utilisateur a les permissions nécessaires
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({
        content: '⛔ Tu n\'as pas la permission de configurer le système de tickets!',
        ephemeral: true
      });
    }
    
    const channel = interaction.options.getChannel('salon');
    const staffRole = interaction.options.getRole('role_staff');
    
    if (channel.type !== ChannelType.GuildText) {
      return interaction.reply({
        content: '❌ Le système de tickets ne peut être configuré que dans un salon textuel!',
        ephemeral: true
      });
    }
    
    try {
      // Créer la catégorie pour les tickets si elle n'existe pas déjà
      let ticketCategory = interaction.guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === 'TICKETS');
      
      if (!ticketCategory) {
        ticketCategory = await interaction.guild.channels.create({
          name: 'TICKETS',
          type: ChannelType.GuildCategory,
          permissionOverwrites: [
            {
              id: interaction.guild.id,
              deny: [PermissionsBitField.Flags.ViewChannel]
            },
            {
              id: staffRole.id,
              allow: [PermissionsBitField.Flags.ViewChannel]
            }
          ]
        });
      }
      
      // Créer la catégorie pour les archives si elle n'existe pas déjà
      let archiveCategory = interaction.guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === 'ARCHIVES-TICKETS');
      
      if (!archiveCategory) {
        archiveCategory = await interaction.guild.channels.create({
          name: 'ARCHIVES-TICKETS',
          type: ChannelType.GuildCategory,
          permissionOverwrites: [
            {
              id: interaction.guild.id,
              deny: [PermissionsBitField.Flags.ViewChannel]
            },
            {
              id: staffRole.id,
              allow: [PermissionsBitField.Flags.ViewChannel]
            }
          ]
        });
      }
      
      // Créer les boutons
      const ticketRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('create_collab_ticket')
            .setLabel('Collaboration/Partenariat')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🤝'),
          new ButtonBuilder()
            .setCustomId('create_help_ticket')
            .setLabel('Aide')
            .setStyle(ButtonStyle.Success)
            .setEmoji('❓')
        );
      
      // Créer l'embed
      const ticketEmbed = new EmbedBuilder()
        .setColor('#FFC83D')
        .setTitle('🎫 Système de Tickets')
        .setDescription(`
        Bienvenue dans notre système de tickets! Choisissez une catégorie ci-dessous:
        
        **🤝 Collaboration/Partenariat**
        Pour discuter d'une collaboration ou d'un partenariat avec notre serveur.
        
        **❓ Aide**
        Si vous avez besoin d'aide ou si vous avez des questions concernant le serveur.
        
        Cliquez sur un des boutons ci-dessous pour créer un ticket.
        `)
        .setFooter({ text: '🍍 Pineapple - Serveur Pub 🍍' })
        .setTimestamp();
      
      // Envoyer le message dans le salon choisi
      const ticketMessage = await channel.send({
        embeds: [ticketEmbed],
        components: [ticketRow]
      });
      
      // Sauvegarder les données
      ticketData = {
        categoryId: ticketCategory.id,
        channelId: channel.id,
        guildId: interaction.guild.id,
        messageId: ticketMessage.id,
        staffRoleId: staffRole.id,
        archiveCategoryId: archiveCategory.id
      };
      
      saveTicketData();
      
      await interaction.reply({
        content: `✅ Système de tickets configuré avec succès dans le salon ${channel}!`,
        ephemeral: true
      });
    } catch (error) {
      console.error('Erreur lors de la configuration du système de tickets:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue lors de la configuration du système de tickets.',
        ephemeral: true
      });
    }
  }
  
  // Commande /message
  else if (commandName === 'message') {
    // Vérifier si l'utilisateur a les permissions nécessaires
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({
        content: '⛔ Tu n\'as pas la permission d\'utiliser cette commande!',
        ephemeral: true
      });
    }
    
    const channel = interaction.options.getChannel('salon');
    const content = interaction.options.getString('contenu');
    const color = interaction.options.getString('couleur') || '#FFC83D';
    const title = interaction.options.getString('titre');
    const image = interaction.options.getString('image');
    
    if (channel.type !== ChannelType.GuildText) {
      return interaction.reply({
        content: '❌ Le message ne peut être envoyé que dans un salon textuel!',
        ephemeral: true
      });
    }
    
    try {
      // Si un titre est fourni, créer un embed
      if (title) {
        const embed = new EmbedBuilder()
          .setColor(color)
          .setTitle(title)
          .setDescription(content)
          .setFooter({ text: '🍍 Pineapple - Serveur Pub 🍍' })
          .setTimestamp();
        
        if (image) {
          embed.setImage(image);
        }
        
        await channel.send({ embeds: [embed] });
      } else {
        // Sinon, envoyer un message simple
        await channel.send({ content });
      }
      
      await interaction.reply({
        content: `✅ Message envoyé avec succès dans ${channel}!`,
        ephemeral: true
      });
    } catch (error) {
      console.error('Erreur lors de l\'envoi du message:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue lors de l\'envoi du message.',
        ephemeral: true
      });
    }
  }
  
  // Commande /setup-counter
  else if (commandName === 'setup-counter') {
    // Vérifier si l'utilisateur a les permissions nécessaires
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({
        content: '⛔ Tu n\'as pas la permission de configurer le compteur de membres!',
        ephemeral: true
      });
    }
    
    const category = interaction.options.getChannel('catégorie');
    
    if (category.type !== ChannelType.GuildCategory) {
      return interaction.reply({
        content: '❌ Tu dois sélectionner une catégorie!',
        ephemeral: true
      });
    }
    
    try {
      // Créer ou mettre à jour le salon vocal
      let counterChannel;
      
      if (memberCountChannelId) {
        const existingChannel = interaction.guild.channels.cache.get(memberCountChannelId);
        if (existingChannel) {
          await existingChannel.delete();
        }
      }
      
      // Créer un nouveau salon vocal
      counterChannel = await interaction.guild.channels.create({
        name: `🤖〃commande : ${interaction.guild.memberCount}_membres`,
        type: ChannelType.GuildVoice,
        parent: category,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionsBitField.Flags.Connect]
          }
        ]
      });
      
      memberCountChannelId = counterChannel.id;
      saveMemberCounterData();
      
      await interaction.reply({
        content: `✅ Compteur de membres configuré avec succès!\nLe salon vocal "${counterChannel.name}" a été créé et sera mis à jour automatiquement.`,
        ephemeral: true
      });
    } catch (error) {
      console.error('Erreur lors de la configuration du compteur de membres:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue lors de la configuration du compteur de membres.',
        ephemeral: true
      });
    }
  }
  
  // Commande /announce
  else if (commandName === 'announce') {
    // Vérifier si l'utilisateur a les permissions nécessaires
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({
        content: '⛔ Tu n\'as pas la permission de faire des annonces!',
        ephemeral: true
      });
    }
    
    const channel = interaction.options.getChannel('salon');
    const title = interaction.options.getString('titre');
    const content = interaction.options.getString('contenu');
    const image = interaction.options.getString('image');
    const ping = interaction.options.getString('ping') || 'none';
    
    if (channel.type !== ChannelType.GuildText) {
      return interaction.reply({
        content: '❌ L\'annonce ne peut être envoyée que dans un salon textuel!',
        ephemeral: true
      });
    }
    
    try {
      // Créer l'embed de l'annonce
      const announceEmbed = new EmbedBuilder()
        .setColor('#FFC83D')
        .setTitle(title)
        .setDescription(content)
        .setFooter({ text: `Annonce par ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();
      
      if (image) {
        announceEmbed.setImage(image);
      }
      
      // Déterminer la mention
      let pingContent = '';
      
      if (ping === 'everyone') {
        pingContent = '@everyone';
      } else if (ping === 'here') {
        pingContent = '@here';
      }
      
      // Envoyer l'annonce
      await channel.send({
        content: pingContent,
        embeds: [announceEmbed],
        allowedMentions: {
          parse: ping !== 'none' ? [ping] : []
        }
      });
      
      await interaction.reply({
        content: `✅ Annonce envoyée avec succès dans ${channel}!`,
        ephemeral: true
      });
    } catch (error) {
      console.error('Erreur lors de l\'envoi de l\'annonce:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue lors de l\'envoi de l\'annonce.',
        ephemeral: true
      });
    }
  }
  
  // Commande /poll
else if (commandName === 'poll') {
  // Vérifier si l'utilisateur a les permissions nécessaires
  if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
    return interaction.reply({
      content: '⛔ Tu n\'as pas la permission de créer des sondages!',
      ephemeral: true
    });
  }
  
  // Utiliser deferReply pour éviter le timeout de l'interaction
  await interaction.deferReply();
  
  const question = interaction.options.getString('question');
  
  // Récupérer toutes les options
  const options = [];
  for (let i = 1; i <= 10; i++) {
    const option = interaction.options.getString(`option${i}`);
    if (option) {
      options.push(option);
    }
  }
  
  if (options.length < 2) {
    return interaction.editReply({
      content: '❌ Un sondage doit avoir au moins 2 options!',
    });
  }
  
  try {
    // Définir directement les emojis sans fonction externe
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    
    // Couleurs associées à chaque option
    const colors = ['🟥', '🟦', '🟩', '🟨', '🟪', '🟧', '⬛', '⬜', '🟫', '🔴'];
    
    // Créer l'embed initial du sondage sans résultats
    const pollEmbed = new EmbedBuilder()
      .setColor('#FFC83D')
      .setTitle(`📊 ${question}`)
      .setDescription(`*Votez en cliquant sur les réactions ci-dessous!*\n\n${options.map((option, index) => `${emojis[index]} ${option}`).join('\n\n')}`)
      .setFooter({ text: `Sondage créé par ${interaction.user.tag} • Les résultats seront mis à jour toutes les minutes`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
      .setTimestamp();
    
    // Envoyer le sondage
    const pollMessage = await interaction.channel.send({ embeds: [pollEmbed] });
    
    // Ajouter les réactions
    for (let i = 0; i < options.length; i++) {
      await pollMessage.react(emojis[i]);
      // Ajouter un court délai entre chaque réaction pour éviter les limites de taux
      await new Promise(resolve => setTimeout(resolve, 350));
    }
    
    await interaction.editReply({
      content: '✅ Sondage créé avec succès!',
    });
    
    // Fonction pour mettre à jour les résultats du sondage
const updateResults = async () => {
  try {
    // Récupérer le message du sondage avec les réactions mises à jour
    const updatedMessage = await interaction.channel.messages.fetch(pollMessage.id);
    
    // Compter les votes pour chaque option
    const results = [];
    let totalVotes = 0;
    
    for (let i = 0; i < options.length; i++) {
      // Récupérer la réaction avec fetch pour avoir les données les plus récentes
      const reaction = updatedMessage.reactions.cache.get(emojis[i]);
      
      if (reaction) {
        // Récupérer tous les utilisateurs qui ont réagi
        const users = await reaction.users.fetch();
        // Compter les utilisateurs qui ne sont pas des bots
        const count = users.filter(user => !user.bot).size;
        
        results.push({ option: options[i], votes: count, emoji: emojis[i], color: colors[i] });
        totalVotes += count;
      } else {
        results.push({ option: options[i], votes: 0, emoji: emojis[i], color: colors[i] });
      }
    }
    
    // Trier les résultats par nombre de votes (du plus élevé au plus bas)
    results.sort((a, b) => b.votes - a.votes);
    
    // Créer les barres de progression graphiques
    let resultText = '';
    
    if (totalVotes === 0) {
      resultText = "*Aucun vote pour l'instant*";
    } else {
      for (const result of results) {
        const percentage = totalVotes > 0 ? (result.votes / totalVotes) * 100 : 0;
        const barLength = Math.round(percentage / 5); // 5% par emoji dans la barre
        
        // Créer la barre de progression avec les émojis de couleur
        const progressBar = result.color.repeat(barLength) + '⬜'.repeat(20 - barLength);
        
        resultText += `${result.emoji} **${result.option}**\n`;
        resultText += `${progressBar} (${result.votes} vote${result.votes !== 1 ? 's' : ''} - ${percentage.toFixed(1)}%)\n\n`;
      }
    }
    
    // Créer un nouvel embed avec les résultats mis à jour
    const updatedEmbed = new EmbedBuilder()
      .setColor('#FFC83D')
      .setTitle(`📊 ${question}`)
      .setDescription(`*Votez en cliquant sur les réactions ci-dessous!*\n\n${resultText}`)
      .setFooter({ text: `Sondage créé par ${interaction.user.tag} • Total: ${totalVotes} vote${totalVotes !== 1 ? 's' : ''} • Mis à jour ${new Date().toLocaleTimeString()}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
      .setTimestamp();
    
    // Mettre à jour l'embed du sondage
    await updatedMessage.edit({ embeds: [updatedEmbed] });
    
    console.log(`Sondage mis à jour: ${totalVotes} votes au total`);
  } catch (error) {
    console.error('Erreur lors de la mise à jour des résultats du sondage:', error);
  }
};
    
    // Mettre à jour les résultats immédiatement puis toutes les minutes
    await updateResults();
    
    // Créer un intervalle pour mettre à jour les résultats toutes les minutes
    const resultsInterval = setInterval(updateResults, 100);
    
    // Arrêter l'intervalle après 24 heures (pour éviter de laisser des intervalles actifs indéfiniment)
    setTimeout(() => {
      clearInterval(resultsInterval);
    }, 86400000); // 24 heures
    
  } catch (error) {
    console.error('Erreur lors de la création du sondage:', error);
    try {
      await interaction.editReply({
        content: '❌ Une erreur est survenue lors de la création du sondage.',
      });
    } catch (followUpError) {
      console.error('Erreur lors de la réponse d\'erreur:', followUpError);
    }
  }
}
  
  // Commande /embed
  else if (commandName === 'embed') {
    // Vérifier si l'utilisateur a les permissions nécessaires
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({
        content: '⛔ Tu n\'as pas la permission de créer des embeds!',
        ephemeral: true
      });
    }
    
    const channel = interaction.options.getChannel('salon');
    const title = interaction.options.getString('titre');
    const description = interaction.options.getString('description');
    const color = interaction.options.getString('couleur') || '#FFC83D';
    const image = interaction.options.getString('image');
    const thumbnail = interaction.options.getString('thumbnail');
    const footer = interaction.options.getString('footer');
    
    if (channel.type !== ChannelType.GuildText) {
      return interaction.reply({
        content: '❌ L\'embed ne peut être envoyé que dans un salon textuel!',
        ephemeral: true
      });
    }
    
    try {
      // Créer l'embed
      const customEmbed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description)
        .setTimestamp();
      
      if (image) {
        customEmbed.setImage(image);
      }
      
      if (thumbnail) {
        customEmbed.setThumbnail(thumbnail);
      }
      
      if (footer) {
        customEmbed.setFooter({ text: footer });
      }
      
      // Envoyer l'embed
      await channel.send({ embeds: [customEmbed] });
      
      await interaction.reply({
        content: `✅ Embed créé avec succès dans ${channel}!`,
        ephemeral: true
      });
    } catch (error) {
      console.error('Erreur lors de la création de l\'embed:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue lors de la création de l\'embed.',
        ephemeral: true
      });
    }
  }
  
  // Commande /usercount
  else if (commandName === 'usercount') {
    const guild = interaction.guild;
    
    try {
      // Créer l'embed des statistiques de croissance
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const createdLast7Days = guild.members.cache
        .filter(member => member.joinedTimestamp > oneWeekAgo.getTime())
        .size;
        
      const createdLast30Days = guild.members.cache
        .filter(member => member.joinedTimestamp > oneMonthAgo.getTime())
        .size;
      
      const userCountEmbed = new EmbedBuilder()
        .setColor('#FFC83D')
        .setTitle(`📈 Statistiques de croissance de ${guild.name}`)
        .setThumbnail(guild.iconURL({ dynamic: true }))
        .addFields(
          { name: '👥 Membres actuels', value: guild.memberCount.toString(), inline: false },
          { name: '📆 Nouveaux membres (7 derniers jours)', value: createdLast7Days.toString(), inline: true },
          { name: '📆 Nouveaux membres (30 derniers jours)', value: createdLast30Days.toString(), inline: true },
          { name: '📊 Taux de croissance hebdomadaire', value: `${((createdLast7Days / guild.memberCount) * 100).toFixed(2)}%`, inline: true },
          { name: '📊 Taux de croissance mensuel', value: `${((createdLast30Days / guild.memberCount) * 100).toFixed(2)}%`, inline: true }
        )
        .setFooter({ text: '🍍 Pineapple - Serveur Pub 🍍' })
        .setTimestamp();
      
      await interaction.reply({ embeds: [userCountEmbed] });
    } catch (error) {
      console.error('Erreur lors de l\'affichage des statistiques de croissance:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue lors de l\'affichage des statistiques.',
        ephemeral: true
      });
    }
  }
  
  // Commande /reminder
  else if (commandName === 'reminder') {
    const minutes = interaction.options.getInteger('temps');
    const message = interaction.options.getString('message');
    
    // Calculer le temps de fin
    const endTime = Date.now() + minutes * 60 * 1000;
    
    try {
      // Ajouter le rappel à la collection
      const reminderId = Date.now().toString();
      reminders.set(reminderId, {
        userId: interaction.user.id,
        message,
        endTime,
        createdAt: Date.now()
      });
      
      // Formater la durée pour l'affichage
      let formattedTime = '';
      if (minutes < 60) {
        formattedTime = `${minutes} minute(s)`;
      } else if (minutes < 1440) {
        const hours = Math.floor(minutes / 60);
        const leftMinutes = minutes % 60;
        formattedTime = `${hours} heure(s)${leftMinutes > 0 ? ` et ${leftMinutes} minute(s)` : ''}`;
      } else {
        const days = Math.floor(minutes / 1440);
        const leftHours = Math.floor((minutes % 1440) / 60);
        formattedTime = `${days} jour(s)${leftHours > 0 ? ` et ${leftHours} heure(s)` : ''}`;
      }
      
      // Confirmer la création du rappel
      const reminderEmbed = new EmbedBuilder()
        .setColor('#FFC83D')
        .setTitle('⏰ Rappel créé')
        .setDescription(`
        Je te rappellerai dans **${formattedTime}**.
        
        **Message:** ${message}
        
        **Date:** <t:${Math.floor(endTime / 1000)}:F>
        `)
        .setFooter({ text: '🍍 Pineapple - Serveur Pub 🍍' })
        .setTimestamp();
      
      await interaction.reply({ embeds: [reminderEmbed], ephemeral: true });
    } catch (error) {
      console.error('Erreur lors de la création du rappel:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue lors de la création du rappel.',
        ephemeral: true
      });
    }
  }
  
  // Commande /servericon
  else if (commandName === 'servericon') {
    const guild = interaction.guild;
    
    if (!guild.iconURL()) {
      return interaction.reply({
        content: '❌ Ce serveur n\'a pas d\'icône!',
        ephemeral: true
      });
    }
    
    try {
      const iconEmbed = new EmbedBuilder()
        .setColor('#FFC83D')
        .setTitle(`Icône de ${guild.name}`)
        .setImage(guild.iconURL({ dynamic: true, size: 4096 }))
        .setFooter({ text: '🍍 Pineapple - Serveur Pub 🍍' })
        .setTimestamp();
      
      await interaction.reply({ embeds: [iconEmbed] });
    } catch (error) {
      console.error('Erreur lors de l\'affichage de l\'icône:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue lors de l\'affichage de l\'icône.',
        ephemeral: true
      });
    }
  }
  
  // Commande /servbanner
  else if (commandName === 'servbanner') {
    const guild = interaction.guild;
    
    if (!guild.bannerURL()) {
      return interaction.reply({
        content: '❌ Ce serveur n\'a pas de bannière!',
        ephemeral: true
      });
    }
    
    try {
      const bannerEmbed = new EmbedBuilder()
        .setColor('#FFC83D')
        .setTitle(`Bannière de ${guild.name}`)
        .setImage(guild.bannerURL({ dynamic: true, size: 4096 }))
        .setFooter({ text: '🍍 Pineapple - Serveur Pub 🍍' })
        .setTimestamp();
      
      await interaction.reply({ embeds: [bannerEmbed] });
    } catch (error) {
      console.error('Erreur lors de l\'affichage de la bannière:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue lors de l\'affichage de la bannière.',
        ephemeral: true
      });
    }
  }
  
  // Commande /avatar
  else if (commandName === 'avatar') {
    const user = interaction.options.getUser('utilisateur') || interaction.user;
    
    try {
      const avatarEmbed = new EmbedBuilder()
        .setColor('#FFC83D')
        .setTitle(`Avatar de ${user.tag}`)
        .setImage(user.displayAvatarURL({ dynamic: true, size: 4096 }))
        .setFooter({ text: '🍍 Pineapple - Serveur Pub 🍍' })
        .setTimestamp();
      
      await interaction.reply({ embeds: [avatarEmbed] });
    } catch (error) {
      console.error('Erreur lors de l\'affichage de l\'avatar:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue lors de l\'affichage de l\'avatar.',
        ephemeral: true
      });
    }
  }

// Gestionnaire pour la commande /templates
else if (commandName === 'templates') {
  // Vérifier si l'utilisateur a les permissions nécessaires
  if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return interaction.reply({
      content: '⛔ Tu n\'as pas la permission d\'utiliser cette commande!',
      ephemeral: true
    });
  }
  
  const templateType = interaction.options.getString('type');
  const channel = interaction.options.getChannel('salon');
  
  if (channel.type !== ChannelType.GuildText) {
    return interaction.reply({
      content: '❌ Le template ne peut être posté que dans un salon textuel!',
      ephemeral: true
    });
  }
  
  try {
    let content = '';
    
    // Sélectionner le template en fonction du type choisi
    switch (templateType) {
      case 'rules':
        content = `# 📜 RÈGLEMENT DU SERVEUR PINEAPPLE 🍍

## ✨ INTRODUCTION

Bienvenue sur le serveur Pineapple! Ce règlement a été créé pour assurer une expérience agréable pour tous. En rejoignant notre serveur, vous acceptez de respecter ces règles.

## 📋 RÈGLES GÉNÉRALES

### 1️⃣ RESPECT MUTUEL
• Traitez tous les membres avec respect et courtoisie
• Aucune discrimination, harcèlement ou discours haineux ne sera toléré
• Évitez les propos offensants, racistes, homophobes, ou sexistes

### 2️⃣ CONTENU APPROPRIÉ
• Pas de contenu NSFW/18+ (images, liens, discussions)
• Pas de contenu violent ou choquant
• Pas de promotion de contenus illégaux ou de piratage
• Pas de spam ou flood dans les salons

### 3️⃣ PROFIL ET COMPORTEMENT
• Utilisez un pseudo approprié et non offensant
• Vos photos de profil et bannières doivent être adaptées à tous
• N'usurpez pas l'identité d'autres membres ou du staff`;
        break;
        
      case 'partnership':
        content = `# 🤝 CONDITIONS DE PARTENARIAT - SERVEUR PINEAPPLE 🍍

## ✨ QU'EST-CE QU'UN PARTENARIAT?

Un partenariat est une relation officielle entre le serveur Pineapple et un autre serveur Discord, où les deux parties s'engagent à promouvoir mutuellement leur communauté et à établir une collaboration durable et bénéfique.

## 📋 CRITÈRES D'ÉLIGIBILITÉ

Pour devenir partenaire du serveur Pineapple, votre serveur doit remplir les conditions suivantes:

### 📊 EXIGENCES TECHNIQUES
• Un minimum de 250 membres actifs
• Une communauté établie depuis au moins 1 mois
• Un taux d'engagement régulier (messages, interactions)
• Un design soigné et une organisation claire des salons
• Une équipe de modération active et réactive`;
        break;
        
      case 'promo':
        content = `# 🍍 SERVEUR PINEAPPLE - LA RÉFÉRENCE POUR PROMOUVOIR VOTRE CONTENU DISCORD 🍍

## ✨ QUI SOMMES-NOUS?

**Pineapple** est une communauté Discord dédiée à la promotion et à la visibilité de vos projets! Notre objectif est simple: vous offrir une plateforme performante pour faire connaître votre serveur, trouver des partenaires et développer votre audience.

## 🚀 POURQUOI NOUS REJOINDRE?

### 📊 UNE VISIBILITÉ MAXIMALE
• Des salons de publicité organisés par thématique
• Un système de modération qui assure des publicités de qualité
• Une communauté active qui interagit avec votre contenu`;
        break;
        
      case 'guide':
        content = `# 📚 GUIDE COMPLET DU SERVEUR PINEAPPLE 🍍

Bienvenue sur le guide officiel de Pineapple - Serveur Pub! Ce guide vous aidera à comprendre comment tirer le meilleur parti de notre communauté.

## 🚀 COMMENT UTILISER NOS SALONS DE PROMOTION

**Nos différents salons de promotion:**
• 📱 \`#pub-serveurs\` - Pour promouvoir vos serveurs Discord
• 🎮 \`#pub-jeux\` - Pour les serveurs de jeux vidéo
• 🎵 \`#pub-création\` - Pour partager votre contenu créatif
• 💼 \`#pub-bots\` - Pour présenter vos bots Discord
• 🌐 \`#pub-réseaux\` - Pour promouvoir vos réseaux sociaux`;
        break;
        
      default:
        return interaction.reply({
          content: '❌ Type de template invalide!',
          ephemeral: true
        });
    }
    
    // Fonction pour découper le contenu en morceaux de 2000 caractères maximum
    function splitContent(text) {
      const chunks = [];
      let currentChunk = "";
      
      // Diviser par lignes
      const lines = text.split('\n');
      
      for (const line of lines) {
        // Si la ligne est trop longue pour être ajoutée au morceau actuel
        if (currentChunk.length + line.length + 1 > 1950) { // marge de sécurité
          chunks.push(currentChunk);
          currentChunk = line;
        } else {
          if (currentChunk.length > 0) {
            currentChunk += '\n' + line;
          } else {
            currentChunk = line;
          }
        }
      }
      
      // Ajouter le dernier morceau
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
      }
      
      return chunks;
    }
    
    // Diviser le contenu en plusieurs morceaux si nécessaire
    const contentChunks = splitContent(content);
    
    // Ajouter les parties supplémentaires selon le template
    if (templateType === 'rules') {
      contentChunks.push(`## 🔊 RÈGLES DES PUBLICITÉS

### 1️⃣ SALONS DE PUBLICITÉ
• Publiez uniquement dans les salons dédiés à la publicité
• Respectez la thématique de chaque salon de publicité
• Une publicité par personne toutes les 12 heures par salon
• Les publicités doivent être claires et bien présentées

### 2️⃣ CONTENU INTERDIT DANS LES PUBLICITÉS
• Serveurs proposant du contenu NSFW/18+
• Serveurs promouvant des activités illégales
• Serveurs incitant à la haine ou à la discrimination
• Arnaques, phishing ou liens malveillants
• Publicités contenant @everyone ou @here`);

      contentChunks.push(`### 3️⃣ FORMAT DES PUBLICITÉS
• Présentez clairement l'objectif de votre serveur
• Évitez les titres trompeurs ou clickbait
• Vérifiez que vos liens d'invitation sont valides et permanents
• Les publicités trop longues ou mal formatées pourront être supprimées

## 🤝 PARTENARIATS & COLLABORATIONS

• Les demandes de partenariat doivent être adressées via le système de tickets
• Votre serveur doit avoir un minimum de 100 membres actifs
• Le contenu de votre serveur doit être conforme à nos valeurs
• Les échanges de publicité sans partenariat officiel sont interdits dans les MP`);

      contentChunks.push(`## ⚠️ SANCTIONS

Le non-respect de ces règles pourra entraîner les sanctions suivantes, selon la gravité et la récurrence:

• Avertissement
• Suppression de la publicité
• Exclusion temporaire des salons de publicité
• Timeout temporaire
• Expulsion du serveur
• Bannissement définitif

## 👑 STAFF & MODÉRATION

• Les décisions du staff sont finales
• Ne mentionnez pas les membres du staff sans raison valable
• Pour toute question ou problème, utilisez le système de tickets
• L'équipe de modération se réserve le droit de sanctionner tout comportement nuisible à la communauté, même si non précisé dans le règlement`);

      contentChunks.push(`## 📝 NOTES ADDITIONNELLES

• L'équipe de modération se réserve le droit de modifier ce règlement à tout moment
• Les règles s'appliquent également aux messages privés concernant le serveur
• En cas de problème avec un autre membre, contactez le staff plutôt que de régler le conflit vous-même

---

**En rejoignant notre serveur, vous acceptez automatiquement de respecter l'ensemble de ces règles.**

Merci de votre compréhension et passez un agréable moment sur Pineapple! 🍍`);
    }
    else if (templateType === 'partnership') {
      contentChunks.push(`### 📜 EXIGENCES DE CONTENU
• Contenu conforme aux Conditions d'Utilisation de Discord
• Thématique claire et bien définie
• Aucun contenu NSFW, illégal ou contraire à nos valeurs
• Une ambiance positive et respectueuse
• Pas d'historique de drama, raids ou comportements toxiques

## 🎁 AVANTAGES DU PARTENARIAT

### 🌟 CE QUE NOUS OFFRONS
• Publication permanente dans notre salon #partenaires
• Promotion régulière dans nos salons d'annonces (une fois par mois)
• Accès à un rôle "Partenaire" pour vos administrateurs sur notre serveur
• Accès à notre salon privé de collaboration entre partenaires
• Participation prioritaire à nos événements communautaires
• Possibilité d'organiser des événements conjoints`);

      contentChunks.push(`### 💼 CE QUE NOUS ATTENDONS
• Publication permanente de notre serveur dans votre salon de partenaires
• Promotion occasionnelle dans vos salons d'annonces (une fois par mois)
• Recommandation active de notre serveur auprès de vos membres
• Communication régulière avec notre équipe de partenariat

## 📝 PROCÉDURE DE DEMANDE

1. Créez un ticket de partenariat via notre système de tickets
2. Remplissez le formulaire de demande de partenariat fourni par notre équipe
3. Fournissez les informations demandées sur votre serveur:
   - Nom et thématique
   - Lien d'invitation permanent (ne devant jamais expirer)
   - Nombre actuel de membres
   - Date de création
   - Description détaillée des activités et contenus
   - Coordonnées des administrateurs (Discord ID)
4. Notre équipe évaluera votre demande dans un délai de 72 heures
5. En cas d'acceptation, nous établirons un accord de partenariat détaillé`);

      contentChunks.push(`## ⚠️ CONDITIONS DE MAINTIEN

Pour maintenir le statut de partenaire, votre serveur doit:

• Conserver un nombre minimum de membres actifs
• Maintenir un environnement sain et respectueux
• Respecter les termes de notre accord de partenariat
• Communiquer régulièrement avec notre équipe de partenariat
• Nous informer de tout changement majeur dans votre serveur

## 🔄 RÉÉVALUATION ET RÉSILIATION

• Les partenariats sont réévalués tous les 3 mois
• Le non-respect des conditions peut entraîner la résiliation du partenariat
• Toute infraction grave à nos valeurs entraînera une résiliation immédiate
• Les deux parties peuvent mettre fin au partenariat avec un préavis de 7 jours`);

      contentChunks.push(`---

Notre objectif est de créer un réseau de partenaires de qualité qui partagent nos valeurs et notre vision. Nous privilégions la qualité à la quantité et cherchons à établir des relations durables et mutuellement bénéfiques.

Si vous avez des questions concernant notre programme de partenariat, n'hésitez pas à contacter notre équipe via le système de tickets.

🍍 L'équipe Pineapple`);
    }
    else if (templateType === 'promo') {
      contentChunks.push(`### 🛠️ DES OUTILS EXCLUSIFS
• Un bot personnalisé avec de nombreuses fonctionnalités
• Un système de tickets pour l'aide et les partenariats
• Des événements réguliers pour booster votre visibilité

### 👥 UNE COMMUNAUTÉ BIENVEILLANTE
• Staff actif et à l'écoute
• Ambiance respectueuse et dynamique
• Entraide entre créateurs de contenus

## 💎 NOS FONCTIONNALITÉS

• **Salons de publicité variés**: serveurs gaming, communautaires, créatifs, etc.
• **Programme de partenariat**: opportunités exclusives pour les serveurs qualifiés
• **Système de suggestions**: votre avis compte pour améliorer notre communauté
• **Giveaways réguliers**: des cadeaux et récompenses pour nos membres
• **Support réactif**: notre équipe répond à vos questions rapidement`);

      contentChunks.push(`## 🔗 COMMENT NOUS PARTAGER?

N'hésitez pas à copier ce message pour promouvoir notre serveur! Plus notre communauté grandit, plus votre contenu gagne en visibilité.

**⭐ LIEN D'INVITATION: ${inviteLink} ⭐**


---

**Rejoignez la communauté Pineapple dès aujourd'hui et donnez à votre serveur la visibilité qu'il mérite!** 🍍`);
    }
    else if (templateType === 'guide') {
      contentChunks.push(`## 📋 RÈGLES À RESPECTER

• Publiez dans les salons appropriés
• Une promotion toutes les 30m par salon
• Pas de contenu NSFW, discriminatoire ou offensant
• Pas de mentions @everyone ou @here dans vos promotions
• Les messages doivent être en français ou en anglais

## ✨ CONSEILS POUR DES PUBS EFFICACES

**1. Soyez créatif**
Une bonne présentation attire l'attention. Utilisez des emojis, une mise en forme soignée et des images attrayantes.

**2. Soyez précis**
Décrivez clairement ce que vous proposez. Plus les membres comprennent votre offre, plus ils sont susceptibles de vous rejoindre.

**3. Mettez en avant vos points forts**
Qu'est-ce qui rend votre serveur unique? Événements spéciaux? Communauté active? Mettez-le en avant!

**4. Invitations permanentes**
Vérifiez que vos liens d'invitation sont valides et n'expirent pas.`);

      contentChunks.push(`## 🔍 COMMENT OBTENIR DE L'AIDE

• Créez un ticket d'assistance via le salon \`#tickets\`
• Contactez un modérateur ou administrateur directement

## 🏆 AVANTAGES POUR LES MEMBRES ACTIFS

• Accès à des salons exclusifs
• Possibilité de devenir partenaire
• Visibilité accrue pour vos promotions
• Participation à nos événements spéciaux

## 💡 ASTUCES POUR GRANDIR

• **Interagissez** avec les autres membres
• **Partagez** notre serveur: ${inviteLink}
• **Participez** aux discussions dans les salons généraux
• **Suivez** nos annonces pour les mises à jour importantes

---

Merci de faire partie de notre communauté! Si vous avez des questions, n'hésitez pas à contacter notre équipe. 🍍`);
    }
    
    // Envoyer chaque morceau de contenu
    for (const chunk of contentChunks) {
      await channel.send(chunk);
    }
    
    await interaction.reply({
      content: `✅ Template "${templateType}" posté avec succès dans ${channel}!`,
      ephemeral: true
    });
  } catch (error) {
    console.error('Erreur lors de l\'envoi du template:', error);
    await interaction.reply({
      content: `❌ Une erreur est survenue lors de l\'envoi du template: ${error.message}`,
      ephemeral: true
    });
  }
}

// Gestionnaire pour la commande /setup-logs
else if (commandName === 'setup-logs') {
  // Vérifier si l'utilisateur a les permissions nécessaires
  if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return interaction.reply({
      content: '⛔ Tu n\'as pas la permission de configurer le système de logs!',
      ephemeral: true
    });
  }
  
  const category = interaction.options.getChannel('catégorie');
  
  if (category.type !== ChannelType.GuildCategory) {
    return interaction.reply({
      content: '❌ Tu dois sélectionner une catégorie!',
      ephemeral: true
    });
  }
  
  try {
    await interaction.deferReply();
    
    // Créer les salons de logs
    const moderationLogs = await interaction.guild.channels.create({
      name: '📋-logs-modération',
      type: ChannelType.GuildText,
      parent: category,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: interaction.guild.roles.cache.find(r => r.name === 'Moderator')?.id || interaction.guild.id,
          allow: [PermissionsBitField.Flags.ViewChannel]
        }
      ]
    });
    
    const messageLogs = await interaction.guild.channels.create({
      name: '💬-logs-messages',
      type: ChannelType.GuildText,
      parent: category,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: interaction.guild.roles.cache.find(r => r.name === 'Moderator')?.id || interaction.guild.id,
          allow: [PermissionsBitField.Flags.ViewChannel]
        }
      ]
    });
    
    const joinLogs = await interaction.guild.channels.create({
      name: '📥-logs-entrées-sorties',
      type: ChannelType.GuildText,
      parent: category,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: interaction.guild.roles.cache.find(r => r.name === 'Moderator')?.id || interaction.guild.id,
          allow: [PermissionsBitField.Flags.ViewChannel]
        }
      ]
    });
    
    const voiceLogs = await interaction.guild.channels.create({
      name: '🔊-logs-vocaux',
      type: ChannelType.GuildText,
      parent: category,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: interaction.guild.roles.cache.find(r => r.name === 'Moderator')?.id || interaction.guild.id,
          allow: [PermissionsBitField.Flags.ViewChannel]
        }
      ]
    });
    
    const serverLogs = await interaction.guild.channels.create({
      name: '🛠️-logs-serveur',
      type: ChannelType.GuildText,
      parent: category,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: interaction.guild.roles.cache.find(r => r.name === 'Moderator')?.id || interaction.guild.id,
          allow: [PermissionsBitField.Flags.ViewChannel]
        }
      ]
    });
    
    // Sauvegarder la configuration des logs
    logsConfig = {
      enabled: true,
      guildId: interaction.guild.id,
      categoryId: category.id,
      channels: {
        moderation: moderationLogs.id,
        messages: messageLogs.id,
        joins: joinLogs.id,
        voice: voiceLogs.id,
        server: serverLogs.id
      }
    };
    
    saveLogsConfig();
    
    const logsEmbed = new EmbedBuilder()
      .setColor('#FFC83D')
      .setTitle('✅ Système de logs configuré avec succès!')
      .setDescription(`
      Le système de logs a été configuré avec les salons suivants:
      
      • Logs de modération: <#${moderationLogs.id}>
      • Logs de messages: <#${messageLogs.id}>
      • Logs d'entrées/sorties: <#${joinLogs.id}>
      • Logs vocaux: <#${voiceLogs.id}>
      • Logs du serveur: <#${serverLogs.id}>
      
      Tous les événements du serveur seront désormais enregistrés dans ces salons.
      `)
      .setFooter({ text: '🍍 Pineapple - Serveur Pub 🍍' })
      .setTimestamp();
    
    await interaction.editReply({ embeds: [logsEmbed] });
    
    // Envoyer un message de test dans chaque salon de logs
    const testEmbed = new EmbedBuilder()
      .setColor('#FFC83D')
      .setTitle('✅ Salon de logs configuré')
      .setDescription('Ce salon a été configuré avec succès pour recevoir les logs du serveur.')
      .setFooter({ text: '🍍 Pineapple - Serveur Pub 🍍' })
      .setTimestamp();
    
    await moderationLogs.send({ embeds: [testEmbed] });
    await messageLogs.send({ embeds: [testEmbed] });
    await joinLogs.send({ embeds: [testEmbed] });
    await voiceLogs.send({ embeds: [testEmbed] });
    await serverLogs.send({ embeds: [testEmbed] });
  } catch (error) {
    console.error('Erreur lors de la configuration du système de logs:', error);
    await interaction.editReply({
      content: '❌ Une erreur est survenue lors de la configuration du système de logs.',
      ephemeral: true
    });
  }
}

// Gestionnaire pour la commande /warn
else if (commandName === 'warn') {
  // Vérifier si l'utilisateur a les permissions nécessaires
  if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
    return interaction.reply({
      content: '⛔ Tu n\'as pas la permission d\'avertir des membres!',
      ephemeral: true
    });
  }
  
  const user = interaction.options.getUser('membre');
  const reason = interaction.options.getString('raison');
  
  try {
    // Créer un identifiant unique pour l'avertissement
    const warnId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    
    // Récupérer les avertissements existants de l'utilisateur ou créer un tableau vide
    const userWarnings = warnings.get(user.id) || [];
    
    // Ajouter le nouvel avertissement
    userWarnings.push({
      id: warnId,
      reason,
      moderator: interaction.user.id,
      timestamp: Date.now()
    });
    
    // Mettre à jour la collection des avertissements
    warnings.set(user.id, userWarnings);
    
    // Sauvegarder les avertissements
    saveWarnings();
    
    // Créer un embed pour l'avertissement
    const warnEmbed = new EmbedBuilder()
      .setColor('#FFC83D')
      .setTitle('⚠️ Avertissement')
      .setDescription(`**${user.tag}** a reçu un avertissement.`)
      .addFields(
        { name: '🛑 Raison', value: reason },
        { name: '🆔 ID de l\'avertissement', value: warnId },
        { name: '📊 Total des avertissements', value: userWarnings.length.toString() }
      )
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Averti par ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();
    
    await interaction.reply({ embeds: [warnEmbed] });
    
    // Envoyer un message privé à l'utilisateur
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor('#FFC83D')
        .setTitle('⚠️ Vous avez reçu un avertissement')
        .setDescription(`Vous avez reçu un avertissement sur le serveur **${interaction.guild.name}**.`)
        .addFields(
          { name: '🛑 Raison', value: reason },
          { name: '🆔 ID de l\'avertissement', value: warnId },
          { name: '📊 Total de vos avertissements', value: userWarnings.length.toString() }
        )
        .setFooter({ text: `Averti par ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();
      
      await user.send({ embeds: [dmEmbed] });
    } catch (dmError) {
      console.error('Erreur lors de l\'envoi du MP:', dmError);
    }
    
    // Enregistrer l'avertissement dans les logs de modération
    if (logsConfig.enabled) {
      const logChannel = interaction.guild.channels.cache.get(logsConfig.channels.moderation);
      
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setColor('#FFC83D')
          .setTitle('⚠️ Avertissement émis')
          .setDescription(`Un membre a reçu un avertissement.`)
          .addFields(
            { name: '👤 Membre', value: `${user.tag} (${user.id})` },
            { name: '👮 Modérateur', value: `${interaction.user.tag} (${interaction.user.id})` },
            { name: '🛑 Raison', value: reason },
            { name: '🆔 ID de l\'avertissement', value: warnId },
            { name: '📊 Total des avertissements', value: userWarnings.length.toString() }
          )
          .setThumbnail(user.displayAvatarURL({ dynamic: true }))
          .setTimestamp();
        
        await logChannel.send({ embeds: [logEmbed] });
      }
    }
  } catch (error) {
    console.error('Erreur lors de l\'avertissement:', error);
    await interaction.reply({
      content: '❌ Une erreur est survenue lors de l\'avertissement.',
      ephemeral: true
    });
  }
}

// Gestionnaire pour la commande /warnlist
else if (commandName === 'warnlist') {
  // Vérifier si l'utilisateur a les permissions nécessaires
  if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
    return interaction.reply({
      content: '⛔ Tu n\'as pas la permission de voir les avertissements!',
      ephemeral: true
    });
  }
  
  const user = interaction.options.getUser('membre');
  
  try {
    // Récupérer les avertissements de l'utilisateur
    const userWarnings = warnings.get(user.id) || [];
    
    if (userWarnings.length === 0) {
      return interaction.reply({
        content: `✅ **${user.tag}** n'a aucun avertissement!`,
        ephemeral: true
      });
    }
    
    // Créer une liste des avertissements
    let warnList = '';
    
    for (let i = 0; i < userWarnings.length; i++) {
      const warn = userWarnings[i];
      const date = new Date(warn.timestamp).toLocaleString();
      
      warnList += `**#${i + 1}** | ID: \`${warn.id}\`\n`;
      warnList += `Raison: ${warn.reason}\n`;
      warnList += `Par: <@${warn.moderator}>\n`;
      warnList += `Date: ${date}\n\n`;
    }
    
    // Créer un embed pour la liste des avertissements
    const warnListEmbed = new EmbedBuilder()
      .setColor('#FFC83D')
      .setTitle(`⚠️ Avertissements de ${user.tag}`)
      .setDescription(warnList)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Total: ${userWarnings.length} avertissement(s)` })
      .setTimestamp();
    
    await interaction.reply({ embeds: [warnListEmbed] });
  } catch (error) {
    console.error('Erreur lors de l\'affichage des avertissements:', error);
    await interaction.reply({
      content: '❌ Une erreur est survenue lors de l\'affichage des avertissements.',
      ephemeral: true
    });
  }
}

// Gestionnaire pour la commande /unwarn
else if (commandName === 'unwarn') {
  // Vérifier si l'utilisateur a les permissions nécessaires
  if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
    return interaction.reply({
      content: '⛔ Tu n\'as pas la permission de retirer des avertissements!',
      ephemeral: true
    });
  }
  
  const user = interaction.options.getUser('membre');
  const warnId = interaction.options.getString('id');
  
  try {
    // Récupérer les avertissements de l'utilisateur
    const userWarnings = warnings.get(user.id) || [];
    
    if (userWarnings.length === 0) {
      return interaction.reply({
        content: `❌ **${user.tag}** n'a aucun avertissement!`,
        ephemeral: true
      });
    }
    
    // Trouver l'avertissement avec l'ID spécifié
    const warnIndex = userWarnings.findIndex(warn => warn.id === warnId);
    
    if (warnIndex === -1) {
      return interaction.reply({
        content: `❌ Aucun avertissement trouvé avec l'ID \`${warnId}\`!`,
        ephemeral: true
      });
    }
    
    // Récupérer les informations de l'avertissement avant de le supprimer
    const removedWarn = userWarnings[warnIndex];
    
    // Supprimer l'avertissement
    userWarnings.splice(warnIndex, 1);
    
    // Mettre à jour la collection des avertissements
    if (userWarnings.length === 0) {
      warnings.delete(user.id);
    } else {
      warnings.set(user.id, userWarnings);
    }
    
    // Sauvegarder les avertissements
    saveWarnings();
    
    // Créer un embed pour confirmer la suppression
    const unwarnEmbed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('✅ Avertissement retiré')
      .setDescription(`Un avertissement de **${user.tag}** a été retiré.`)
      .addFields(
        { name: '🆔 ID de l\'avertissement', value: warnId },
        { name: '🛑 Raison originale', value: removedWarn.reason },
        { name: '📊 Total des avertissements restants', value: userWarnings.length.toString() }
      )
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Retiré par ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();
    
    await interaction.reply({ embeds: [unwarnEmbed] });
    
    // Enregistrer la suppression dans les logs de modération
    if (logsConfig.enabled) {
      const logChannel = interaction.guild.channels.cache.get(logsConfig.channels.moderation);
      
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Avertissement retiré')
          .setDescription(`Un avertissement a été retiré.`)
          .addFields(
            { name: '👤 Membre', value: `${user.tag} (${user.id})` },
            { name: '👮 Modérateur', value: `${interaction.user.tag} (${interaction.user.id})` },
            { name: '🆔 ID de l\'avertissement', value: warnId },
            { name: '🛑 Raison originale', value: removedWarn.reason },
            { name: '📊 Total des avertissements restants', value: userWarnings.length.toString() }
          )
          .setThumbnail(user.displayAvatarURL({ dynamic: true }))
          .setTimestamp();
        
        await logChannel.send({ embeds: [logEmbed] });
      }
    }
  } catch (error) {
    console.error('Erreur lors du retrait de l\'avertissement:', error);
    await interaction.reply({
      content: '❌ Une erreur est survenue lors du retrait de l\'avertissement.',
      ephemeral: true
    });
  }
}

// Gestionnaire pour la commande /tempmute
else if (commandName === 'tempmute') {
  // Vérifier si l'utilisateur a les permissions nécessaires
  if (!interaction.member.permissions.has(PermissionsBitField.Flags.MuteMembers)) {
    return interaction.reply({
      content: '⛔ Tu n\'as pas la permission de mute des membres!',
      ephemeral: true
    });
  }
  
  const user = interaction.options.getUser('membre');
  const minutes = interaction.options.getInteger('duree');
  const reason = interaction.options.getString('raison') || 'Aucune raison fournie';
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  
  if (!member) {
    return interaction.reply({
      content: '❌ Ce membre n\'est pas sur le serveur!',
      ephemeral: true
    });
  }
  
  if (!member.voice.channel) {
    return interaction.reply({
      content: '❌ Ce membre n\'est pas connecté à un salon vocal!',
      ephemeral: true
    });
  }
  
  try {
    // Mute le membre
    await member.voice.setMute(true, reason);
    
    // Formater la durée pour l'affichage
    let formattedDuration = '';
    if (minutes < 60) {
      formattedDuration = `${minutes} minute(s)`;
    } else if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      const leftMinutes = minutes % 60;
      formattedDuration = `${hours} heure(s)${leftMinutes > 0 ? ` et ${leftMinutes} minute(s)` : ''}`;
    } else {
      const days = Math.floor(minutes / 1440);
      const leftHours = Math.floor((minutes % 1440) / 60);
      formattedDuration = `${days} jour(s)${leftHours > 0 ? ` et ${leftHours} heure(s)` : ''}`;
    }
    
    // Créer un embed pour le mute
    const muteEmbed = new EmbedBuilder()
      .setColor('#FFC83D')
      .setTitle('🔇 Membre mute')
      .setDescription(`**${user.tag}** a été mute dans les salons vocaux pour ${formattedDuration}.`)
      .addFields(
        { name: '🛑 Raison', value: reason },
        { name: '🔊 Salon vocal', value: member.voice.channel.name }
      )
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Mute par ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();
    
    await interaction.reply({ embeds: [muteEmbed] });
    
    // Planifier le unmute
    setTimeout(async () => {
      try {
        // Vérifier si le membre est toujours sur le serveur et toujours connecté à un salon vocal
        const updatedMember = await interaction.guild.members.fetch(user.id).catch(() => null);
        
        if (updatedMember && updatedMember.voice.channel && updatedMember.voice.serverMute) {
          await updatedMember.voice.setMute(false, 'Fin du mute temporaire');
          
          // Créer un embed pour le unmute
          const unmuteEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('🔊 Membre unmute')
            .setDescription(`**${user.tag}** a été unmute dans les salons vocaux.`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: `Unmute automatique après ${formattedDuration}` })
            .setTimestamp();
          
          // Envoyer l'embed dans le salon de logs
          if (logsConfig.enabled) {
            const logChannel = interaction.guild.channels.cache.get(logsConfig.channels.moderation);
            
            if (logChannel) {
              await logChannel.send({ embeds: [unmuteEmbed] });
            }
          }
        }
      } catch (error) {
        console.error('Erreur lors du unmute:', error);
      }
    }, minutes * 60 * 1000);
    
    // Enregistrer le mute dans les logs de modération
    if (logsConfig.enabled) {
      const logChannel = interaction.guild.channels.cache.get(logsConfig.channels.moderation);
      
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setColor('#FFC83D')
          .setTitle('🔇 Membre mute')
          .setDescription(`Un membre a été mute dans les salons vocaux.`)
          .addFields(
            { name: '👤 Membre', value: `${user.tag} (${user.id})` },
            { name: '👮 Modérateur', value: `${interaction.user.tag} (${interaction.user.id})` },
            { name: '⏱️ Durée', value: formattedDuration },
            { name: '🛑 Raison', value: reason },
            { name: '🔊 Salon vocal', value: member.voice.channel.name }
          )
          .setThumbnail(user.displayAvatarURL({ dynamic: true }))
          .setTimestamp();
        
        await logChannel.send({ embeds: [logEmbed] });
      }
    }
  } catch (error) {
    console.error('Erreur lors du mute:', error);
    await interaction.reply({
      content: '❌ Une erreur est survenue lors du mute.',
      ephemeral: true
    });
  }
}

// Gestionnaire pour la commande /clear-warns
else if (commandName === 'clear-warns') {
  // Vérifier si l'utilisateur a les permissions nécessaires
  if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return interaction.reply({
      content: '⛔ Tu n\'as pas la permission d\'effacer tous les avertissements!',
      ephemeral: true
    });
  }
  
  const user = interaction.options.getUser('membre');
  
  try {
    // Récupérer les avertissements de l'utilisateur
    const userWarnings = warnings.get(user.id) || [];
    
    if (userWarnings.length === 0) {
      return interaction.reply({
        content: `✅ **${user.tag}** n'a aucun avertissement!`,
        ephemeral: true
      });
    }
    
    // Nombre d'avertissements supprimés
    const warnCount = userWarnings.length;
    
    // Supprimer tous les avertissements
    warnings.delete(user.id);
    
    // Sauvegarder les avertissements
    saveWarnings();
    
    // Créer un embed pour confirmer la suppression
    const clearWarnsEmbed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('✅ Avertissements effacés')
      .setDescription(`Tous les avertissements de **${user.tag}** ont été effacés.`)
      .addFields(
        { name: '📊 Nombre d\'avertissements supprimés', value: warnCount.toString() }
      )
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Effacés par ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();
    
    await interaction.reply({ embeds: [clearWarnsEmbed] });
    
    // Enregistrer la suppression dans les logs de modération
    if (logsConfig.enabled) {
      const logChannel = interaction.guild.channels.cache.get(logsConfig.channels.moderation);
      
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('✅ Avertissements effacés')
          .setDescription(`Tous les avertissements d'un membre ont été effacés.`)
          .addFields(
            { name: '👤 Membre', value: `${user.tag} (${user.id})` },
            { name: '👮 Administrateur', value: `${interaction.user.tag} (${interaction.user.id})` },
            { name: '📊 Nombre d\'avertissements supprimés', value: warnCount.toString() }
          )
          .setThumbnail(user.displayAvatarURL({ dynamic: true }))
          .setTimestamp();
        
        await logChannel.send({ embeds: [logEmbed] });
      }
    }
  } catch (error) {
    console.error('Erreur lors de l\'effacement des avertissements:', error);
    await interaction.reply({
      content: '❌ Une erreur est survenue lors de l\'effacement des avertissements.',
      ephemeral: true
    });
  }

  // Événement quand un message est supprimé
client.on('messageDelete', async (message) => {
  if (!logsConfig.enabled) return;
  if (message.author.bot) return;
  
  try {
    const logChannel = message.guild.channels.cache.get(logsConfig.channels.messages);
    
    if (!logChannel) return;
    
    const logEmbed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('🗑️ Message supprimé')
      .setDescription(`Un message a été supprimé dans <#${message.channel.id}>.`)
      .addFields(
        { name: '👤 Auteur', value: `${message.author.tag} (${message.author.id})` },
        { name: '📝 Contenu', value: message.content || 'Aucun contenu (peut-être une image ou un embed)' }
      )
      .setFooter({ text: `ID du message: ${message.id}` })
      .setTimestamp();
    
    // Ajouter les pièces jointes s'il y en a
    if (message.attachments.size > 0) {
      const attachmentsList = message.attachments.map(a => a.url).join('\n');
      logEmbed.addFields({ name: '📎 Pièces jointes', value: attachmentsList });
    }
    
    await logChannel.send({ embeds: [logEmbed] });
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement d\'un message supprimé:', error);
  }
});

// Événement quand un message est modifié
client.on('messageUpdate', async (oldMessage, newMessage) => {
  if (!logsConfig.enabled) return;
  if (oldMessage.author.bot) return;
  if (oldMessage.content === newMessage.content) return;
  
  try {
    const logChannel = oldMessage.guild.channels.cache.get(logsConfig.channels.messages);
    
    if (!logChannel) return;
    
    const logEmbed = new EmbedBuilder()
      .setColor('#FFC83D')
      .setTitle('✏️ Message modifié')
      .setDescription(`Un message a été modifié dans <#${oldMessage.channel.id}>.`)
      .addFields(
        { name: '👤 Auteur', value: `${oldMessage.author.tag} (${oldMessage.author.id})` },
        { name: '📝 Ancien contenu', value: oldMessage.content || 'Aucun contenu' },
        { name: '📝 Nouveau contenu', value: newMessage.content || 'Aucun contenu' },
        { name: '🔗 Lien', value: `[Aller au message](${newMessage.url})` }
      )
      .setFooter({ text: `ID du message: ${oldMessage.id}` })
      .setTimestamp();
    
    await logChannel.send({ embeds: [logEmbed] });
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement d\'un message modifié:', error);
  }
});

// Événement quand un membre rejoint le serveur
client.on('guildMemberAdd', async (member) => {
  // (...code existant pour l'événement guildMemberAdd...)
  
  // Log de l'entrée du membre
  if (logsConfig.enabled) {
    try {
      const logChannel = member.guild.channels.cache.get(logsConfig.channels.joins);
      
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('📥 Membre rejoint')
          .setDescription(`Un nouveau membre a rejoint le serveur.`)
          .addFields(
            { name: '👤 Membre', value: `${member.user.tag} (${member.user.id})` },
            { name: '📅 Compte créé le', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F> (<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>)` },
            { name: '👥 Nombre de membres', value: member.guild.memberCount.toString() }
          )
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
          .setTimestamp();
        
        await logChannel.send({ embeds: [logEmbed] });
      }
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement d\'un membre rejoint:', error);
    }
  }
});

// Événement quand un membre quitte le serveur
client.on('guildMemberRemove', async (member) => {
  if (!logsConfig.enabled) return;
  
  try {
    const logChannel = member.guild.channels.cache.get(logsConfig.channels.joins);
    
    if (!logChannel) return;
    
    // Vérifier les rôles du membre
    const roles = member.roles.cache
      .filter(role => role.id !== member.guild.id)
      .sort((a, b) => b.position - a.position)
      .map(role => role.name)
      .join(', ') || 'Aucun rôle';
    
    // Vérifier si le membre a été banni récemment
    const fetchedBans = await member.guild.bans.fetch();
    const isBanned = fetchedBans.has(member.user.id);
    
    const logEmbed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle(isBanned ? '🔨 Membre banni' : '📤 Membre parti')
      .setDescription(`Un membre a ${isBanned ? 'été banni du' : 'quitté le'} serveur.`)
      .addFields(
        { name: '👤 Membre', value: `${member.user.tag} (${member.user.id})` },
        { name: '📅 A rejoint le', value: member.joinedAt ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F> (<t:${Math.floor(member.joinedTimestamp / 1000)}:R>)` : 'Inconnu' },
        { name: '👥 Nombre de membres', value: member.guild.memberCount.toString() },
        { name: '🎭 Rôles', value: roles }
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp();
    
    await logChannel.send({ embeds: [logEmbed] });
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement d\'un membre parti:', error);
  }
});

// Événement quand un membre change de salon vocal
client.on('voiceStateUpdate', async (oldState, newState) => {
  if (!logsConfig.enabled) return;
  
  try {
    const logChannel = oldState.guild.channels.cache.get(logsConfig.channels.voice);
    
    if (!logChannel) return;
    
    // Différentes actions possibles
    // 1. Membre rejoint un salon vocal
    if (!oldState.channel && newState.channel) {
      const logEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('🔊 Membre connecté')
        .setDescription(`<@${newState.member.id}> s'est connecté au salon vocal <#${newState.channel.id}>.`)
        .setFooter({ text: `ID du membre: ${newState.member.id}` })
        .setTimestamp();
      
      await logChannel.send({ embeds: [logEmbed] });
    }
    
    // 2. Membre quitte un salon vocal
    else if (oldState.channel && !newState.channel) {
      const logEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🔊 Membre déconnecté')
        .setDescription(`<@${oldState.member.id}> s'est déconnecté du salon vocal <#${oldState.channel.id}>.`)
        .setFooter({ text: `ID du membre: ${oldState.member.id}` })
        .setTimestamp();
      
      await logChannel.send({ embeds: [logEmbed] });
    }
    
    // 3. Membre change de salon vocal
    else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
      const logEmbed = new EmbedBuilder()
        .setColor('#FFC83D')
        .setTitle('🔊 Membre déplacé')
        .setDescription(`<@${newState.member.id}> est passé du salon vocal <#${oldState.channel.id}> au salon <#${newState.channel.id}>.`)
        .setFooter({ text: `ID du membre: ${newState.member.id}` })
        .setTimestamp();
      
      await logChannel.send({ embeds: [logEmbed] });
    }
    
    // 4. Membre mute/unmute ou sourdine/désourdine
    else if (oldState.channel && newState.channel && oldState.channel.id === newState.channel.id) {
      // Changement de statut de mute
      if (oldState.serverMute !== newState.serverMute) {
        const logEmbed = new EmbedBuilder()
          .setColor(newState.serverMute ? '#FF0000' : '#00FF00')
          .setTitle(newState.serverMute ? '🔇 Membre mute' : '🔊 Membre unmute')
          .setDescription(`<@${newState.member.id}> a été ${newState.serverMute ? 'mute' : 'unmute'} dans le salon vocal <#${newState.channel.id}>.`)
          .setFooter({ text: `ID du membre: ${newState.member.id}` })
          .setTimestamp();
        
        await logChannel.send({ embeds: [logEmbed] });
      }
      
      // Changement de statut de sourdine
      if (oldState.serverDeaf !== newState.serverDeaf) {
        const logEmbed = new EmbedBuilder()
          .setColor(newState.serverDeaf ? '#FF0000' : '#00FF00')
          .setTitle(newState.serverDeaf ? '🔇 Membre sourd' : '🔊 Membre non sourd')
          .setDescription(`<@${newState.member.id}> a été ${newState.serverDeaf ? 'mis en sourdine' : 'retiré de la sourdine'} dans le salon vocal <#${newState.channel.id}>.`)
          .setFooter({ text: `ID du membre: ${newState.member.id}` })
          .setTimestamp();
        
        await logChannel.send({ embeds: [logEmbed] });
      }
    }
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement d\'un changement vocal:', error);
  }
});

// Événement quand un salon est créé
client.on('channelCreate', async (channel) => {
  if (!logsConfig.enabled) return;
  if (!channel.guild) return;
  
  try {
    const logChannel = channel.guild.channels.cache.get(logsConfig.channels.server);
    
    if (!logChannel) return;
    
    // Obtenir le type de salon en français
    let channelType = 'Inconnu';
    switch (channel.type) {
      case ChannelType.GuildText: channelType = 'Textuel'; break;
      case ChannelType.GuildVoice: channelType = 'Vocal'; break;
      case ChannelType.GuildCategory: channelType = 'Catégorie'; break;
      case ChannelType.GuildAnnouncement: channelType = 'Annonce'; break;
      case ChannelType.GuildStageVoice: channelType = 'Scène'; break;
      case ChannelType.GuildForum: channelType = 'Forum'; break;
    }
    
    const logEmbed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('📝 Salon créé')
      .setDescription(`Un nouveau salon a été créé.`)
      .addFields(
        { name: '📋 Nom', value: channel.name },
        { name: '🏷️ Type', value: channelType },
        { name: '🆔 ID', value: channel.id },
        { name: '📁 Catégorie', value: channel.parent ? channel.parent.name : 'Aucune' }
      )
      .setTimestamp();
    
    await logChannel.send({ embeds: [logEmbed] });
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement d\'un salon créé:', error);
  }
});

// Événement quand un salon est supprimé
client.on('channelDelete', async (channel) => {
  if (!logsConfig.enabled) return;
  if (!channel.guild) return;
  
  try {
    const logChannel = channel.guild.channels.cache.get(logsConfig.channels.server);
    
    if (!logChannel) return;
    
    // Obtenir le type de salon en français
    let channelType = 'Inconnu';
    switch (channel.type) {
      case ChannelType.GuildText: channelType = 'Textuel'; break;
      case ChannelType.GuildVoice: channelType = 'Vocal'; break;
      case ChannelType.GuildCategory: channelType = 'Catégorie'; break;
      case ChannelType.GuildAnnouncement: channelType = 'Annonce'; break;
      case ChannelType.GuildStageVoice: channelType = 'Scène'; break;
      case ChannelType.GuildForum: channelType = 'Forum'; break;
    }
    
    const logEmbed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('🗑️ Salon supprimé')
      .setDescription(`Un salon a été supprimé.`)
      .addFields(
        { name: '📋 Nom', value: channel.name },
        { name: '🏷️ Type', value: channelType },
        { name: '🆔 ID', value: channel.id },
        { name: '📁 Catégorie', value: channel.parent ? channel.parent.name : 'Aucune' }
      )
      .setTimestamp();
    
    await logChannel.send({ embeds: [logEmbed] });
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement d\'un salon supprimé:', error);
  }
});

// Événement quand un rôle est créé
client.on('roleCreate', async (role) => {
  if (!logsConfig.enabled) return;
  
  try {
    const logChannel = role.guild.channels.cache.get(logsConfig.channels.server);
    
    if (!logChannel) return;
    
    const logEmbed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('👑 Rôle créé')
      .setDescription(`Un nouveau rôle a été créé.`)
      .addFields(
        { name: '📋 Nom', value: role.name },
        { name: '🎨 Couleur', value: role.hexColor },
        { name: '🔢 Position', value: role.position.toString() },
        { name: '🆔 ID', value: role.id }
      )
      .setTimestamp();
    
    await logChannel.send({ embeds: [logEmbed] });
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement d\'un rôle créé:', error);
  }
});

// Événement quand un rôle est supprimé
client.on('roleDelete', async (role) => {
  if (!logsConfig.enabled) return;
  
  try {
    const logChannel = role.guild.channels.cache.get(logsConfig.channels.server);
    
    if (!logChannel) return;
    
    const logEmbed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('👑 Rôle supprimé')
      .setDescription(`Un rôle a été supprimé.`)
      .addFields(
        { name: '📋 Nom', value: role.name },
        { name: '🎨 Couleur', value: role.hexColor },
        { name: '🔢 Position', value: role.position.toString() },
        { name: '🆔 ID', value: role.id }
      )
      .setTimestamp();
    
    await logChannel.send({ embeds: [logEmbed] });
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement d\'un rôle supprimé:', error);
  }
});
}
});

// Fonction de gestion de la création de tickets
async function handleTicketCreation(interaction, type) {
  try {
    // Vérifier si l'utilisateur a déjà un ticket ouvert
    const existingTicket = interaction.guild.channels.cache.find(
      c => c.name === `ticket-${interaction.user.username.toLowerCase().replace(/\s+/g, '-')}` && 
      c.parentId === ticketData.categoryId
    );
    
    if (existingTicket) {
      return interaction.reply({
        content: `❌ Tu as déjà un ticket ouvert! <#${existingTicket.id}>`,
        ephemeral: true
      });
    }
    
    await interaction.deferReply({ ephemeral: true });
    
    // Créer le salon de ticket
    const ticketChannel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username.toLowerCase().replace(/\s+/g, '-')}`,
      type: ChannelType.GuildText,
      parent: ticketData.categoryId,
      topic: type,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory
          ]
        },
        {
          id: ticketData.staffRoleId,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory
          ]
        }
      ]
    });
    
    // Bouton pour fermer le ticket
    const closeButton = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('close_ticket')
          .setLabel('Fermer le ticket')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔒')
      );
    
    // Message de bienvenue dans le ticket
    const ticketWelcomeEmbed = new EmbedBuilder()
      .setColor(type === 'Collaboration/Partenariat' ? '#3498db' : '#2ecc71')
      .setTitle(`Ticket ${type}`)
      .setDescription(`
      Bonjour <@${interaction.user.id}>,
      
      Merci de contacter l'équipe de Pineapple - Serveur Pub!
      
      **Type de ticket:** ${type}
      
      ${type === 'Collaboration/Partenariat' ? 
        `**Pour une collaboration/partenariat, merci de fournir:**
        • Nom et lien de votre serveur
        • Nombre de membres
        • Proposition de partenariat
        • Ce que vous attendez de nous` 
        : 
        `**Pour obtenir de l'aide, merci de préciser:**
        • La nature de votre problème
        • Quand est-ce que cela est arrivé
        • Les détails qui pourraient nous aider à résoudre votre problème`
      }
      
      Un membre du staff vous répondra dès que possible.
      Pour fermer ce ticket, cliquez sur le bouton ci-dessous.
      `)
      .setFooter({ text: '🍍 Pineapple - Serveur Pub 🍍' })
      .setTimestamp();
    
    // Envoyer le message de bienvenue
    await ticketChannel.send({
      content: `<@${interaction.user.id}> <@&${ticketData.staffRoleId}>`,
      embeds: [ticketWelcomeEmbed],
      components: [closeButton]
    });
    
    // Répondre à l'interaction
    await interaction.editReply({
      content: `✅ Ton ticket a été créé! <#${ticketChannel.id}>`,
      ephemeral: true
    });
  } catch (error) {
    console.error('Erreur lors de la création du ticket:', error);
    try {
      if (interaction.deferred) {
        await interaction.editReply({
          content: '❌ Une erreur est survenue lors de la création du ticket.',
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: '❌ Une erreur est survenue lors de la création du ticket.',
          ephemeral: true
        });
      }
    } catch (replyError) {
      console.error('Erreur lors de la réponse:', replyError);
    }
  }
}

// Fonction pour obtenir l'emoji du numéro
function getEmoji(index) {
  const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
  return emojis[index];
}

// Log des changements de rôles
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  // Si le rolelog n'est pas activé, ne rien faire
  if (!client.roleLogEnabled) return;
  
  // Ignorer les changements autres que les rôles
  if (oldMember.roles.cache.size === newMember.roles.cache.size) return;
  
  // Trouver les rôles ajoutés et retirés
  const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
  const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));
  
  if (addedRoles.size > 0 || removedRoles.size > 0) {
    try {
      // Créer un message de log
      let description = '';
      
      if (addedRoles.size > 0) {
        description += `**Rôles ajoutés:**\n${addedRoles.map(r => `<@&${r.id}>`).join(', ')}\n\n`;
      }
      
      if (removedRoles.size > 0) {
        description += `**Rôles retirés:**\n${removedRoles.map(r => `<@&${r.id}>`).join(', ')}`;
      }
      
      const roleLogEmbed = new EmbedBuilder()
        .setColor('#FFC83D')
        .setTitle('📝 Log de changement de rôles')
        .setDescription(description)
        .addFields(
          { name: '👤 Membre', value: `${newMember.user.tag} (<@${newMember.id}>)`, inline: false }
        )
        .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: `ID: ${newMember.id}` })
        .setTimestamp();
      
      // Envoyer le log dans le salon actuel où la commande /rolelog a été activée
      await newMember.guild.channels.cache.get(newMember.guild.systemChannelId).send({ embeds: [roleLogEmbed] });
    } catch (error) {
      console.error('Erreur lors du log des changements de rôles:', error);
    }
  }
});

// Connexion du bot
client.login(token);
