const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE === 'true', 
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

async function sendAlertEmail(server, status) {
    if (!process.env.SMTP_USER || process.env.SMTP_PASS === 'your_email_password') {
        console.warn(`[MAILER] Skipping email alert for ${server.name} because SMTP credentials are not configured.`);
        return;
    }

    const isDown = status === 'Down';
    const subject = isDown 
        ? `🚨 URGENT: Voice Server DOWN - ${server.name}` 
        : `✅ RECOVERY: Voice Server UP - ${server.name}`;
    
    const text = isDown 
        ? `The voice server "${server.name}" (${server.host}) is currently offline. Please investigate immediately.`
        : `The voice server "${server.name}" (${server.host}) has recovered and is now back online.`;

    const html = isDown 
        ? `
            <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #ff4d4f; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #ff4d4f; color: white; padding: 20px; text-align: center;">
                    <h2 style="margin: 0;">🚨 Server Offline Alert</h2>
                </div>
                <div style="padding: 20px;">
                    <p><strong>Server Name:</strong> ${server.name}</p>
                    <p><strong>IP Address:</strong> ${server.host}</p>
                    <p><strong>Time Detected:</strong> ${new Date().toLocaleString()}</p>
                    <p style="color: #ff4d4f; font-weight: bold;">Action Required: Please investigate immediately.</p>
                </div>
            </div>
        ` 
        : `
            <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #52c41a; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #52c41a; color: white; padding: 20px; text-align: center;">
                    <h2 style="margin: 0;">✅ Server Recovery Alert</h2>
                </div>
                <div style="padding: 20px;">
                    <p><strong>Server Name:</strong> ${server.name}</p>
                    <p><strong>IP Address:</strong> ${server.host}</p>
                    <p><strong>Time Detected:</strong> ${new Date().toLocaleString()}</p>
                    <p style="color: #52c41a; font-weight: bold;">The server is functioning normally.</p>
                </div>
            </div>
        `;

    try {
        await transporter.sendMail({
            from: `"Voice Monitor" <${process.env.SMTP_USER}>`,
            to: process.env.ALERT_RECIPIENT,
            subject: subject,
            text: text,
            html: html,
        });
        console.log(`[MAILER] Sent ${isDown ? 'DOWN' : 'UP'} alert email for ${server.name}`);
    } catch (error) {
        console.error(`[MAILER] Failed to send email for ${server.name}:`, error.message);
    }
}

module.exports = { sendAlertEmail };
