import nodemailer, { type Transporter } from 'nodemailer';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  fromName?: string;
  requireLiveDelivery?: boolean;
}

export interface EmailSendResult {
  success: boolean;
  messageId: string;
  simulated: boolean;
  recipient: string;
  error?: string;
}

function htmlToText(html: string): string {
  return html
    .replace(/<(head|style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|tr|h[1-6]|table)>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

class EmailService {
  private transporter: Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  /**
   * Initializes or refreshes the nodemailer transporter from current environment variables.
   */
  public initTransporter(): void {
    const host = process.env.LEGERCRM_SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.LEGERCRM_SMTP_PORT) || 587;
    const secure = process.env.LEGERCRM_SMTP_SECURE === 'true' || port === 465;
    const user = process.env.LEGERCRM_SMTP_USER || process.env.LEGERCRM_EMAIL_FROM_ADDRESS || '';
    const pass = process.env.LEGERCRM_SMTP_PASS || process.env.LEGERCRM_SMTP_SECRET || process.env.LEGERCRM_EMAIL_PROVIDER_API_KEY || '';

    // Check if real credentials are provided (not placeholders)
    const isConfigured = Boolean(
      user &&
      pass &&
      !pass.includes('replace_with_') &&
      !user.includes('replace_with_')
    );

    if (isConfigured) {
      try {
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure,
          auth: {
            user,
            pass,
          },
          tls: {
            rejectUnauthorized: process.env.LEGERCRM_NODE_ENV === 'production',
          },
        });
        console.log(`[EmailService] SMTP Transporter configured for host: ${host}:${port} (${user})`);
      } catch (err) {
        console.error('[EmailService] Failed to create SMTP transporter:', err);
        this.transporter = null;
      }
    } else {
      this.transporter = null;
    }
  }

  /**
   * Checks if live SMTP credentials are ready.
   */
  public isSmtpConfigured(): boolean {
    const user = process.env.LEGERCRM_SMTP_USER || process.env.LEGERCRM_EMAIL_FROM_ADDRESS || '';
    const pass = process.env.LEGERCRM_SMTP_PASS || process.env.LEGERCRM_SMTP_SECRET || process.env.LEGERCRM_EMAIL_PROVIDER_API_KEY || '';
    return Boolean(
      user &&
      pass &&
      !pass.includes('replace_with_') &&
      !user.includes('replace_with_')
    );
  }

  /**
   * Verifies SMTP connection health.
   */
  public async verifyConnection(): Promise<{ connected: boolean; message: string }> {
    this.initTransporter();
    if (!this.transporter) {
      return {
        connected: false,
        message: 'SMTP credentials not configured in backend/.env (using fallback simulated delivery).',
      };
    }

    try {
      await this.transporter.verify();
      return { connected: true, message: 'SMTP server connection established successfully.' };
    } catch (err: any) {
      return { connected: false, message: err?.message || 'Failed to connect to SMTP server.' };
    }
  }

  /**
   * Sends an email via SMTP or simulated dispatch if credentials are unset.
   */
  public async sendEmail(options: EmailOptions): Promise<EmailSendResult> {
    const fromAddress = process.env.LEGERCRM_EMAIL_FROM_ADDRESS || process.env.LEGERCRM_SMTP_USER || 'billing@ledgerflow.local';
    const fromName = (options.fromName || process.env.LEGERCRM_SMTP_FROM_NAME || 'LedgerFlow CRM Notifications').replace(/[\r\n"]/g, '').trim();
    const fromHeader = `"${fromName}" <${fromAddress}>`;

    // Attempt live delivery if transporter is active
    if (this.transporter && this.isSmtpConfigured()) {
      try {
        const info = await this.transporter.sendMail({
          from: fromHeader,
          to: options.to,
          subject: options.subject,
          text: options.text || htmlToText(options.html),
          html: options.html,
          replyTo: options.replyTo || fromAddress,
        });

        console.log(`[EmailService] Live email dispatched to ${options.to} (MessageId: ${info.messageId})`);
        return {
          success: true,
          messageId: info.messageId,
          simulated: false,
          recipient: options.to,
        };
      } catch (err: any) {
        console.error(`[EmailService] Live SMTP delivery failed, falling back to simulated log:`, err?.message);
        if (options.requireLiveDelivery) {
          return { success: false, messageId: '', simulated: false, recipient: options.to, error: err?.message || 'SMTP delivery failed.' };
        }
      }
    }

    if (options.requireLiveDelivery) {
      return { success: false, messageId: '', simulated: false, recipient: options.to, error: 'SMTP is not configured.' };
    }

    // Simulated Delivery Fallback for test / development environments
    const simulatedId = `sim_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    console.log(`[EmailService:Simulated] To: ${options.to} | Subject: "${options.subject}" | ID: ${simulatedId}`);

    return {
      success: true,
      messageId: simulatedId,
      simulated: true,
      recipient: options.to,
    };
  }
}

export const emailService = new EmailService();
export default emailService;
