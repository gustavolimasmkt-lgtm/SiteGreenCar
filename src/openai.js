// Evento de conversão para a Conversions API da OpenAI (ChatGPT Ads)
const { getSetting } = require('./db');

const PIXEL_ID = '7KXinbK13rb2ggHfNP539o';

async function sendOpenAIEvent({ type, eventId, sourceUrl }) {
  const key = getSetting('openai_capi_key', process.env.OPENAI_CAPI_KEY || '');
  if (!key) return { skipped: true };
  const r = await fetch(`https://bzr.openai.com/v1/events?pid=${PIXEL_ID}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      validate_only: false,
      events: [{
        id: eventId,
        type,
        timestamp_ms: Date.now(),
        source_url: sourceUrl || undefined,
        action_source: 'web',
        data: { type: 'customer_action' }
      }]
    }),
    signal: AbortSignal.timeout(10000)
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${text.slice(0, 300)}`);
  return { ok: true, response: text };
}

module.exports = { sendOpenAIEvent, PIXEL_ID };
