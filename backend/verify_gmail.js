const http = require('http');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function httpRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function verifyGmail() {
  console.log('================================================================');
  console.log('REAL GMAIL SMTP + IMAP INTEGRATION AUDIT & TEST');
  console.log('================================================================\n');

  const email = process.env.GMAIL_EMAIL || 'bdetdc5@gmail.com';
  const smtpHost = process.env.GMAIL_SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = process.env.GMAIL_SMTP_PORT || '587';
  const smtpSecure = process.env.GMAIL_SMTP_SECURE === 'true';
  const imapHost = process.env.GMAIL_IMAP_HOST || 'imap.gmail.com';
  const imapPort = process.env.GMAIL_IMAP_PORT || '993';
  const passwordSet = Boolean(process.env.GMAIL_SMTP_PASSWORD && process.env.GMAIL_SMTP_PASSWORD.trim());

  console.log(`[Config Audit] Account: ${email}`);
  console.log(`[Config Audit] SMTP Server: ${smtpHost}:${smtpPort} (STARTTLS/SSL: ${smtpSecure ? 'Direct SSL' : 'STARTTLS (587)'})`);
  console.log(`[Config Audit] IMAP Server: ${imapHost}:${imapPort} (TLS/SSL: true)`);
  console.log(`[Security Audit] Password Configured in .env: ${passwordSet ? 'YES (Protected, Never Printed)' : 'NO'}`);

  // Query accounts from backend
  const accountsRes = await httpRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/email/accounts',
    method: 'GET',
  });

  const gmailAcc = Array.isArray(accountsRes.data)
    ? accountsRes.data.find((a) => a.emailAddress === email.toLowerCase())
    : null;

  if (gmailAcc) {
    console.log(`\n[Account State] Found database record ID: ${gmailAcc._id}, status: ${gmailAcc.status}`);
    console.log(`[Account State] Current SMTP status: ${gmailAcc.smtpStatus}, IMAP status: ${gmailAcc.imapStatus}`);

    console.log('\n[Connection Test] Initiating secure server-side SMTP & IMAP verification...');
    const testRes = await httpRequest({
      hostname: 'localhost',
      port: 4000,
      path: `/api/email/accounts/${gmailAcc._id}/test`,
      method: 'POST',
    });

    console.log(`[Connection Test Result] HTTP ${testRes.status}:`, JSON.stringify(testRes.data));

    const recipientArg = process.argv[2] || 'thedigitalconnect712@gmail.com';
    if (testRes.data.smtpSuccess && recipientArg) {
      console.log(`\n[Real Outgoing Test] Sending exactly 1 controlled test email to: ${recipientArg}`);
      const sendPayload = {
        accountId: gmailAcc._id,
        toEmail: recipientArg.trim(),
        subject: 'AUTOMATION_OS_GMAIL_REAL_OUTGOING_TEST',
        bodyText: `Hello,\n\nThis is a controlled real Gmail outgoing email test from Automation OS.\n\nSender account:\nBDE <${email}>\n\nTest ID:\nAUTOMATION_OS_GMAIL_REAL_OUTGOING_TEST\n\nPlease confirm that this email has been received.\n\nRegards,\nBDE`,
        bodyHtml: `<p>Hello,</p><p>This is a controlled real Gmail outgoing email test from Automation OS.</p><p><strong>Sender account:</strong><br/>BDE &lt;${email}&gt;</p><p><strong>Test ID:</strong><br/>AUTOMATION_OS_GMAIL_REAL_OUTGOING_TEST</p><p>Please confirm that this email has been received.</p><p>Regards,<br/>BDE</p>`,
      };

      const sendRes = await httpRequest(
        {
          hostname: 'localhost',
          port: 4000,
          path: '/api/email/accounts/send',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        sendPayload,
      );

      console.log(`[Real Outgoing Test Result] HTTP ${sendRes.status}:`, JSON.stringify(sendRes.data));
    } else if (!testRes.data.smtpSuccess) {
      console.log('\n[Notice] SMTP Authentication did not succeed. Check if an App Password is required by Gmail.');
    }
  } else {
    console.log('\n[Account State] No database record found yet for', email);
  }
}

verifyGmail().catch((err) => {
  console.error('Error during Gmail verification:', err);
  process.exit(1);
});
