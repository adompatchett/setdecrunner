// server/utils/mailer.js
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: !!process.env.SMTP_SECURE, // true for 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

export async function sendMail({ to, subject, html, text }) {
  const from = process.env.SMTP_FROM || 'No Reply <no-reply@example.com>';
  return transporter.sendMail({ from, to, subject, html, text });
}