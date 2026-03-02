import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InvoiceStatus, JobStatus, PaymentMethod, Prisma, QuoteStatus, Role } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { stringify } from 'csv-stringify/sync';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const formatSeq = (prefix: string, n: number) => `${prefix}-${String(n).padStart(6, '0')}`;

@Injectable()
export class AppService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  async registerOwner(body: any) {
    const passwordHash = await bcrypt.hash(body.password, 10);
    const created = await this.prisma.business.create({ data: { name: body.businessName, email: body.businessEmail, users: { create: { name: body.name, email: body.email, passwordHash, role: Role.OWNER } } }, include: { users: true } });
    return this.tokensForUser(created.users[0]);
  }
  async login(body: any) {
    const user = await this.prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) throw new UnauthorizedException('Invalid credentials');
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
    const path = [JobStatus.LEAD, JobStatus.QUOTED, JobStatus.SCHEDULED, JobStatus.IN_PROGRESS, JobStatus.COMPLETED, JobStatus.INVOICED, JobStatus.PAID];
    if (path.indexOf(next) !== path.indexOf(curr) + 1) throw new BadRequestException('Invalid status transition');
  }

  overdue(invoice: any) {
    const isOverdue = invoice.status === InvoiceStatus.SENT && invoice.dueDate && new Date(invoice.dueDate) < new Date();
    return { ...invoice, isOverdue, computedStatus: isOverdue ? InvoiceStatus.OVERDUE : invoice.status };
  }

  whereScoped(user: any, extra: any = {}) { return { businessId: user.businessId, ...extra }; }
}
