import PhoneNumber from 'awesome-phonenumber'
import chalk from 'chalk'
import { watchFile } from 'fs'
import { fileURLToPath } from 'url'
import NodeCache from 'node-cache'

const __filename = fileURLToPath(import.meta.url)
const nameCache = new NodeCache({ stdTTL: 600 });
const groupMetaCache = new NodeCache({ stdTTL: 300 });

export default async function (m, conn = { user: {} }) {
  if (!global.messageUpdateListenerSet) {
    conn.ev.on('messages.update', (updates) => {
      for (const update of updates) {
        if (update.update.message?.editedMessage) {
          console.log(chalk.bgCyan.black.bold(' ✎ EDIT '), chalk.cyanBright('Messaggio modificato in questa chat.'));
        }
      }
    })
    global.messageUpdateListenerSet = true
  }

  if (!m) return

  try {
    const senderJid = m.sender || m.key?.participant || m.key?.remoteJid
    const chatJid = m.chat || m.key?.remoteJid
    if (!chatJid) return;

    let _name = nameCache.get(senderJid) || await conn.getName(senderJid) || '';
    nameCache.set(senderJid, _name);

    const sender = formatPhoneNumber(senderJid, _name)
    let chatName = nameCache.get(chatJid) || await conn.getName(chatJid) || 'Unknown';

    const isOwner = Array.isArray(global.owner) ? global.owner.map(([number]) => number).includes(senderJid.split('@')[0]) : global.owner === senderJid.split('@')[0]
    const isGroup = chatJid.endsWith('@g.us')
    const isAdmin = isGroup ? await checkAdmin(conn, chatJid, senderJid) : false
    const isPremium = global.prems?.includes(senderJid) || false
    const isBanned = global.DATABASE?.data?.users?.[senderJid]?.banned || false

    const user = global.DATABASE?.data?.users?.[senderJid] || { exp: 0, euro: 0 }

    const c = {
      p: chalk.hex('#FF007A').bold,
      s: chalk.hex('#00E5FF').bold,
      t: chalk.hex('#FFFFFF'),
      g: chalk.hex('#39FF14'),
      v: chalk.hex('#BC13FE'),
      warn: chalk.hex('#FFFF00').bold,
      err: chalk.hex('#FF0000').bold
    }

    const top = c.p('╔' + '═'.repeat(18) + '┫ ') + c.s('BLOOD 🩸 BOT') + c.p(' ┣' + '═'.repeat(18) + '╗')
    const mid = c.p('╟' + '─'.repeat(50) + '╢')
    const bot = c.p('╚' + '═'.repeat(50) + '╝')
    const L = c.p('║')

    let textMessage = m.text || m.body || m.msg?.text || m.msg?.caption || m.message?.conversation || m.message?.extendedTextMessage?.text || ''
    
    console.log('\n' + top)
    console.log(`${L} ${c.s('SENDER')}  ${c.v('➤')} ${c.t(sender)}`)
    console.log(`${L} ${c.s('CHAT')}    ${c.v('➤')} ${c.t(chatName)} ${isGroup ? c.g('[GROUP]') : c.v('[PVT]')}`)
    console.log(`${L} ${c.s('STATUS')}  ${c.v('➤')} ${getUserStatus(isOwner, isAdmin, isPremium, isBanned, c)}`)
    console.log(`${L} ${c.s('TYPE')}    ${c.v('➤')} ${c.g(formatType(m))} ${getMessageFlags(m, c)}`)

    console.log(`${L} ${c.g('⭐ ASSETS')}  ${c.v('➤')} ${c.t((user.exp || 0) + ' XP')} ${c.p('|')} ${c.t((user.euro || 0) + ' €')}`)

    if (textMessage) {
      console.log(mid)
      console.log(`${L} ${c.s('CONTENT')} ${c.v('➤')} ${c.t(textMessage)}`)
    }

    if (m.isCommand || textMessage.startsWith('.') || textMessage.startsWith('/') || textMessage.startsWith('!')) {
      const commandName = textMessage.trim().split(/\s/)[0].toUpperCase()
      console.log(`${L} ${c.warn('⚡ COMMAND')} ${c.v('➤')} ${chalk.bgHex('#FF007A').white.bold(' ' + commandName + ' ')}`)
    }

    logMessageSpecifics(m, c, L)
    console.log(bot)

  } catch (error) {
    console.error('Log Error:', error)
  }

  return true
}

function getUserStatus(isOwner, isAdmin, isPremium, isBanned, c) {
  if (isBanned) return c.err('× BANNED ×')
  if (isOwner) return chalk.bgHex('#FF007A').white.bold(' 👑 OWNER ')
  let s = []
  if (isAdmin) s.push(c.g('ADMIN'))
  if (isPremium) s.push(c.s('PREMIUM'))
  return s.length ? s.join(chalk.gray(' | ')) : chalk.gray('USER')
}

function formatPhoneNumber(jid, name) {
  if (!jid) return 'Unknown'
  const num = jid.split('@')[0].split(':')[0]
  return name ? `${name} ${chalk.gray('('+num+')')}` : num
}

function formatType(m) {
  let type = m.mtype || 'MSG'
  return type.replace(/Message/gi, '').toUpperCase()
}

function getMessageFlags(m, c) {
  let f = []
  if (m.quoted) f.push(c.v('↶ REPLY'))
  if (m.forwarded) f.push(c.s('➥ FWD'))
  return f.length ? chalk.gray('(') + f.join(' ') + chalk.gray(')') : ''
}

async function checkAdmin(conn, chatId, senderId) {
  try {
    const groupMeta = groupMetaCache.get(chatId) || await conn.groupMetadata(chatId)
    groupMetaCache.set(chatId, groupMeta)
    return groupMeta?.participants?.some(p => conn.decodeJid(p.id) === conn.decodeJid(senderId) && p.admin) || false
  } catch { return false }
}

function logMessageSpecifics(m, c, L) {
  const types = {
    imageMessage: '🖼️ IMAGE',
    videoMessage: '🎥 VIDEO',
    audioMessage: '🎵 AUDIO',
    stickerMessage: '✨ STICKER',
    documentMessage: '📄 DOC'
  }
  if (types[m.mtype]) console.log(`${L} ${c.s('ATTACH')}  ${c.v('➤')} ${c.g(types[m.mtype])}`)
}

watchFile(__filename, () => {
  console.log(chalk.bgHex('#FF007A').white.bold(" ⚡ SISTEMA AGGIORNATO "))
})
