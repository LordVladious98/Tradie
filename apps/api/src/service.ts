import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InvoiceStatus, JobStatus, Role } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const formatSeq = (prefix: string, n: number) => `${prefix}-${String(n).padStart(6, '0')}`;

@Injectable()
export class AppService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  async registerOwner(body: any) {
    const existing = await this.prisma.user.findUnique({ where: { email: body.email } });
    if (existing) throw new BadRequestException('An account with this email already exists');

    const passwordHash = await bcrypt.hash(body.password, 10);
    const created = await this.prisma.business.create({
      data: {
        name: body.businessName,
        email: body.businessEmail,
        subscription: { create: { plan: 'FREE', status: 'TRIALING', trialEndsAt: new Date(Date.now() + 14 * 86400_000) } },
        users: { create: { name: body.name, email: body.email, passwordHash, role: Role.OWNER } },
      },
      include: { users: true },
    });
    return this.tokensForUser(created.users[0]);
  }

  async login(body: any) {
    const user = await this.prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) throw new UnauthorizedException('Invalid credentials');
    if (!user.isActive) throw new UnauthorizedException('Account is deactivated');
    return this.tokensForUser(user);
  }

  async refresh(refreshToken: string) {
    const payload = this.jwt.verify(refreshToken, { secret: process.env.JWT_REFRESH_SECRET });
    const records = await this.prisma.refreshToken.findMany({ where: { userId: payload.sub, revokedAt: null, expiresAt: { gt: new Date() } } });
    const match = await Promise.any(records.map(async (r) => (await bcrypt.compare(refreshToken, r.tokenHash)) ? r : Promise.reject())).catch(() => null);
    if (!match) throw new UnauthorizedException('Refresh token invalid');
    await this.prisma.refreshToken.update({ where: { id: match.id }, data: { revokedAt: new Date() } });
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });
    return this.tokensForUser(user);
  }

  async logout(refreshToken: string) {
    const payload = this.jwt.verify(refreshToken, { secret: process.env.JWT_REFRESH_SECRET });
    const tokens = await this.prisma.refreshToken.findMany({ where: { userId: payload.sub, revokedAt: null } });
    for (const token of tokens) if (await bcrypt.compare(refreshToken, token.tokenHash)) await this.prisma.refreshToken.update({ where: { id: token.id }, data: { revokedAt: new Date() } });
    return { ok: true };
  }

  // Password reset
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always return success to prevent email enumeration
    if (!user) return { ok: true, message: 'If an account exists, a reset link has been sent' };

    // Generate a cryptographically secure token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(rawToken, 10);

    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    // Return the token — the controller will send it via email
    return { ok: true, message: 'If an account exists, a reset link has been sent', _resetToken: rawToken, _userId: user.id };
  }

  async resetPassword(token: string, newPassword: string) {
    // Find all non-expired, non-used reset tokens
    const resets = await this.prisma.passwordReset.findMany({
      where: { usedAt: null, expiresAt: { gt: new Date() } },
    });

    let matched: any = null;
    for (const r of resets) {
      if (await bcrypt.compare(token, r.tokenHash)) { matched = r; break; }
    }

    if (!matched) throw new BadRequestException('Invalid or expired reset token');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: matched.userId }, data: { passwordHash } });
    await this.prisma.passwordReset.update({ where: { id: matched.id }, data: { usedAt: new Date() } });

    // Revoke all refresh tokens for security
    await this.prisma.refreshToken.updateMany({ where: { userId: matched.userId, revokedAt: null }, data: { revokedAt: new Date() } });

    return { ok: true, message: 'Password has been reset. Please log in with your new password.' };
  }

  // ABN Verification
  async verifyAbn(businessId: string, abn: string) {
    // ABN format validation: 11 digits
    const cleanAbn = abn.replace(/\s/g, '');
    if (!/^\d{11}$/.test(cleanAbn)) throw new BadRequestException('ABN must be 11 digits');

    // ABN checksum validation (Australian algorithm)
    const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
    const digits = cleanAbn.split('').map(Number);
    digits[0] -= 1; // Subtract 1 from first digit per ABN algorithm
    const sum = digits.reduce((acc, d, i) => acc + d * weights[i], 0);
    if (sum % 89 !== 0) throw new BadRequestException('Invalid ABN checksum');

    // Call ABR (Australian Business Register) lookup API
    let entityName: string | null = null;
    try {
      const guid = process.env.ABR_GUID || '';
      if (guid) {
        const res = await fetch(`https://abr.business.gov.au/json/AbnDetails.aspx?abn=${cleanAbn}&callback=c&guid=${guid}`);
        const text = await res.text();
        const json = JSON.parse(text.replace(/^c\(/, '').replace(/\)$/, ''));
        if (json.Abn && json.EntityName) {
          entityName = json.EntityName;
        }
      }
    } catch {
      // ABR API unavailable — still mark as verified via checksum
    }

    const updated = await this.prisma.business.update({
      where: { id: businessId },
      data: {
        abn: cleanAbn,
        abnVerified: true,
        abnVerifiedAt: new Date(),
        abnEntityName: entityName,
      },
    });

    return { verified: true, abn: cleanAbn, entityName: entityName || updated.name };
  }

  // Subscription
  async getSubscription(businessId: string) {
    let sub = await this.prisma.subscription.findUnique({ where: { businessId } });
    if (!sub) {
      sub = await this.prisma.subscription.create({
        data: { businessId, plan: 'FREE', status: 'TRIALING', trialEndsAt: new Date(Date.now() + 14 * 86400_000) },
      });
    }
    const isActive = sub.status === 'ACTIVE' || (sub.status === 'TRIALING' && sub.trialEndsAt && sub.trialEndsAt > new Date());
    return { ...sub, isActive };
  }

  async handleSubscriptionWebhook(payload: any) {
    // ============================================================
    // PLACEHOLDER: Wire this up to your payment provider's webhooks.
    // Supported events to handle:
    //   - checkout.session.completed → activate subscription
    //   - invoice.paid → renew period
    //   - invoice.payment_failed → mark past_due
    //   - customer.subscription.deleted → cancel
    //
    // Example for Stripe:
    //   const event = stripe.webhooks.constructEvent(body, sig, secret);
    //   switch (event.type) { ... }
    // ============================================================
    const { businessId, plan, status, externalCustomerId, externalSubId, currentPeriodEnd } = payload;

    return this.prisma.subscription.upsert({
      where: { businessId },
      update: { plan, status, externalCustomerId, externalSubId, currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd) : undefined },
      create: { businessId, plan, status, externalCustomerId, externalSubId, currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd) : undefined },
    });
  }

  // Payment reminders
  async sendOverdueReminders(businessId: string) {
    const overdueInvoices = await this.prisma.invoice.findMany({
      where: {
        businessId,
        status: InvoiceStatus.SENT,
        dueDate: { lt: new Date() },
      },
      include: { job: { include: { customer: true } } },
    });
    return overdueInvoices;
  }

  async tokensForUser(user: any) {
    const claims = { sub: user.id, businessId: user.businessId, role: user.role, email: user.email };
    const accessToken = await this.jwt.signAsync(claims, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' });
    const refreshToken = await this.jwt.signAsync(claims, { secret: process.env.JWT_REFRESH_SECRET, expiresIn: '30d' });
    await this.prisma.refreshToken.create({ data: { userId: user.id, tokenHash: await bcrypt.hash(refreshToken, 10), expiresAt: new Date(Date.now() + 30 * 86400_000) } });
    return { user: { id: user.id, name: user.name, email: user.email, role: user.role, businessId: user.businessId }, tokens: { accessToken, refreshToken } };
  }

  totals(items: any[], discount = 0, gstEnabled = true, gstRate = 0.1) {
    const lineItems = items.map((i) => ({ ...i, lineTotal: round2(Number(i.quantity) * Number(i.unitPrice)) }));
    const subtotal = round2(lineItems.reduce((s, i) => s + i.lineTotal, 0));
    const gstAmount = gstEnabled ? round2(subtotal * gstRate) : 0;
    const total = round2(subtotal + gstAmount - Number(discount || 0));
    return { lineItems, subtotal, gstAmount, total, discountAmount: round2(Number(discount || 0)) };
  }

  async nextQuoteNumber(businessId: string) { return this.prisma.$transaction(async tx => { const b = await tx.business.update({ where: { id: businessId }, data: { quoteSeq: { increment: 1 } } }); return formatSeq('Q', b.quoteSeq); }); }
  async nextInvoiceNumber(businessId: string) { return this.prisma.$transaction(async tx => { const b = await tx.business.update({ where: { id: businessId }, data: { invoiceSeq: { increment: 1 } } }); return formatSeq('INV', b.invoiceSeq); }); }

  async audit(user: any, entityType: string, entityId: string, action: string, metadata?: any) { await this.prisma.auditLog.create({ data: { businessId: user.businessId, userId: user.sub, entityType, entityId, action, metadata } }); }

  assertForward(curr: JobStatus, next: JobStatus, force = false) {
    if (force) return;
    if (next === JobStatus.CANCELLED && curr !== JobStatus.PAID) return;
    const path: JobStatus[] = [JobStatus.LEAD, JobStatus.QUOTED, JobStatus.SCHEDULED, JobStatus.IN_PROGRESS, JobStatus.COMPLETED, JobStatus.INVOICED, JobStatus.PAID];
    if (path.indexOf(next) !== path.indexOf(curr) + 1) throw new BadRequestException('Invalid status transition');
  }

  overdue(invoice: any) {
    const isOverdue = invoice.status === InvoiceStatus.SENT && invoice.dueDate && new Date(invoice.dueDate) < new Date();
    return { ...invoice, isOverdue, computedStatus: isOverdue ? InvoiceStatus.OVERDUE : invoice.status };
  }

  whereScoped(user: any, extra: any = {}) { return { businessId: user.businessId, ...extra }; }
}
