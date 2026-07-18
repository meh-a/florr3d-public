const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CHANNEL_ID = process.env.DISCORD_ULTRA_CHANNEL_ID;

const MIN_INTERVAL_MS = 60_000;
let lastSent = 0;

export function notifyUltraSpawn(mobName) {
  if (!BOT_TOKEN || !CHANNEL_ID) return;
  const now = Date.now();
  if (now - lastSent < MIN_INTERVAL_MS) return;
  lastSent = now;

  const body = {
    embeds: [{
      title: '🌟 Ultra spawned',
      description: `A **${mobName}** rolled Ultra rarity.`,
      color: 0xff2b75,
    }],
  };

  fetch(`https://discord.com/api/v10/channels/${CHANNEL_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch((err) => console.error('[discord] ultra alert failed', err.message));
}
