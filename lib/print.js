import PhoneNumber from 'awesome-phonenumber'
import chalk from 'chalk'
import { watchFile } from 'fs'
import { fileURLToPath } from 'url'
import NodeCache from 'node-cache'

const __filename = fileURLToPath(import.meta.url)
const nameCache = new NodeCache({ stdTTL: 600 });
const groupMetaCache = new NodeCache({ stdTTL: 300 });
const errorThrottle = {};

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

  if (!m || m.key?.fromMe) return

  try {
    const senderJid = conn.decodeJid(m.sender)
    const chatJid = conn.decodeJid(m.chat || '')
    const botJid = conn.decodeJid(conn.user?.jid)
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

    const user = global.DATABASE?.data?.users?.[senderJid] || { exp: '?', euro: '?' }

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

    console.log('\n' + top)
    console.log(`${L} ${c.s('SENDER')}  ${c.v('➤')} ${c.t(sender)}`)
    console.log(`${L} ${c.s('CHAT')}    ${c.v('➤')} ${c.t(chatName)} ${isGroup ? c.g('[GROUP]') : c.v('[PVT]')}`)
    console.log(`${L} ${c.s('STATUS')}  ${c.v('➤')} ${getUserStatus(isOwner, isAdmin, isPremium, isBanned, c)}`)
    console.log(`${L} ${c.s('TYPE')}    ${c.v('➤')} ${c.g(formatType(m))} ${getMessageFlags(m, c)}`)

    if (m.isCommand) {
      console.log(mid)
      console.log(`${L} ${c.warn('⚡ COMMAND')} ${c.v('➤')} ${chalk.bgHex('#FF007A').white.bold(' ' + getCommand(m.text) + ' ')}`)
    }

    if (user.exp !== '?') {
      console.log(`${L} ${c.g('⭐ ASSETS')}  ${c.v('➤')} ${c.t(user.exp + ' XP')} ${c.p('|')} ${c.t(user.euro + ' €')}`)
    }

    const logText = await formatText(m, conn)
    if (logText) {
      console.log(mid)
      console.log(`${L} ${c.s('CONTENT')} ${c.v('➤')} ${logText}`)
    }

    logMessageSpecifics(m, c, L)
    console.log(bot)

  } catch (error) {
    if (!errorThrottle[error.message]) {
      console.error(chalk.red('Log Error:'), error.message)
      errorThrottle[error.message] = true
      setTimeout(() => delete errorThrottle[error.message], 5000)
    }
  }
}

function getUserStatus(isOwner, isAdmin, isPremium, isBanned, c) {
  if (isBanned) return c.err('× BANNED ×')
  if (isOwner) return chalk.bgHex('#FF007A').white.bold(' 👑 OWNER ')
  let s = []
  if (isAdmin) s.push(chalk.bgHex('#39FF14').black.bold(' ADMIN '))
  if (isPremium) s.push(chalk.bgHex('#00E5FF').black.bold(' PREM '))
  return s.length ? s.join(' ') : chalk.gray('USER')
}

function formatPhoneNumber(jid, name) {
  const num = jid.split('@')[0].split(':')[0]
  return name ? `${name} ${chalk.gray('('+num+')')}` : num
}

function formatType(m) {
  let type = m.mtype || 'msg'
  return type.replace(/Message/gi, '').toUpperCase()
}

function getMessageFlags(m, c) {
  let f = []
  if (m.quoted) f.push(c.v('↶ REPLY'))
  if (m.forwarded) f.push(c.s('➥ FWD'))
  return f.length ? chalk.gray('(') + f.join(' ') + chalk.gray(')') : ''
}

function getCommand(text) {
  return text ? text.split(/\s/)[0].toUpperCase() : ''
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

async function formatText(m, conn) {
  let text = m.text || m.caption || m.message?.conversation || m.message?.extendedTextMessage?.text || ''
  if (!text && m.quoted) text = m.quoted.text || m.quoted.caption || ''
  if (!text.trim()) return null
  return chalk.whiteBright(text.length > 500 ? text.slice(0, 500) + '...' : text)
}

watchFile(__filename, () => {
  console.log(chalk.bgHex('#FF007A').white.bold(" ⚡ SISTEMA AGGIORNATO: OVERDRIVE MODE ATTIVO "))
})
