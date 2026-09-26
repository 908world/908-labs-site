// Vercel serverless function: receives the site's contact / package enquiry forms
// and emails them to the studio inbox via Resend (https://resend.com).
//
// Required environment variables (Vercel → Project → Settings → Environment Variables):
//   RESEND_API_KEY   your Resend API key
//   CONTACT_TO       where enquiries go            (default: labs@908.world)
//   CONTACT_FROM     verified sender address        (default: 908 Labs <onboarding@resend.dev>)

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  try { return JSON.parse(raw); } catch { return Object.fromEntries(new URLSearchParams(raw)); }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.statusCode = 405; return res.end('Method not allowed'); }
  const data = await readBody(req);

  // honeypot fields present in the original forms
  if (data.website || data.company) { res.statusCode = 200; return res.end(JSON.stringify({ ok: true })); }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error('RESEND_API_KEY is not set for this deployment');
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: 'RESEND_API_KEY is not set' }));
  }

  const page = data._page || '';
  delete data._page;
  const rows = Object.entries(data)
    .filter(([k]) => !k.startsWith('_'))
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#666">${esc(k)}</td><td style="padding:4px 0">${esc(v)}</td></tr>`)
    .join('');
  const replyTo = data.Email || data.email;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.CONTACT_FROM || '908 Labs <onboarding@resend.dev>',
      to: (process.env.CONTACT_TO || 'labs@908.world').split(','),
      reply_to: replyTo || undefined,
      subject: `New enquiry — labs.908.world${page ? ' ' + page : ''}`,
      html: `<p>New enquiry from <b>labs.908.world${esc(page)}</b></p><table>${rows}</table>`,
    }),
  });
  res.setHeader('Content-Type', 'application/json');
  if (!r.ok) {
    let detail = '';
    try { detail = (await r.json()).message || ''; } catch { /* ignore */ }
    console.error('Resend rejected the email:', r.status, detail);
    res.statusCode = 502;
    return res.end(JSON.stringify({ ok: false, error: `Resend ${r.status}: ${detail}` }));
  }
  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true }));
};
