import "dotenv/config";
import "reflect-metadata";

import { readFileSync } from "fs";
import { join } from "path";
import { getDb } from "../server/db/data-source";
import { User } from "../server/entities/User";
import { sendWithRetry, from } from "../server/services/email.service";

const TEST_MODE = false;
const TEST_EMAIL = ["jibson@tuta.io", "info@thecoralfarm.co.uk"];
const CSV_PATH = join(__dirname, "..", "user-export.csv");

// Parses one CSV line respecting "double quoted" fields (handles ""-escaped quotes too).
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === ",") {
        out.push(cur);
        cur = "";
      } else if (ch === '"') {
        inQuotes = true;
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}

interface Contact {
  firstName: string;
  email: string;
  businessName: string;
}

function loadContacts(): { contacts: Contact[]; noEmail: number } {
  const raw = readFileSync(CSV_PATH, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idxFirst = header.indexOf("first name");
  const idxEmail = header.indexOf("email");
  const idxBiz = header.indexOf("business name");

  const contacts: Contact[] = [];
  let noEmail = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const email = (cols[idxEmail] || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      noEmail++;
      continue;
    }
    contacts.push({
      firstName: (cols[idxFirst] || "").trim(),
      email,
      businessName: (cols[idxBiz] || "").trim(),
    });
  }
  return { contacts, noEmail };
}

function domainOf(email: string): string {
  const at = email.lastIndexOf("@");
  return at >= 0 ? email.slice(at + 1).toLowerCase() : "";
}

function buildEmail(firstName: string, businessName: string) {
  const applyUrl = "https://thecoralfarm.co.uk/apply";
  const greeting = firstName && firstName.toLowerCase() !== "sirs" ? `Hi ${firstName},` : "Hi there,";
  const bizLine = businessName
    ? `We have you on file from <strong style="color: #ffffff;">${businessName}</strong>, either as an existing account holder or someone who showed interest in trading with us.`
    : `We have you on file as an existing account holder or someone who showed interest in trading with us.`;

  const subject = "Introducing the new Coral Farm Trade Portal";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background: #0d1116; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #0d1116; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background: #1a1f26; border-radius: 16px; overflow: hidden;">
          <tr>
            <td style="padding: 40px 40px 8px 40px;">
              <h1 style="color: #ffffff; font-size: 26px; margin: 0 0 6px 0; font-weight: 700; letter-spacing: -0.4px;">The Coral Farm</h1>
              <p style="color: #0984E3; font-size: 13px; margin: 0 0 28px 0; font-weight: 600; text-transform: uppercase; letter-spacing: 1.2px;">Trade Portal Now Live</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 8px 40px;">
              <p style="color: #ffffffcc; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">${greeting}</p>
              <p style="color: #ffffffcc; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">${bizLine}</p>
              <p style="color: #ffffffcc; font-size: 16px; line-height: 1.6; margin: 0 0 28px 0;">We've just launched our brand new <strong style="color: #ffffff;">Trade Portal</strong>, the easiest way yet to view shipments, place orders, and manage your account with us.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 24px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: rgba(9, 132, 227, 0.08); border: 1px solid rgba(9, 132, 227, 0.2); border-radius: 12px;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <p style="color: #ffffff; font-size: 14px; font-weight: 600; margin: 0 0 14px 0; text-transform: uppercase; letter-spacing: 1px;">What's inside</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr><td style="padding: 6px 0; color: #ffffffcc; font-size: 15px; line-height: 1.5;"><span style="color: #0984E3; font-weight: 700; margin-right: 8px;">›</span>Browse and place orders on every live shipment, the moment it lands</td></tr>
                      <tr><td style="padding: 6px 0; color: #ffffffcc; font-size: 15px; line-height: 1.5;"><span style="color: #0984E3; font-weight: 700; margin-right: 8px;">›</span>Manage your orders from one place</td></tr>
                      <tr><td style="padding: 6px 0; color: #ffffffcc; font-size: 15px; line-height: 1.5;"><span style="color: #0984E3; font-weight: 700; margin-right: 8px;">›</span>View and download invoices any time</td></tr>
                      <tr><td style="padding: 6px 0; color: #ffffffcc; font-size: 15px; line-height: 1.5;"><span style="color: #0984E3; font-weight: 700; margin-right: 8px;">›</span>Pay online by card or bank transfer, with flexible financing options</td></tr>
                      <tr><td style="padding: 6px 0; color: #ffffffcc; font-size: 15px; line-height: 1.5;"><span style="color: #0984E3; font-weight: 700; margin-right: 8px;">›</span>Submit DOA claims and credit notes in seconds, not days</td></tr>
                      <tr><td style="padding: 6px 0; color: #ffffffcc; font-size: 15px; line-height: 1.5;"><span style="color: #0984E3; font-weight: 700; margin-right: 8px;">›</span>Invite your team, give staff their own access without sharing logins</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 40px 8px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius: 12px; background: #0984E3;">
                    <a href="${applyUrl}" style="display: inline-block; padding: 14px 36px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 12px;">Apply Now</a>
                  </td>
                </tr>
              </table>
              <p style="color: #ffffff66; font-size: 13px; line-height: 1.5; margin: 24px 0 0 0;">Or copy this link: <a href="${applyUrl}" style="color: #0984E3; text-decoration: none;">${applyUrl}</a></p>
            </td>
          </tr>
          <tr>
            <td style="padding: 28px 40px 40px 40px;">
              <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 24px;">
                <p style="color: #ffffffcc; font-size: 14px; line-height: 1.6; margin: 0 0 6px 0; font-weight: 600;">Questions? Get in touch.</p>
                <p style="color: #ffffff99; font-size: 13px; line-height: 1.7; margin: 0;">Email <a href="mailto:info@thecoralfarm.co.uk" style="color: #0984E3; text-decoration: none;">info@thecoralfarm.co.uk</a></p>
                <p style="color: #ffffff99; font-size: 13px; line-height: 1.7; margin: 0;">Or contact us on <a href="tel:+447418632278" style="color: #0984E3; text-decoration: none;">07418 632278</a></p>
              </div>
            </td>
          </tr>
        </table>
        <p style="color: #ffffff44; font-size: 12px; margin: 16px 0 0 0;">The Coral Farm · thecoralfarm.co.uk</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `${greeting}

${bizLine.replace(/<[^>]+>/g, "")}

We've just launched our brand new Trade Portal, the easiest way yet to view shipments, place orders, and manage your account with us.

What's inside:
  › Browse and place orders on every live shipment, the moment it lands
  › Manage your orders from one place
  › View and download invoices any time
  › Pay online by card or bank transfer, with flexible financing options
  › Submit DOA claims and credit notes in seconds, not days
  › Invite your team, give staff their own access without sharing logins

Apply now: ${applyUrl}

Questions? Get in touch.
Email: info@thecoralfarm.co.uk
Or contact us on 07418 632278

The Coral Farm`;

  return { subject, html, text };
}

