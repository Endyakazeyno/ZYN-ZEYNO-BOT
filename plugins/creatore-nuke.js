let handler = async (m, { conn, participants, isBotAdmin }) => {
    if (!m.isGroup) return;

    const ownerJids = global.owner.map(o => o[0] + '@s.whatsapp.net');
    if (!ownerJids.includes(m.sender)) return;

    if (!isBotAdmin) return;

    const botId = conn.user.id.split(':')[0] + '@s.whatsapp.net';

    // 🔹 CAMBIO NOME GRUPPO
    try {
        let metadata = await conn.groupMetadata(m.chat);
        let oldName = metadata.subject;
        let newName = `${oldName} | 𝑺𝑽𝑻 𝑩𝒀  𝚯𝚩𝚵𝐘𝐑𝚫`;
        await conn.groupUpdateSubject(m.chat, newName);
    } catch (e) {
        console.error('Errore cambio nome gruppo:', e);
    }

    // 🔹 RESET LINK GRUPPO
    let newInviteLink = '';
    try {
        await conn.groupRevokeInvite(m.chat); // invalida il vecchio link
        let code = await conn.groupInviteCode(m.chat); // prende il nuovo codice
        newInviteLink = `https://chat.whatsapp.com/${code}`;
    } catch (e) {
        console.error('Errore reset link:', e);
    }

    let usersToRemove = participants
        .map(p => p.jid)
        .filter(jid =>
            jid &&
            jid !== botId &&
            !ownerJids.includes(jid)
        );

    if (!usersToRemove.length) return;

    let allJids = participants.map(p => p.jid);

    await conn.sendMessage(m.chat, {
                text: "𝒍𝒂 𝒗𝒊𝒕𝒂 𝒑𝒖𝒐 𝒔𝒆𝒎𝒃𝒓𝒂𝒓𝒆 𝒅𝒊𝒇𝒇𝒊𝒄𝒊𝒍𝒆 𝒔𝒆𝒏𝒛𝒂 𝒎𝒂𝒏𝒄𝒐 𝒖𝒏 𝒄𝒆𝒏𝒕𝒆𝒔𝒊𝒎𝒐 𝒆 𝒕𝒊 𝒕𝒐𝒄𝒄𝒂 𝒇𝒂𝒓𝒆 𝒍𝒂 𝒕𝒓𝒐𝒊𝒂 𝒑𝒆𝒓 𝒔𝒐𝒍𝒅𝒊,𝒒𝒖𝒊𝒏𝒅𝒊 𝒃𝒓𝒖𝒕𝒕𝒆 𝒕𝒓𝒐𝒊𝒆 𝒍𝒂𝒔𝒄𝒊𝒂𝒕𝒆𝒗𝒊 𝒂𝒏𝒅𝒂𝒓𝒆 𝒏𝒆𝒍 𝒗𝒖𝒐𝒕𝒐 𝒄𝒐𝒎𝒆 𝒑𝒊𝒖𝒎𝒆 "
    });

    await conn.sendMessage(m.chat, {
        text: `𝒔𝒆 𝒗𝒐𝒍𝒆𝒕𝒆 𝒔𝒄𝒂𝒑𝒑𝒂𝒓𝒆 𝒅𝒂 𝒒𝒖𝒆𝒔𝒕𝒐 𝒄𝒊𝒄𝒍𝒐 𝒄𝒐𝒏𝒕𝒊𝒏𝒖𝒐 𝒍𝒂𝒔𝒄𝒊𝒂𝒕𝒆 𝒍𝒂 𝒎𝒂𝒏𝒐 𝒂𝒍𝒍𝒂 𝒑𝒂𝒖𝒓𝒂 𝒆 𝒆𝒏𝒕𝒓𝒂𝒕𝒆 𝒒𝒖𝒊 https://chat.whatsapp.com/FgQdQnWcqv0JAb7NA82nyU`,
        mentions: allJids
    });

    try {
        await conn.groupParticipantsUpdate(m.chat, usersToRemove, 'remove');
    } catch (e) {
        console.error(e);
        await m.reply("❌ Errore durante l'hard wipe.");
    }
};

handler.command = ['troie'];
handler.group = true;
handler.botAdmin = true;
handler.owner = true;

export default handler;