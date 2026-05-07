let handler = async (m, { conn, args, isAdmin, isOwner }) => {
  if (!m.isGroup) return
  if (!isAdmin && !isOwner) return conn.reply(m.chat, '『 ❌ 』 Solo admin.', m)

  let amount = parseInt(args[0]) || 0
  if (amount <= 0) return conn.reply(m.chat, '『 ⚠️ 』 Esempio: *.clean 50*', m)
  if (amount > 500) amount = 500

  try {
    let waitMsg = await conn.reply(m.chat, `『 🧹 』 *Tentativo di pulizia...*\nRecupero messaggi dalla cache in corso.`, m)

    let messages = []
    
    if (conn.store && conn.store.messages && conn.store.messages[m.chat]) {
      messages = Object.values(conn.store.messages[m.chat]).slice(-amount)
    } else if (conn.messages && conn.messages[m.chat]) {
      messages = Object.values(conn.messages[m.chat]).slice(-amount)
    } else {
      try {
        messages = await conn.loadMessages(m.chat, amount)
      } catch {
        messages = []
      }
    }

    if (!messages || messages.length === 0) {
      return conn.reply(m.chat, '『 ❌ 』 La cache del bot è vuota. Non posso vedere i messaggi inviati prima del mio avvio.', m)
    }

    let deletedCount = 0
    for (let msg of messages) {
      if (!msg.key || msg.key.id === waitMsg.key.id) continue
      try {
        await conn.sendMessage(m.chat, { 
          delete: {
            remoteJid: m.chat,
            fromMe: msg.key.fromMe,
            id: msg.key.id,
            participant: msg.key.participant || msg.participant || msg.key.remoteJid
          }
        })
        deletedCount++
        await new Promise(resolve => setTimeout(resolve, 150))
      } catch {
        continue
      }
    }

    if (deletedCount === 0) return conn.reply(m.chat, '『 ⚠️ 』 Trovati messaggi ma impossibile eliminarli (forse troppo vecchi).', m)

    let finalMsg = await conn.reply(m.chat, `『 ✅ 』 *Pulizia completata!*\nRimossi ${deletedCount} messaggi.`, m)

    setTimeout(async () => {
      try {
        await conn.sendMessage(m.chat, { delete: finalMsg.key })
        await conn.sendMessage(m.chat, { delete: waitMsg.key })
      } catch {}
    }, 5000)

  } catch (err) {
    conn.reply(m.chat, '『 ❌ 』 Errore imprevisto nella gestione della memoria.', m)
  }
}

handler.help = ['clean <numero>']
handler.tags = ['admin']
handler.command = ['clean', 'pulisci']
handler.group = true
handler.admin = true
handler.botAdmin = true

export default handler
