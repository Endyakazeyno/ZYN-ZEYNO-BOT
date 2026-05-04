const handler = async (m, { isPrems, conn }) => {
  if (!global.db.data.users) global.db.data.users = {};
  if (!global.db.data.users[m.sender]) {
    global.db.data.users[m.sender] = {
      euro: 0,
      exp: 0,
    };
  }

  const time = global.db.data.users[m.sender].lastcofre + 86400000;
  if (new Date() - global.db.data.users[m.sender].lastcofre < 86400000) {
    const tempo = msToTime(time - new Date());
    return m.reply(`
ㅤㅤ⋆｡˚『 ╭ \`FORZIERE\` ╯ 』˚｡⋆\n╭\n│
│
│ 『 ⚠️ 』 \`Hai già aperto il forziere oggi!\`
│ 
│ 『 ⏰ 』 \`Prossimo forziere tra:\`
│  -   _*${tempo}*_
│
*╰⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─*`);
  }
  
  let euro = Math.floor(Math.random() * 30) + 20;
  let monete = Math.floor(Math.random() * 4000) + 2000;
  let esperienza = Math.floor(Math.random() * 5000) + 2000; 
  
  if (isPrems) {
    euro *= 2;
    monete *= 2;
    esperienza *= 2;
  }
  
  global.db.data.users[m.sender].euro += euro;
  global.db.data.users[m.sender].money += monete;
  global.db.data.users[m.sender].exp += esperienza;
  global.db.data.users[m.sender].lastcofre = new Date() * 1;

  const testo = `
ㅤㅤ⋆｡˚『 ╭ \`FORZIERE\` ╯ 』˚｡⋆\n╭\n│
│ 『 📦 』 _*Contenuto Forziere:*_
│ • 🪙 \`Euro:\` *+${euro}*
│ • 💰 \`Monete:\` *+${monete}*
│ • ✨ \`Exp:\` *+${esperienza}*
│
│ ${isPrems ? '『 👑 』 *BONUS PREMIUM x2!*' : '『 💡 』 _Diventa premium per premi doppi!_'}
│
*╰⭒─ׄ─ׅ─ׄ─⭒─ׄ─ׅ─ׄ─*`;

  // Modificato qui: invia solo il messaggio di testo
  await m.reply(testo);
};

handler.help = ['forziere'];
handler.tags = ['euro'];
handler.command = ['forziere', 'chest'];
handler.cooldown = 86400000;
handler.register = false;

export default handler;

function msToTime(duration) {
  let seconds = Math.floor((duration / 1000) % 60);
  let minutes = Math.floor((duration / (1000 * 60)) % 60);
  let hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

  hours = (hours < 10) ? '0' + hours : hours;
  minutes = (minutes < 10) ? '0' + minutes : minutes;
  seconds = (seconds < 10) ? '0' + seconds : seconds;

  return hours + ' Ore ' + minutes + ' Minuti';
}
