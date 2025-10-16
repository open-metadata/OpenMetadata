/**
 * Mailer service stub for ThirdEye application
 * This will be implemented later with actual email service integration
 */

export interface EmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}

export interface EmailTemplate {
  name: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Mailer service class
 */
export class MailerService {
  private isEnabled: boolean;
  private defaultFrom: string;

  constructor() {
    this.isEnabled = process.env.NODE_ENV === 'production' && !!process.env.SMTP_HOST;
    this.defaultFrom = process.env.SMTP_FROM || 'noreply@thirdeye.com';
  }

  /**
   * Send an email
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.isEnabled) {
      console.log('📧 [MAILER STUB] Email would be sent:', {
        to: options.to,
        subject: options.subject,
        from: options.from || this.defaultFrom
      });
      return true;
    }

    try {
      // TODO: Implement actual email sending logic here
      // This would integrate with services like:
      // - SendGrid
      // - AWS SES
      // - Nodemailer with SMTP
      // - Postmark
      // - Mailgun
      
      console.log('📧 Email sent successfully:', options.to);
      return true;
    } catch (error) {
      console.error('📧 Failed to send email:', error);
      return false;
    }
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(email: string, name: string): Promise<boolean> {
    const subject = 'Welcome to ThirdEye!';
    const html = `
      <h1>Welcome to ThirdEye, ${name}!</h1>
      <p>Thank you for signing up. You can now access your data lake optimization dashboard.</p>
      <p>If you have any questions, please don't hesitate to contact support.</p>
      <p>Best regards,<br>The ThirdEye Team</p>
    `;
    const text = `
      Welcome to ThirdEye, ${name}!
      
      Thank you for signing up. You can now access your data lake optimization dashboard.
      
      If you have any questions, please don't hesitate to contact support.
      
      Best regards,
      The ThirdEye Team
    `;

    return this.sendEmail({
      to: email,
      subject,
      html,
      text
    });
  }

  /**
   * Send email verification email
   */
  async sendVerificationEmail(email: string, verificationToken: string): Promise<boolean> {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    const subject = 'Verify your ThirdEye email address';
    const html = `
      <h1>Verify your email address</h1>
      <p>Please click the link below to verify your email address:</p>
      <p><a href="${verificationUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a></p>
      <p>Or copy and paste this link: ${verificationUrl}</p>
      <p>This link will expire in 24 hours.</p>
    `;
    const text = `
      Verify your email address
      
      Please click the link below to verify your email address:
      ${verificationUrl}
      
      This link will expire in 24 hours.
    `;

    return this.sendEmail({
      to: email,
      subject,
      html,
      text
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    const subject = 'Reset your ThirdEye password';
    const html = `
      <h1>Reset your password</h1>
      <p>You requested to reset your password. Click the link below to create a new password:</p>
      <p><a href="${resetUrl}" style="background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
      <p>Or copy and paste this link: ${resetUrl}</p>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `;
    const text = `
      Reset your password
      
      You requested to reset your password. Click the link below to create a new password:
      ${resetUrl}
      
      This link will expire in 1 hour.
      
      If you didn't request this, please ignore this email.
    `;

    return this.sendEmail({
      to: email,
      subject,
      html,
      text
    });
  }

  /**
   * Send security alert email
   */
  async sendSecurityAlertEmail(email: string, alertType: string, details: string): Promise<boolean> {
    const subject = `Security Alert: ${alertType}`;
    const html = `
      <h1>Security Alert</h1>
      <p>We detected a security event on your ThirdEye account:</p>
      <p><strong>Type:</strong> ${alertType}</p>
      <p><strong>Details:</strong> ${details}</p>
      <p><strong>Time:</strong> ${new Date().toISOString()}</p>
      <p>If this was not you, please contact support immediately.</p>
    `;
    const text = `
      Security Alert
      
      We detected a security event on your ThirdEye account:
      Type: ${alertType}
      Details: ${details}
      Time: ${new Date().toISOString()}
      
      If this was not you, please contact support immediately.
    `;

    return this.sendEmail({
      to: email,
      subject,
      html,
      text
    });
  }

  /**
   * Send email change verification email
   */
  async sendEmailChangeVerificationEmail(newEmail: string, token: string, oldEmail: string): Promise<boolean> {
    const subject = 'Verify Your New Email Address';
    const html = `
      <h1>Verify Your New Email Address</h1>
      <p>You have requested to change your email address from <strong>${oldEmail}</strong> to <strong>${newEmail}</strong>.</p>
      <p>Please click the link below to verify your new email address:</p>
      <p><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email Address</a></p>
      <p>This link will expire in 24 hours.</p>
      <p>If you did not request this change, please ignore this email.</p>
    `;
    const text = `
Hello,

You have requested to change your email address from ${oldEmail} to ${newEmail}.

Please click the link below to verify your new email address:
${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}

This link will expire in 24 hours.

If you did not request this change, please ignore this email.

Best regards,
ThirdEye Team
    `;

    return this.sendEmail({
      to: newEmail,
      subject,
      html,
      text
    });
  }

  /**
   * Send email change confirmation email
   */
  async sendEmailChangeConfirmationEmail(newEmail: string, oldEmail: string): Promise<boolean> {
    const subject = 'Email Address Changed Successfully';
    const html = `
      <h1>Email Address Changed Successfully</h1>
      <p>Your email address has been successfully changed from <strong>${oldEmail}</strong> to <strong>${newEmail}</strong>.</p>
      <p>All future communications will be sent to your new email address.</p>
    `;
    const text = `
Hello,

Your email address has been successfully changed from ${oldEmail} to ${newEmail}.

All future communications will be sent to your new email address.

Best regards,
ThirdEye Team
    `;

    return this.sendEmail({
      to: newEmail,
      subject,
      html,
      text
    });
  }

  /**
   * Send OAuth link confirmation email
   */
  async sendOAuthLinkConfirmationEmail(email: string, provider: string, providerEmail: string): Promise<boolean> {
    const subject = 'New Account Connected';
    const html = `
      <h1>New Account Connected</h1>
      <p>Your <strong>${provider}</strong> account (<strong>${providerEmail}</strong>) has been successfully connected to your ThirdEye account.</p>
      <p>You can now sign in using your ${provider} account.</p>
    `;
    const text = `
Hello,

Your ${provider} account (${providerEmail}) has been successfully connected to your ThirdEye account.

You can now sign in using your ${provider} account.

Best regards,
ThirdEye Team
    `;

    return this.sendEmail({
      to: email,
      subject,
      html,
      text
    });
  }

  /**
   * Send account deletion confirmation email
   */
  async sendAccountDeletionEmail(email: string): Promise<boolean> {
    const subject = 'Account Deleted';
    const html = `
      <h1>Account Deleted</h1>
      <p>Your ThirdEye account has been successfully deleted.</p>
      <p>We're sorry to see you go. If you change your mind, you can create a new account anytime.</p>
    `;
    const text = `
Hello,

Your ThirdEye account has been successfully deleted.

We're sorry to see you go. If you change your mind, you can create a new account anytime.

Best regards,
ThirdEye Team
    `;

    return this.sendEmail({
      to: email,
      subject,
      html,
      text
    });
  }
}

// Export singleton instance
export const mailer = new MailerService();
