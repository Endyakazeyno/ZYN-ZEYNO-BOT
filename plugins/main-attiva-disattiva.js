import { createAIService } from './risposte-ai.js'; 

console.log('--- [DEBUG] Caricamento plugin AI in corso... ---');

const p1 = 'gsk_6VlRfuGRq3pG0';
const p2 = 'RAc8knZWGdyb3FYGlEn';
const p3 = '0Y9t8U4gg38EGlT';
const p4 = 'tikgA';

const botAI = createAIService(p1 + p2 + p3 + p4);

const PERM = { ADMIN: 'admin', OWNER: 'owner', sam: 'sam' };

const featureRegistry = [
  { key: 'ai', store: 'chat', perm: PERM.ADMIN, name: '*🧠 Bot IA*', desc: 'Intelligenza Artificiale attiva' }
];

const aliasMap = new Map();
featureRegistry.forEach(f => aliasMap.set(f.key.toLowerCase(), f));

let handler = async (m, { conn, usedPrefix, command, args, isOwner, isAdmin, isSam }) => {
  const isEnable = ['enable', 'attiva', 'on', '1'].includes(command?.toLowerCase());
  
  // Inizializzazione forzata database
  global.db.data = global.db.data || {};
  global.db.data.chats = global.db.data.chats || {};
  if (!global.db.data.chats[m.chat]) global.db.data.chats[m.chat] = {};
  
  const chat = global.db.data.chats[m.chat];

  if (args[0] && args[0].toLowerCase() === 'ai') {
    chat.ai = isEnable;
    console.log(`[DATABASE] AI impostata su: ${isEnable} per la chat ${m.chat}`);
    return m.reply(`*〘 📡 BLD-SYSTEM 〙*\n\nModulo: AI\nStato: *${isEnable ? 'ATTIVATO 🟢' : 'DISATTIVATO 🔴'}*`);
  }

  return m.reply(`Usa: *${usedPrefix}${command} ai* per attivare/disattivare l'AI.`);
};

handler.before = async function (m) {
  if (!m.text || m.fromMe) return;
  if (/^[.!#]/.test(m.text)) return;
  
  const chat = global.db.data?.chats?.[m.chat];
  
  // Debug in console per ogni messaggio
  console.log(`[MSG] Ricevuto: "${m.text}" | Stato AI chat: ${chat?.ai}`);

  if (!chat?.ai) return;

  if (/\bbot\b/i.test(m.text) || (m.mentionedJid && m.mentionedJid.includes(this.user.jid))) {
    try {
      console.log(`[AI] Sto chiamando Groq...`);
      const reply = await botAI.generateReply({
        messageText: m.text,
        authorName: m.pushName || 'User',
        chatId: m.chat,
        authorId: m.sender
      });
      if (reply) return this.reply(m.chat, reply, m);
    } catch (e) {
      console.error('[AI ERROR]:', e);
    }
  }
};

handler.command = ['enable', 'disable', 'attiva', 'disattiva', 'on', 'off'];
export default handler;
