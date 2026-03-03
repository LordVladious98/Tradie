import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    if (process.env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      });
    }
  }

  async sendDocument(opts: {
    to: string;
    businessName: string;
    documentType: 'Quote' | 'Invoice';
    documentNumber: string;
    pdfBuffer: Buffer;
  }) {
    if (!this.transporter) {
      this.logger.warn('SMTP not configured — skipping email send');
      return { sent: false, reason: 'SMTP not configured' };
    }

    const fromAddress = process.env.SMTP_FROM || `noreply@tradieflow.app`;
    const filename = `${opts.documentType}_${opts.documentNumber}.pdf`;

    await this.transporter.sendMail({
      from: `"${opts.businessName}" <${fromAddress}>`,
      to: opts.to,
      subject: `${opts.documentType} ${opts.documentNumber} from ${opts.businessName}`,
      text: [
        `Hi,`,
        ``,
        `Please find attached ${opts.documentType.toLowerCase()} ${opts.documentNumber} from ${opts.businessName}.`,
        ``,
        `Thank you for your business.`,
        ``,
        `— ${opts.businessName}`,
      ].join('\n'),
      html: [
        `<p>Hi,</p>`,
        `<p>Please find attached ${opts.documentType.toLowerCase()} <strong>${opts.documentNumber}</strong> from <strong>${opts.businessName}</strong>.</p>`,
        `<p>Thank you for your business.</p>`,
        `<p>&mdash; ${opts.businessName}</p>`,
      ].join('\n'),
      attachments: [
        { filename, content: opts.pdfBuffer, contentType: 'application/pdf' },
      ],
    });

    this.logger.log(`Sent ${opts.documentType} ${opts.documentNumber} to ${opts.to}`);
    return { sent: true };
  }
}
