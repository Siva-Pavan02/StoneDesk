const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || 'StoneDesk <noreply@stonedesk.app>';
  
  if (!host || !user || !pass) {
    console.warn('SMTP credentials not configured, email sending will fail');
    return null;
  }
  
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    from
  });
  
  return transporter;
}

async function sendPasswordResetEmail(email, resetUrl, businessName) {
  const transporter = getTransporter();
  if (!transporter) {
    throw new Error('Email service not configured');
  }
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #111827; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #f8fbfa; border-radius: 12px; padding: 32px; border: 1px solid #dce3e2;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 12px; background: #115e59; color: white; font-size: 20px;">SD</div>
          <h1 style="margin: 16px 0 0; font-size: 24px; font-weight: 700; color: #111827;">StoneDesk</h1>
        </div>
        
        <p style="font-size: 16px; color: #374151; margin-bottom: 24px;">You requested a password reset for your <strong>${businessName || 'StoneDesk'}</strong> account.</p>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetUrl}" style="display: inline-block; background: #115e59; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Reset Password</a>
        </div>
        
        <p style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">This link expires in 1 hour for security.</p>
        <p style="font-size: 14px; color: #6b7280;">If you didn't request this, you can safely ignore this email.</p>
        
        <hr style="border: none; border-top: 1px solid #dce3e2; margin: 24px 0;">
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">StoneDesk - Granite Yard Management</p>
      </div>
    </body>
    </html>
  `;
  
  const text = `
    StoneDesk Password Reset
    
    You requested a password reset for your ${businessName || 'StoneDesk'} account.
    
    Reset your password: ${resetUrl}
    
    This link expires in 1 hour for security.
    
    If you didn't request this, you can safely ignore this email.
    
    StoneDesk - Granite Yard Management
  `;
  
  await transporter.sendMail({
    to: email,
    subject: 'Reset your StoneDesk password',
    text,
    html
  });
}

module.exports = { sendPasswordResetEmail };