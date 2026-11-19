const nodemailer = require("nodemailer");
const config = require("../config");

const transporter = config.smtp.host
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    })
  : null;

// If no SMTP is set up (normal during development), the email is printed in the terminal.
async function sendMail({ to, subject, text }) {
  if (!transporter) {
    console.log(`\n--- EMAIL (SMTP not configured) ---\nTo: ${to}\nSubject: ${subject}\n${text}\n-----------------------------------\n`);
    return false;
  }
  await transporter.sendMail({ from: config.smtp.from, to, subject, text });
  return true;
}

module.exports = { sendMail };
