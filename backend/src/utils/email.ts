import nodemailer from 'nodemailer';
import crypto from 'crypto';

// Email configuration from environment variables
const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || '587');
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@twitterclone.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * Create email transporter
 * For development, uses ethereal.email if credentials not provided
 */
const createTransporter = async () => {
  // Production: Use real SMTP credentials
  if (EMAIL_USER && EMAIL_PASSWORD) {
    return nodemailer.createTransport({
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: EMAIL_PORT === 465,
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASSWORD,
      },
    });
  }

  // Development: Use Ethereal (test email service)
  const testAccount = await nodemailer.createTestAccount();
  const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });

  return transporter;
};

/**
 * Generate a secure random token
 */
export const generateToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Send email verification email
 */
export const sendVerificationEmail = async (
  email: string,
  username: string,
  token: string
): Promise<void> => {
  const verificationUrl = `${FRONTEND_URL}/verify-email?token=${token}`;

  const transporter = await createTransporter();

  const mailOptions = {
    from: EMAIL_FROM,
    to: email,
    subject: 'Verify Your Email - Twitter Clone',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background-color: #1DA1F2;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 5px 5px 0 0;
            }
            .content {
              background-color: #f5f8fa;
              padding: 30px;
              border-radius: 0 0 5px 5px;
            }
            .button {
              display: inline-block;
              padding: 12px 24px;
              background-color: #1DA1F2;
              color: white !important;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
              font-weight: bold;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              font-size: 12px;
              color: #666;
            }
            .code {
              background-color: #e1e8ed;
              padding: 10px;
              border-radius: 3px;
              font-family: monospace;
              word-break: break-all;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Welcome to Twitter Clone!</h1>
          </div>
          <div class="content">
            <h2>Hi ${username},</h2>
            <p>Thank you for signing up! Please verify your email address to complete your registration.</p>
            <p style="text-align: center;">
              <a href="${verificationUrl}" class="button">Verify Email Address</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p class="code">${verificationUrl}</p>
            <p><strong>This link will expire in 24 hours.</strong></p>
            <p>If you didn't create an account with Twitter Clone, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </body>
      </html>
    `,
    text: `
      Hi ${username},

      Thank you for signing up! Please verify your email address to complete your registration.

      Click the link below to verify your email:
      ${verificationUrl}

      This link will expire in 24 hours.

      If you didn't create an account with Twitter Clone, you can safely ignore this email.
    `,
  };

  const info = await transporter.sendMail(mailOptions);

  // Log preview URL for development
  if (!EMAIL_USER || !EMAIL_PASSWORD) {
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
  }
};

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (
  email: string,
  username: string,
  token: string
): Promise<void> => {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`;

  const transporter = await createTransporter();

  const mailOptions = {
    from: EMAIL_FROM,
    to: email,
    subject: 'Reset Your Password - Twitter Clone',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background-color: #1DA1F2;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 5px 5px 0 0;
            }
            .content {
              background-color: #f5f8fa;
              padding: 30px;
              border-radius: 0 0 5px 5px;
            }
            .button {
              display: inline-block;
              padding: 12px 24px;
              background-color: #1DA1F2;
              color: white !important;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
              font-weight: bold;
            }
            .warning {
              background-color: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 15px;
              margin: 20px 0;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              font-size: 12px;
              color: #666;
            }
            .code {
              background-color: #e1e8ed;
              padding: 10px;
              border-radius: 3px;
              font-family: monospace;
              word-break: break-all;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hi ${username},</h2>
            <p>We received a request to reset your password for your Twitter Clone account.</p>
            <p style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p class="code">${resetUrl}</p>
            <p><strong>This link will expire in 1 hour.</strong></p>
            <div class="warning">
              <strong>Security Notice:</strong> If you didn't request a password reset, please ignore this email or contact support if you're concerned about your account security.
            </div>
          </div>
          <div class="footer">
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </body>
      </html>
    `,
    text: `
      Hi ${username},

      We received a request to reset your password for your Twitter Clone account.

      Click the link below to reset your password:
      ${resetUrl}

      This link will expire in 1 hour.

      If you didn't request a password reset, please ignore this email or contact support if you're concerned about your account security.
    `,
  };

  const info = await transporter.sendMail(mailOptions);

  // Log preview URL for development
  if (!EMAIL_USER || !EMAIL_PASSWORD) {
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
  }
};

/**
 * Send account locked notification
 */
export const sendAccountLockedEmail = async (
  email: string,
  username: string,
  unlockTime: Date
): Promise<void> => {
  const transporter = await createTransporter();

  const mailOptions = {
    from: EMAIL_FROM,
    to: email,
    subject: 'Account Temporarily Locked - Twitter Clone',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background-color: #dc3545;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 5px 5px 0 0;
            }
            .content {
              background-color: #f5f8fa;
              padding: 30px;
              border-radius: 0 0 5px 5px;
            }
            .warning {
              background-color: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 15px;
              margin: 20px 0;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              font-size: 12px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Account Temporarily Locked</h1>
          </div>
          <div class="content">
            <h2>Hi ${username},</h2>
            <p>Your account has been temporarily locked due to multiple failed login attempts.</p>
            <div class="warning">
              <strong>Your account will be automatically unlocked at:</strong><br>
              ${unlockTime.toLocaleString()}
            </div>
            <p>This is a security measure to protect your account from unauthorized access attempts.</p>
            <p><strong>What you can do:</strong></p>
            <ul>
              <li>Wait for the automatic unlock time</li>
              <li>If this wasn't you, consider changing your password once unlocked</li>
              <li>Contact support if you believe this is an error</li>
            </ul>
          </div>
          <div class="footer">
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </body>
      </html>
    `,
    text: `
      Hi ${username},

      Your account has been temporarily locked due to multiple failed login attempts.

      Your account will be automatically unlocked at: ${unlockTime.toLocaleString()}

      This is a security measure to protect your account from unauthorized access attempts.

      What you can do:
      - Wait for the automatic unlock time
      - If this wasn't you, consider changing your password once unlocked
      - Contact support if you believe this is an error
    `,
  };

  const info = await transporter.sendMail(mailOptions);

  // Log preview URL for development
  if (!EMAIL_USER || !EMAIL_PASSWORD) {
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
  }
};

/**
 * Send new device login alert
 */
export const sendNewDeviceAlert = async (
  email: string,
  username: string,
  deviceInfo: string,
  ipAddress: string,
  location: string | null,
  loginTime: Date
): Promise<void> => {
  const transporter = await createTransporter();

  const mailOptions = {
    from: EMAIL_FROM,
    to: email,
    subject: 'New Device Login Detected',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #ff9800; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
            .alert-box { background-color: #fff3cd; border-left: 4px solid #ff9800; padding: 15px; margin: 20px 0; }
            .device-info { background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .button { display: inline-block; padding: 12px 24px; background-color: #ff9800; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>New Device Login Alert</h2>
            </div>
            <div class="content">
              <p>Hi ${username},</p>
              <div class="alert-box">
                <strong>⚠️ We detected a login from a new device</strong>
              </div>
              <p>A login to your account was detected from a device we haven't seen before:</p>
              <div class="device-info">
                <p><strong>Device:</strong> ${deviceInfo}</p>
                <p><strong>IP Address:</strong> ${ipAddress}</p>
                ${location ? `<p><strong>Location:</strong> ${location}</p>` : ''}
                <p><strong>Time:</strong> ${loginTime.toLocaleString()}</p>
              </div>
              <p><strong>Was this you?</strong></p>
              <p>If you recognize this login, you can safely ignore this email.</p>
              <p>If you don't recognize this activity:</p>
              <ul>
                <li>Change your password immediately</li>
                <li>Review your active sessions and log out from unrecognized devices</li>
                <li>Enable two-factor authentication if you haven't already</li>
              </ul>
              <p>
                <a href="${FRONTEND_URL}/security" class="button">Review Security Settings</a>
              </p>
            </div>
            <div class="footer">
              <p>This is an automated security alert. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      Hi ${username},

      NEW DEVICE LOGIN ALERT

      We detected a login from a device we haven't seen before:

      Device: ${deviceInfo}
      IP Address: ${ipAddress}
      ${location ? `Location: ${location}` : ''}
      Time: ${loginTime.toLocaleString()}

      Was this you?

      If you recognize this login, you can safely ignore this email.

      If you don't recognize this activity:
      - Change your password immediately
      - Review your active sessions and log out from unrecognized devices
      - Enable two-factor authentication if you haven't already

      Review your security settings: ${FRONTEND_URL}/security
    `,
  };

  const info = await transporter.sendMail(mailOptions);

  if (!EMAIL_USER || !EMAIL_PASSWORD) {
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
  }
};

/**
 * Send suspicious login attempt alert
 */
export const sendSuspiciousLoginAlert = async (
  email: string,
  username: string,
  reason: string,
  ipAddress: string,
  attemptTime: Date
): Promise<void> => {
  const transporter = await createTransporter();

  const mailOptions = {
    from: EMAIL_FROM,
    to: email,
    subject: 'Suspicious Login Attempt Detected',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #dc3545; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
            .alert-box { background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0; }
            .button { display: inline-block; padding: 12px 24px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>🚨 Suspicious Login Attempt</h2>
            </div>
            <div class="content">
              <p>Hi ${username},</p>
              <div class="alert-box">
                <strong>We detected suspicious activity on your account</strong>
              </div>
              <p>Details of the suspicious attempt:</p>
              <ul>
                <li><strong>Reason:</strong> ${reason}</li>
                <li><strong>IP Address:</strong> ${ipAddress}</li>
                <li><strong>Time:</strong> ${attemptTime.toLocaleString()}</li>
              </ul>
              <p><strong>Immediate action required:</strong></p>
              <ol>
                <li>Review your recent login activity</li>
                <li>Change your password if you don't recognize this attempt</li>
                <li>Enable two-factor authentication for added security</li>
                <li>Log out from all devices you don't recognize</li>
              </ol>
              <p>
                <a href="${FRONTEND_URL}/security" class="button">Secure My Account</a>
              </p>
            </div>
            <div class="footer">
              <p>This is an automated security alert. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      Hi ${username},

      SUSPICIOUS LOGIN ATTEMPT DETECTED

      We detected suspicious activity on your account.

      Details:
      - Reason: ${reason}
      - IP Address: ${ipAddress}
      - Time: ${attemptTime.toLocaleString()}

      IMMEDIATE ACTION REQUIRED:
      1. Review your recent login activity
      2. Change your password if you don't recognize this attempt
      3. Enable two-factor authentication for added security
      4. Log out from all devices you don't recognize

      Secure your account: ${FRONTEND_URL}/security
    `,
  };

  const info = await transporter.sendMail(mailOptions);

  if (!EMAIL_USER || !EMAIL_PASSWORD) {
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
  }
};

/**
 * Generic email sending function (for 2FA codes, etc.)
 */
export const sendEmail = async (
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<void> => {
  const transporter = await createTransporter();

  const mailOptions = {
    from: EMAIL_FROM,
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML if no text provided
  };

  const info = await transporter.sendMail(mailOptions);

  if (!EMAIL_USER || !EMAIL_PASSWORD) {
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
  }
};
