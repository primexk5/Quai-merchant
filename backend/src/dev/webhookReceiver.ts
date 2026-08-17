/**
 * Local development webhook receiver — stands in for a merchant's endpoint. It verifies the
 * signature against a shared secret and logs the payload, so you can run the full
 * register -> pay -> event -> webhook loop end to end on your machine.
 *
 *   WEBHOOK_SECRET=whsec_... PORT=9000 npm run webhook-receiver
 *
 * Then onboard a merchant whose webhookUrl points here (e.g. http://localhost:9000/webhook).
 */
import express from 'express';
import { verifySignature, SIGNATURE_HEADER } from '../webhooks/signer.js';

const PORT = Number(process.env.PORT ?? 9000);
const SECRET = process.env.WEBHOOK_SECRET;
if (!SECRET) {
  console.error('Set WEBHOOK_SECRET (the whsec_... value returned when the merchant was onboarded).');
  process.exit(1);
}

const app = express();
// Capture the RAW body — signature verification must run over the exact bytes received.
app.use(express.raw({ type: '*/*', limit: '256kb' }));

app.post('/webhook', (req, res) => {
  const raw = (req.body as Buffer).toString('utf8');
  const sig = req.header(SIGNATURE_HEADER);
  const nowSec = Math.floor(Date.now() / 1000);

  if (!verifySignature(SECRET!, sig, raw, nowSec)) {
    console.warn('❌ invalid signature — rejecting');
    return res.status(400).json({ error: 'invalid signature' });
  }

  const event = JSON.parse(raw);
  console.log(`✅ ${event.type} (${event.id})`);
  console.dir(event.data, { depth: null });
  // Respond 2xx so the relayer marks the delivery as delivered.
  res.json({ received: true });
});

app.listen(PORT, () => console.log(`webhook receiver listening on http://localhost:${PORT}/webhook`));