async function main() {
  console.log("📧 Coral Farm portal-launch notifier");
  console.log(`   TEST_MODE: ${TEST_MODE ? "ON, will only send to " + TEST_EMAIL : "OFF, will send to all eligible contacts"}`);
  console.log("");

  console.log("→ Connecting to database...");
  const db = await getDb();
  const userRepo = db.getRepository(User);
  const userCount = await userRepo.count();
  console.log(`✓ Connected to DB, ${userCount} users on record`);
  console.log("");

  console.log("→ Loading existing-customer emails and domains...");
  const dbUsers = await userRepo.find({ select: { email: true } });
  const dbDomains = new Set<string>();
  const dbEmails = new Set<string>();
  for (const u of dbUsers) {
    const e = u.email.trim().toLowerCase();
    if (e) dbEmails.add(e);
    const d = domainOf(e);
    if (d) dbDomains.add(d);
  }
  console.log(`✓ ${dbEmails.size} exact emails, ${dbDomains.size} unique domains in our DB`);
  console.log("");

  console.log(`→ Reading ${CSV_PATH}...`);
  const { contacts, noEmail } = loadContacts();
  console.log(`✓ ${contacts.length} contacts with valid emails in CSV (${noEmail} rows skipped: no email)`);
  console.log("");

  // Filter: skip anyone whose exact email or domain is already in our DB
  const eligible: Contact[] = [];
  const skipped: { contact: Contact; reason: "exact email" | "domain" }[] = [];
  for (const c of contacts) {
    if (dbEmails.has(c.email)) {
      skipped.push({ contact: c, reason: "exact email" });
    } else if (dbDomains.has(domainOf(c.email))) {
      skipped.push({ contact: c, reason: "domain" });
    } else {
      eligible.push(c);
    }
  }
  console.log(`→ ${skipped.length} skipped (already in DB):`);
  for (const s of skipped) {
    const c = s.contact;
    const biz = c.businessName ? `  [${c.businessName}]` : "";
    console.log(`   • ${c.email}${biz}  matched by ${s.reason}`);
  }
  console.log("");
  console.log(`→ ${eligible.length} eligible to receive the portal-launch email:`);
  for (const c of eligible) {
    const biz = c.businessName ? `  [${c.businessName}]` : "";
    console.log(`   • ${c.email}${biz}`);
  }
  console.log("");

  if (eligible.length === 0) {
    console.log("Nothing to send. Exiting.");
    process.exit(0);
  }

  let sent = 0;
  let failed = 0;

  if (TEST_MODE) {
    console.log(`🧪 TEST MODE, sending ONE preview email to ${TEST_EMAIL}`);
    console.log(`   (using template data from first eligible contact: ${eligible[0].email})`);
    const sample = eligible[0];
    const { subject, html, text } = buildEmail(sample.firstName, sample.businessName);
    try {
      await sendWithRetry({
        from: from(),
        to: TEST_EMAIL,
        replyTo: "info@thecoralfarm.co.uk",
        subject: `[TEST] ${subject}`,
        html,
        text,
      });
      sent = 1;
      console.log(`✓ Test email sent to ${TEST_EMAIL}`);
    } catch (e) {
      failed = 1;
      console.error(`✗ Test email failed:`, e);
    }
  } else {
    console.log(`📨 LIVE MODE, sending to ${eligible.length} contacts`);
    for (let i = 0; i < eligible.length; i++) {
      const c = eligible[i];
      const { subject, html, text } = buildEmail(c.firstName, c.businessName);
      try {
        await sendWithRetry({
          from: from(),
          to: c.email,
          replyTo: "info@thecoralfarm.co.uk",
          subject,
          html,
          text,
        });
        sent++;
        const biz = c.businessName ? `  [${c.businessName}]` : "";
        console.log(`  [${i + 1}/${eligible.length}] ✓ ${c.email}${biz}`);
      } catch (e) {
        failed++;
        const biz = c.businessName ? `  [${c.businessName}]` : "";
        console.error(`  [${i + 1}/${eligible.length}] ✗ ${c.email}${biz}:`, e instanceof Error ? e.message : e);
      }
      // small pacing gap
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  console.log("");
  console.log(`Done. sent: ${sent}, failed: ${failed}, skipped (already in DB): ${skipped.length}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
