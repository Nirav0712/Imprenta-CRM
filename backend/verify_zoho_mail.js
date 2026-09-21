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

async function verifyZoho() {
  console.log('================================================================');
  console.log('ZOHO MAIL INTEGRATION & SECURE SMTP/IMAP VERIFICATION');
  console.log('================================================================\n');

  const email = process.env.ZOHO_EMAIL || 'info@thedigitalconnect.in';
  const smtpHost = process.env.ZOHO_SMTP_HOST || 'smtp.zoho.in';
  const smtpPort = process.env.ZOHO_SMTP_PORT || '465';
  const smtpSecure = process.env.ZOHO_SMTP_SECURE !== 'false';
  const imapHost = process.env.ZOHO_IMAP_HOST || 'imap.zoho.in';
  const imapPort = process.env.ZOHO_IMAP_PORT || '993';
  const imapSecure = process.env.ZOHO_IMAP_SECURE !== 'false';
  const passwordSet = Boolean(process.env.ZOHO_SMTP_PASSWORD && process.env.ZOHO_SMTP_PASSWORD.trim());

  console.log(`[Config Audit] Account: ${email}`);
  console.log(`[Config Audit] SMTP Server: ${smtpHost}:${smtpPort} (TLS/SSL: ${smtpSecure})`);
  console.log(`[Config Audit] IMAP Server: ${imapHost}:${imapPort} (TLS/SSL: ${imapSecure})`);
  console.log(`[Security Audit] Password Configured in .env: ${passwordSet ? 'YES (Protected, Never Printed)' : 'NO (Awaiting user entry in .env)'}`);

  // Query accounts list from backend API
  const accountsRes = await httpRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/email/accounts',
    method: 'GET',
  });

  const zohoAcc = Array.isArray(accountsRes.data)
    ? accountsRes.data.find((a) => a.emailAddress === email.toLowerCase())
    : null;

  if (zohoAcc) {
    console.log(`\n[Account State] Found database record id: ${zohoAcc._id}, status: ${zohoAcc.status}`);
    
    if (passwordSet) {
      console.log('\n[Connection Test] Initiating secure server-side SMTP & IMAP verification...');
      const testRes = await httpRequest({
        hostname: 'localhost',
        port: 4000,
        path: `/api/email/accounts/${zohoAcc._id}/test`,
        method: 'POST',
      });

      console.log(`[Connection Test] HTTP ${testRes.status}:`, JSON.stringify(testRes.data));

      const recipientArg = process.argv[2];
      if (testRes.data.success && recipientArg) {
        console.log(`\n[Real Outgoing Test] Sending exactly 1 controlled test email to: ${recipientArg}`);
        const sendPayload = {
          accountId: zohoAcc._id,
          toEmail: recipientArg.trim(),
          subject: 'AUTOMATION_OS_REAL_EMAIL_TEST',
          bodyText: `Hello,\n\nThis is a controlled real email delivery test from The Digital Connect's Zoho Mail account.\n\nTest ID:\nAUTOMATION_OS_REAL_EMAIL_TEST\n\nPlease confirm whether this email was received.\n\nRegards,\nThe Digital Connect`,
          bodyHtml: `<p>Hello,</p><p>This is a controlled real email delivery test from The Digital Connect's Zoho Mail account.</p><p><strong>Test ID:</strong><br/>AUTOMATION_OS_REAL_EMAIL_TEST</p><p>Please confirm whether this email was received.</p><p>Regards,<br/>The Digital Connect</p>`,
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

        console.log(`[Real Outgoing Test] HTTP ${sendRes.status}:`, JSON.stringify(sendRes.data));
      } else if (testRes.data.success && !recipientArg) {
        console.log('\n[Notice] SMTP Authentication SUCCEEDED. Awaiting test recipient email address to send 1 test email.');
      }
    } else {
      console.log('\n[Notice] Please enter your Zoho App Password in backend/.env under ZOHO_SMTP_PASSWORD= to proceed with connection test.');
    }
  } else {
    console.log('\n[Account State] No database record yet for', email);
  }
}

verifyZoho().catch((err) => {
  console.error('Error during verification:', err);
  process.exit(1);
});
