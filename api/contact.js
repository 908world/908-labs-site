// Vercel serverless function: receives the site's contact / package enquiry forms,
// emails them to the studio inbox via Resend (https://resend.com), and sends the
// person a confirmation.
//
// Environment variables (Vercel → Project → Settings → Environment Variables):
//   RESEND_API_KEY   your Resend API key                                  (required)
//   CONTACT_TO       where enquiries go                (default: labs@908.world)
//   CONTACT_FROM     sender on a domain verified in Resend, e.g. 908 Labs <hello@908.world>
//                    Until this is set, Resend only delivers to your own Resend inbox,
//                    so the confirmation email to the enquirer is skipped.

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Hidden anti-spam fields from the original Framer forms: real visitors never fill them in.
const HONEYPOTS = ['website', 'company', 'message', 'subject', 'title', 'description', 'feedback',
  'notes', 'details', 'remarks', 'comments', 'additional_info', 'extra'];

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  try { return JSON.parse(raw); } catch { return Object.fromEntries(new URLSearchParams(raw)); }
}

const isPackage = form => /package$/i.test(form || '');
const slug = s => String(s || 'general').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const pick = (data, ...keys) => {
  for (const k of Object.keys(data)) if (keys.includes(k.toLowerCase())) return String(data[k] || '').trim();
  return '';
};

async function send(key, payload) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  let detail = '';
  if (!r.ok) { try { detail = (await r.json()).message || ''; } catch { /* ignore */ } }
  return { ok: r.ok, status: r.status, detail };
}

function confirmationHtml(first, fields, form) {
  const rows = fields.map(([k, v]) =>
    `<tr><td style="padding:6px 16px 6px 0;color:#8a8a8a;font-size:13px;vertical-align:top;white-space:nowrap">${esc(k)}</td>` +
    `<td style="padding:6px 0;color:#f2f2f2;font-size:14px;white-space:pre-wrap">${esc(v)}</td></tr>`).join('');
  return `<!doctype html><html><body style="margin:0;background:#0b0b0b;font-family:Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0b0b0b;padding:32px 16px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#161616;border-radius:24px;padding:36px">
<tr><td style="color:#ffffff;font-size:30px;font-weight:700;font-style:italic;letter-spacing:-1px;padding-bottom:4px">908 Labs&trade;</td></tr>
<tr><td style="color:#8a8a8a;font-size:13px;padding-bottom:28px">Design &amp; Development &middot; London</td></tr>
<tr><td style="color:#f2f2f2;font-size:16px;line-height:1.55;padding-bottom:24px">
Hi ${esc(first || 'there')},<br><br>
${isPackage(form) ? `Thanks for your interest in the <b>${esc(form)}</b>. We've got your enquiry` : "Thanks for reaching out. We've got your message"} and someone from the team will get back to you within two working days.<br><br>
If there's anything you want to add in the meantime, just reply to this email.</td></tr>
<tr><td style="border-top:1px solid #2a2a2a;padding-top:20px;color:#8a8a8a;font-size:12px;text-transform:uppercase;letter-spacing:1px;padding-bottom:8px">What you sent us</td></tr>
<tr><td><table cellpadding="0" cellspacing="0">${rows}</table></td></tr>
<tr><td style="padding-top:28px;color:#8a8a8a;font-size:12px">908 Labs &middot; Part of 908 World &middot; <a href="https://labs.908.world" style="color:#8a8a8a">labs.908.world</a></td></tr>
</table></td></tr></table></body></html>`;
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(JSON.stringify({ ok: false, error: 'Method not allowed' })); }
  const data = await readBody(req);

  // Bots fill in the hidden fields; pretend it worked and drop it.
  if (HONEYPOTS.some(h => data[h])) { res.statusCode = 200; return res.end(JSON.stringify({ ok: true })); }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error('RESEND_API_KEY is not set for this deployment');
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: 'RESEND_API_KEY is not set' }));
  }

  const page = String(data._page || '');
  const form = String(data._form || 'General enquiry').slice(0, 60);   // "Starter Package", "Contact page", …
  const fields = Object.entries(data)
    .filter(([k, v]) => !k.startsWith('_') && !HONEYPOTS.includes(k) && String(v).trim() !== '')
    .map(([k, v]) => [k, String(v).trim()]);

  const email = pick(data, 'email');
  const first = pick(data, 'first name', 'name').split(' ')[0];
  const missing = fields.length === 0 || !email;
  if (missing) { res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'Please fill in every field' })); }

  const from = process.env.CONTACT_FROM || '908 Labs <onboarding@resend.dev>';
  const to = (process.env.CONTACT_TO || 'labs@908.world').split(',').map(s => s.trim());

  // 1) the enquiry, to the studio. The subject starts with the form in brackets so inbox filters can sort them:
  //   [Starter Package] / [Studio Package] / [World Package] / [Contact page] / [General enquiry]
  const rows = [['Enquiry', form], ...fields].map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top">${esc(k)}</td><td style="padding:4px 0;white-space:pre-wrap">${esc(v)}</td></tr>`).join('');
  const studio = await send(key, {
    from, to, reply_to: email,
    subject: `[${form}] New enquiry from ${first || email}`,
    html: `<p><b>${esc(form)}</b> enquiry from labs.908.world${esc(page)}</p><table>${rows}</table>`,
    tags: [{ name: 'form', value: slug(form) }],
    headers: { 'X-908-Form': form },
  });
  if (!studio.ok) {
    console.error('Resend rejected the enquiry email:', studio.status, studio.detail);
    res.statusCode = 502;
    return res.end(JSON.stringify({ ok: false, error: `Resend ${studio.status}: ${studio.detail}` }));
  }

  // 2) confirmation to the person — only possible once a sending domain is verified (CONTACT_FROM)
  let confirmation = 'skipped';
  if (process.env.CONTACT_FROM) {
    const c = await send(key, {
      from, to: [email], reply_to: to[0],
      subject: isPackage(form) ? `Your ${form} enquiry — 908 Labs` : "Thanks, we've got your message — 908 Labs",
      html: confirmationHtml(first, fields, form),
      tags: [{ name: 'form', value: slug(form) }, { name: 'type', value: 'confirmation' }],
    });
    confirmation = c.ok ? 'sent' : 'failed';
    if (!c.ok) console.error('Confirmation email failed:', c.status, c.detail);   // enquiry still went through
  }

  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true, confirmation }));
};
