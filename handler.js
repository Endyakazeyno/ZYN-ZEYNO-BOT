import { smsg } from './lib/simple.js'
import { format } from 'util'
import { fileURLToPath } from 'url'
import path, { join } from 'path'
import { unwatchFile, watchFile } from 'fs'
import chalk from 'chalk'
import NodeCache from 'node-cache'
import { getAggregateVotesInPollMessage, toJid } from '@realvare/based'

global.ignoredUsersGlobal = new Set()
global.ignoredUsersGroup = {}
global.groupSpam = {}

if (!global.groupCache) {
    global.groupCache = new NodeCache({ stdTTL: 5 * 60, useClones: false })
}
if (!global.jidCache) {
    global.jidCache = new NodeCache({ stdTTL: 600, useClones: false })
}
if (!global.nameCache) {
    global.nameCache = new NodeCache({ stdTTL: 600, useClones: false });
}

export const fetchMetadata = async (conn, chatId) => await conn.groupMetadata(chatId)

const fetchGroupMetadataWithRetry = async (conn, chatId, retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
        try {
            return await conn.groupMetadata(chatId);
        } catch (e) {
            if (i === retries - 1) throw e;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

if (!global.cacheListenersSet) {
    const conn = global.conn
    if (conn) {
        conn.ev.on('groups.update', async (updates) => {
            for (const update of updates) {
                if (!update || !update.id) continue;
                try {
                    const metadata = await fetchGroupMetadataWithRetry(conn, update.id)
                    if (metadata) global.groupCache.set(update.id, metadata, { ttl: 300 })
                } catch (e) {
                    if (!e?.message?.includes('not authorized') && !e?.message?.includes('chat not found')) {
                        console.error(`[ERRORE] Aggiornamento cache fallito per ${update.id}`);
                    }
                }
            }
        })
        global.cacheListenersSet = true
    }
}

if (!global.pollListenerSet) {
    const conn = global.conn
    if (conn) {
        conn.ev.on('messages.update', async (chatUpdate) => {
            for (const { key, update } of chatUpdate) {
                if (update.pollUpdates) {
                    try {
                        const pollCreation = await global.store.getMessage(key)
                        if (pollCreation) {
                            await getAggregateVotesInPollMessage({
                                message: pollCreation,
                                pollUpdates: update.pollUpdates,
                            })
                        }
                    } catch (e) {}
                }
            }
        })
        global.pollListenerSet = true
    }
}

const isNumber = x => typeof x === 'number' && !isNaN(x)
const delay = ms => isNumber(ms) && new Promise(resolve => setTimeout(resolve, ms))
const responseHandlers = new Map()

function initResponseHandler(conn) {
    if (!conn.waitForResponse) {
        conn.waitForResponse = async (chat, sender, options = {}) => {
            const { timeout = 30000, validResponses = null, onTimeout = null, filter = null } = options
            return new Promise((resolve) => {
                const key = chat + sender
                const timeoutId = setTimeout(() => {
                    responseHandlers.delete(key)
                    if (onTimeout) onTimeout()
                    resolve(null)
                }, timeout)
                responseHandlers.set(key, { resolve, timeoutId, validResponses, filter })
            })
        }
    }
}

global.processedCalls = global.processedCalls || new Map()
if (global.conn && global.conn.ws) {
    global.conn.ws.on('CB:call', async (json) => {
        try {
            if (json.tag !== 'call' || !json.attrs?.from) return
            const callerId = global.conn.decodeJid(json.attrs.from)
            if (global.owner.some(([num]) => num === callerId.split('@')[0])) return

            const uniqueCallId = json.content?.find(item => item.attrs && item.attrs['call-id'])?.attrs['call-id'] || json.attrs.id
            const contentTags = json.content?.map(item => item.tag) || []

            if (contentTags.includes('terminate')) {
                global.processedCalls.delete(uniqueCallId)
                return
            }

            if (contentTags.includes('relaylatency') && !global.processedCalls.has(uniqueCallId)) {
                global.processedCalls.set(uniqueCallId, true)
                const settings = global.db.data?.settings?.[global.conn.user.jid] || {}
                if (!settings.anticall) return

                await global.conn.rejectCall(uniqueCallId, callerId)
                let user = global.db.data.users[callerId] || (global.db.data.users[callerId] = { callCount: 0, banned: false })
                user.callCount = (user.callCount || 0) + 1
                
                const msg = user.callCount >= 3 ? "🚫 Troppe chiamate. Bannato." : "🚫 Non chiamare il bot."
                if (user.callCount >= 3) user.banned = true
                await global.conn.sendMessage(callerId, { text: msg })
            }
        } catch (e) { console.error('[ERRORE CALL]', e) }
    })
}

export async function participantsUpdate({ id, participants, action }) {
    if (global.db.data.chats[id]?.rileva === false) return
    try {
        let metadata = global.groupCache.get(id) || await fetchMetadata(this, id)
        if (metadata) global.groupCache.set(id, metadata, { ttl: 300 })
    } catch (e) {}
}

export async function handler(chatUpdate) {
    this.msgqueque = this.msgqueque || []
    if (!chatUpdate) return
    this.pushMessage(chatUpdate.messages).catch(console.error)
    let m = chatUpdate.messages[chatUpdate.messages.length - 1]
    if (!m) return

    // FIX EDIT: Protezione contro messaggi modificati che rompevano il bot
    if (m.message?.protocolMessage?.type === 'MESSAGE_EDIT') {
        const key = m.message.protocolMessage.key;
        const editedMessage = m.message.protocolMessage.editedMessage;
        if (!editedMessage) return; // Se l'edit è vuoto, ignora
        m.key = key;
        m.message = editedMessage;
        m.text = editedMessage.conversation || editedMessage.extendedTextMessage?.text || editedMessage.imageMessage?.caption || '';
        m.mtype = Object.keys(editedMessage)[0];
    }

    m = smsg(this, m, global.store)
    if (!m || !m.key || !m.chat || !m.sender || m.fromMe) return
    
    // Sicurezza sui JID
    m.key.remoteJid = this.decodeJid(m.key.remoteJid)
    if (m.key.participant) m.key.participant = this.decodeJid(m.key.participant)
    
    if (m.key.participant?.includes(':')) return

    initResponseHandler(this)

    try {
        if (!global.db.data) await global.loadDatabase()
        
        const normalizedSender = this.decodeJid(m.sender)
        const normalizedBot = this.decodeJid(this.user.jid)

        // Inizializzazione User e Chat nel DB
        let user = global.db.data.users[normalizedSender] || (global.db.data.users[normalizedSender] = { exp: 0, euro: 10, registered: false, messages: 0 })
        let chat = global.db.data.chats[m.chat] || (global.db.data.chats[m.chat] = { ai: false, antispam: false })
        let settings = global.db.data.settings[this.user.jid] || (global.db.data.settings[this.user.jid] = { registrazioni: true })

        if (settings.registrazioni === false) user.registered = true

        // Gestione permessi
        let groupMetadata = m.isGroup ? (global.groupCache.get(m.chat) || await fetchGroupMetadataWithRetry(this, m.chat)) : null
        if (m.isGroup && groupMetadata) global.groupCache.set(m.chat, groupMetadata, { ttl: 300 })

        const participants = groupMetadata?.participants || []
        const isSam = global.owner.some(([num]) => num + '@s.whatsapp.net' === normalizedSender)
        const isOwner = isSam || m.fromMe
        
        const isAdmin = participants.some(u => this.decodeJid(u.id) === normalizedSender && (u.admin || u.isAdmin))
        const isBotAdmin = participants.some(u => this.decodeJid(u.id) === normalizedBot && (u.admin || u.isAdmin))

        // Esecuzione Plugin
        const ___dirname = join(path.dirname(fileURLToPath(import.meta.url)), './plugins')
        for (let name in global.plugins) {
            let plugin = global.plugins[name]
            if (!plugin || typeof plugin !== 'function') continue

            let _prefix = plugin.customPrefix || global.prefix || '.'
            let match = m.text?.match(new RegExp(`^${_prefix instanceof RegExp ? _prefix.source : _prefix.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')}`))

            if (!match) continue
            let usedPrefix = match[0]
            let noPrefix = m.text.replace(usedPrefix, '')
            let [command, ...args] = noPrefix.trim().split` `.filter(v => v)
            command = command?.toLowerCase() || ''

            const isAccept = Array.isArray(plugin.command) ? plugin.command.includes(command) : (plugin.command instanceof RegExp ? plugin.command.test(command) : plugin.command === command)
            if (!isAccept) continue

            // Controlli restrizioni plugin
            if (user.banned && !isOwner) return
            if (plugin.rowner && !isOwner) { global.dfail('rowner', m, this); continue; }
            if (plugin.group && !m.isGroup) { global.dfail('group', m, this); continue; }
            if (plugin.admin && !isAdmin) { global.dfail('admin', m, this); continue; }
            if (plugin.botAdmin && !isBotAdmin) { global.dfail('botAdmin', m, this); continue; }

            try {
                await plugin.call(this, m, {
                    match, usedPrefix, noPrefix, args, command, text: args.join(' '),
                    conn: this, isOwner, isAdmin, isBotAdmin, groupMetadata
                })
            } catch (e) {
                console.error(e)
                m.reply(format(e))
            }
            break
        }
    } catch (e) {
        console.error('[ERRORE HANDLER]', e)
    } finally {
        // Incremento statistiche
        let user = global.db.data.users[this.decodeJid(m.sender)]
        if (user) {
            user.messages = (user.messages || 0) + 1
            user.exp += m.exp || 0
        }
        if (!global.opts['noprint'] && m) {
            const print = await import(`./lib/print.js`).catch(() => null)
            if (print) print.default(m, this)
        }
    }
}

global.dfail = async (type, m, conn) => {
    const msg = {
        rowner: '👑 Solo Blood può usare questo.',
        owner: '🛡️ Comando riservato ai capi.',
        group: '👥 Questo comando funziona solo nei gruppi.',
        admin: '🛠️ Devi essere admin per usarlo.',
        botAdmin: '🤖 Il bot deve essere admin.',
        unreg: '📛 Registrati prima: .reg nome età'
    }[type]
    if (msg) m.reply(msg)
}

let file = global.__filename(import.meta.url, true)
watchFile(file, async () => { 
    unwatchFile(file)     
    console.log(chalk.bgHex('#3b0d95')(chalk.white.bold("File: 'handler.js' Aggiornato")))
})
