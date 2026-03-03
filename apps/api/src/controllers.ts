import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InvoiceStatus, PaymentMethod, QuoteStatus, Role } from '@prisma/client';
import { Response } from 'express';
import { diskStorage } from 'multer';
import { stringify } from 'csv-stringify/sync';
import { AppService } from './service';
import { PrismaService } from './prisma.service';
import { PdfService } from './pdf.service';
import { EmailService } from './email.service';
import { NotificationService } from './notification.service';
import { AuthGuard, Roles, RolesGuard } from './auth';
import {
  RegisterOwnerDto, LoginDto, ForgotPasswordDto, ResetPasswordDto,
  CreateStaffDto, UpdateStaffDto,
  CreateCustomerDto, UpdateCustomerDto, CreateJobDto, UpdateJobDto,
  UpdateJobStatusDto, CreateJobNoteDto, CreateQuoteDto, UpdateQuoteDto,
  CreateInvoiceDto, UpdateInvoiceDto, MarkPaidDto, UpdateBusinessDto,
  VerifyAbnDto,
} from './dto';
import * as bcrypt from 'bcrypt';

const PAGE_SIZE = 20;

@Controller()
export class AppController {
  constructor(private svc: AppService, private prisma: PrismaService, private pdf: PdfService, private email: EmailService, private notifications: NotificationService) {}

  // ─── Auth ────────────────────────────────────────────────────
  @Post('auth/register-owner')
  registerOwner(@Body() body: RegisterOwnerDto) {
    return this.svc.registerOwner(body);
  }

  @Post('auth/login')
  login(@Body() body: LoginDto) {
    return this.svc.login(body);
  }

  @Post('auth/refresh')
  refresh(@Body('refreshToken') rt: string) {
    return this.svc.refresh(rt);
  }

  @Post('auth/logout')
  logout(@Body('refreshToken') rt: string) {
    return this.svc.logout(rt);
  }

  @Post('auth/forgot-password')
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    const result = await this.svc.forgotPassword(body.email);

    // Send reset email if SMTP configured and token was generated
    if ((result as any)._resetToken) {
      const resetUrl = `${process.env.WEB_URL || 'https://app.tradieflow.com'}/reset-password?token=${(result as any)._resetToken}`;
      try {
        await this.email.sendDocument({
          to: body.email,
          businessName: 'TradieFlow',
          documentType: 'Quote',
          documentNumber: 'Password Reset',
          pdfBuffer: Buffer.from(`Reset your password: ${resetUrl}`),
        });
      } catch { /* email send failure should not block response */ }
    }

    return { ok: result.ok, message: result.message };
  }

  @Post('auth/reset-password')
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.svc.resetPassword(body.token, body.newPassword);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@Req() req: any) {
    return this.prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { id: true, name: true, email: true, role: true, businessId: true },
    });
  }

  @Post('me/push-token')
  @UseGuards(AuthGuard)
  async registerPushToken(@Req() req: any, @Body('pushToken') pushToken: string) {
    await this.notifications.registerToken(req.user.sub, pushToken);
    return { ok: true };
  }

  // ─── Staff ───────────────────────────────────────────────────
  @Get('staff')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  staff(@Req() req: any) {
    return this.prisma.user.findMany({
      where: { businessId: req.user.businessId },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });
  }

  @Post('staff')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  async addStaff(@Req() req: any, @Body() body: CreateStaffDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: body.email } });
    if (existing) throw new Error('A user with this email already exists');

    const created = await this.prisma.user.create({
      data: {
        businessId: req.user.businessId,
        name: body.name,
        email: body.email,
        role: Role.STAFF,
        passwordHash: await bcrypt.hash(body.password, 10),
      },
    });
    await this.svc.audit(req.user, 'User', created.id, 'create', { name: created.name });
    return { id: created.id, name: created.name, email: created.email, role: created.role, isActive: created.isActive };
  }

  @Patch('staff/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  updateStaff(@Req() req: any, @Param('id') id: string, @Body() body: UpdateStaffDto) {
    return this.prisma.user.update({ where: { id, businessId: req.user.businessId }, data: body });
  }

  @Delete('staff/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  removeStaff(@Req() req: any, @Param('id') id: string) {
    return this.prisma.user.update({ where: { id, businessId: req.user.businessId }, data: { isActive: false } });
  }

  // ─── Customers ───────────────────────────────────────────────
  @Get('customers')
  @UseGuards(AuthGuard)
  async customers(@Req() req: any, @Query('q') q?: string, @Query('page') page = '1') {
    const where: any = {
      businessId: req.user.businessId,
      OR: q
        ? [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } },
          ]
        : undefined,
    };
    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({ where, take: PAGE_SIZE, skip: (Number(page) - 1) * PAGE_SIZE, orderBy: { name: 'asc' } }),
      this.prisma.customer.count({ where }),
    ]);
    return { data, total, page: Number(page), pageSize: PAGE_SIZE, totalPages: Math.ceil(total / PAGE_SIZE) };
  }

  @Post('customers')
  @UseGuards(AuthGuard)
  async createCustomer(@Req() req: any, @Body() body: CreateCustomerDto) {
    const c = await this.prisma.customer.create({ data: { ...body, businessId: req.user.businessId } });
    await this.svc.audit(req.user, 'Customer', c.id, 'create', body);
    return c;
  }

  @Get('customers/:id')
  @UseGuards(AuthGuard)
  customer(@Req() req: any, @Param('id') id: string) {
    return this.prisma.customer.findFirst({ where: { id, businessId: req.user.businessId } });
  }

  @Patch('customers/:id')
  @UseGuards(AuthGuard)
  async patchCustomer(@Req() req: any, @Param('id') id: string, @Body() body: UpdateCustomerDto) {
    const c = await this.prisma.customer.update({ where: { id, businessId: req.user.businessId }, data: body });
    await this.svc.audit(req.user, 'Customer', id, 'update', body);
    return c;
  }

  @Delete('customers/:id')
  @UseGuards(AuthGuard)
  async delCustomer(@Req() req: any, @Param('id') id: string) {
    const c = await this.prisma.customer.delete({ where: { id, businessId: req.user.businessId } });
    await this.svc.audit(req.user, 'Customer', id, 'delete');
    return c;
  }

  // ─── Jobs ────────────────────────────────────────────────────
  @Get('jobs')
  @UseGuards(AuthGuard)
  async jobs(@Req() req: any, @Query() q: any) {
    const where: any = {
      businessId: req.user.businessId,
      status: q.status || undefined,
      assignedUserId: q.assignedUserId || undefined,
      customerId: q.customerId || undefined,
    };
    if (q.q) {
      where.OR = [
        { title: { contains: q.q, mode: 'insensitive' } },
        { description: { contains: q.q, mode: 'insensitive' } },
        { siteAddress: { contains: q.q, mode: 'insensitive' } },
        { customer: { name: { contains: q.q, mode: 'insensitive' } } },
      ];
    }
    const page = Number(q.page) || 1;
    const [data, total] = await Promise.all([
      this.prisma.job.findMany({ where, include: { customer: true }, orderBy: { createdAt: 'desc' }, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE }),
      this.prisma.job.count({ where }),
    ]);
    return { data, total, page, pageSize: PAGE_SIZE, totalPages: Math.ceil(total / PAGE_SIZE) };
  }

  @Post('jobs')
  @UseGuards(AuthGuard)
  async createJob(@Req() req: any, @Body() body: CreateJobDto) {
    const j = await this.prisma.job.create({ data: { ...body, scheduledStart: body.scheduledStart ? new Date(body.scheduledStart) : undefined, scheduledEnd: body.scheduledEnd ? new Date(body.scheduledEnd) : undefined, businessId: req.user.businessId } });
    await this.svc.audit(req.user, 'Job', j.id, 'create', body);
    return j;
  }

  @Get('jobs/:id')
  @UseGuards(AuthGuard)
  job(@Req() req: any, @Param('id') id: string) {
    return this.prisma.job.findFirst({
      where: { id, businessId: req.user.businessId },
      include: { notes: { orderBy: { createdAt: 'desc' } }, photos: true, customer: true, assignedUser: { select: { id: true, name: true } }, quotes: { include: { items: true } }, invoices: { include: { items: true } } },
    });
  }

  @Patch('jobs/:id')
  @UseGuards(AuthGuard)
  async patchJob(@Req() req: any, @Param('id') id: string, @Body() body: UpdateJobDto) {
    const data: any = { ...body };
    if (body.scheduledStart) data.scheduledStart = new Date(body.scheduledStart);
    if (body.scheduledEnd) data.scheduledEnd = new Date(body.scheduledEnd);
    const j = await this.prisma.job.update({ where: { id, businessId: req.user.businessId }, data });
    await this.svc.audit(req.user, 'Job', id, 'update', body);
    return j;
  }

  @Post('jobs/:id/status')
  @UseGuards(AuthGuard)
  async status(@Req() req: any, @Param('id') id: string, @Body() body: UpdateJobStatusDto) {
    const j = await this.prisma.job.findFirstOrThrow({ where: { id, businessId: req.user.businessId } });
    this.svc.assertForward(j.status, body.status, body.force && req.user.role === Role.OWNER);
    const u = await this.prisma.job.update({ where: { id }, data: { status: body.status } });
    await this.svc.audit(req.user, 'Job', id, 'status_change', { from: j.status, to: body.status });
    return u;
  }

  @Post('jobs/:id/notes')
  @UseGuards(AuthGuard)
  addNote(@Req() req: any, @Param('id') id: string, @Body() body: CreateJobNoteDto) {
    return this.prisma.jobNote.create({ data: { jobId: id, userId: req.user.sub, note: body.note } });
  }

  @Post('jobs/:id/photos')
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: process.env.UPLOAD_DIR || 'uploads',
        filename: (_, f, cb) => cb(null, `${Date.now()}-${f.originalname}`),
      }),
    }),
  )
  async addPhoto(
    @Req() req: any,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('caption') caption: string,
  ) {
    return this.prisma.jobPhoto.create({
      data: { jobId: id, userId: req.user.sub, url: `/uploads/${file.filename}`, caption },
    });
  }

  // ─── Quotes ──────────────────────────────────────────────────
  @Get('quotes')
  @UseGuards(AuthGuard)
  async quotes(@Req() req: any, @Query('page') page = '1') {
    const where = { businessId: req.user.businessId };
    const [data, total] = await Promise.all([
      this.prisma.quote.findMany({ where, include: { items: true, job: { select: { title: true, customer: { select: { name: true } } } } }, orderBy: { createdAt: 'desc' }, take: PAGE_SIZE, skip: (Number(page) - 1) * PAGE_SIZE }),
      this.prisma.quote.count({ where }),
    ]);
    return { data, total, page: Number(page), pageSize: PAGE_SIZE, totalPages: Math.ceil(total / PAGE_SIZE) };
  }

  @Post('quotes')
  @UseGuards(AuthGuard)
  async createQuote(@Req() req: any, @Body() body: CreateQuoteDto) {
    const biz = await this.prisma.business.findUniqueOrThrow({ where: { id: req.user.businessId } });
    const t = this.svc.totals(body.items, body.discountAmount, biz.gstEnabled, Number(biz.gstRate));
    const qn = await this.svc.nextQuoteNumber(req.user.businessId);
    const q = await this.prisma.quote.create({
      data: {
        businessId: req.user.businessId, jobId: body.jobId, quoteNumber: qn,
        subtotal: t.subtotal, gstAmount: t.gstAmount, total: t.total, discountAmount: t.discountAmount,
        items: { create: t.lineItems.map((i) => ({ description: i.description, quantity: i.quantity.toString(), unitPrice: i.unitPrice.toString(), lineTotal: i.lineTotal.toString() })) },
      },
      include: { items: true },
    });
    await this.svc.audit(req.user, 'Quote', q.id, 'create');
    return q;
  }

  @Get('quotes/:id')
  @UseGuards(AuthGuard)
  quote(@Req() req: any, @Param('id') id: string) {
    return this.prisma.quote.findFirst({ where: { id, businessId: req.user.businessId }, include: { items: true } });
  }

  @Patch('quotes/:id')
  @UseGuards(AuthGuard)
  async patchQuote(@Req() req: any, @Param('id') id: string, @Body() body: UpdateQuoteDto) {
    const biz = await this.prisma.business.findUniqueOrThrow({ where: { id: req.user.businessId } });
    const t = this.svc.totals(body.items, body.discountAmount, biz.gstEnabled, Number(biz.gstRate));
    await this.prisma.quoteItem.deleteMany({ where: { quoteId: id } });
    const q = await this.prisma.quote.update({
      where: { id, businessId: req.user.businessId },
      data: {
        discountAmount: t.discountAmount, subtotal: t.subtotal, gstAmount: t.gstAmount, total: t.total,
        items: { create: t.lineItems.map((i) => ({ description: i.description, quantity: i.quantity.toString(), unitPrice: i.unitPrice.toString(), lineTotal: i.lineTotal.toString() })) },
      },
      include: { items: true },
    });
    await this.svc.audit(req.user, 'Quote', id, 'update');
    return q;
  }

  @Post('quotes/:id/send') @UseGuards(AuthGuard) qsend(@Req() req: any, @Param('id') id: string) { return this.prisma.quote.update({ where: { id, businessId: req.user.businessId }, data: { status: QuoteStatus.SENT } }); }
  @Post('quotes/:id/accept') @UseGuards(AuthGuard) qaccept(@Req() req: any, @Param('id') id: string) { return this.prisma.quote.update({ where: { id, businessId: req.user.businessId }, data: { status: QuoteStatus.ACCEPTED } }); }
  @Post('quotes/:id/decline') @UseGuards(AuthGuard) qdecline(@Req() req: any, @Param('id') id: string) { return this.prisma.quote.update({ where: { id, businessId: req.user.businessId }, data: { status: QuoteStatus.DECLINED } }); }

  // ─── Invoices ────────────────────────────────────────────────
  @Get('invoices')
  @UseGuards(AuthGuard)
  async invoices(@Req() req: any, @Query('q') q?: string, @Query('page') page = '1') {
    const where: any = { businessId: req.user.businessId };
    if (q) { where.OR = [{ invoiceNumber: { contains: q, mode: 'insensitive' } }, { job: { customer: { name: { contains: q, mode: 'insensitive' } } } }]; }
    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({ where, include: { items: true, job: { select: { title: true, customer: { select: { name: true } } } } }, orderBy: { createdAt: 'desc' }, take: PAGE_SIZE, skip: (Number(page) - 1) * PAGE_SIZE }),
      this.prisma.invoice.count({ where }),
    ]);
    return { data: data.map((i) => this.svc.overdue(i)), total, page: Number(page), pageSize: PAGE_SIZE, totalPages: Math.ceil(total / PAGE_SIZE) };
  }

  @Post('invoices')
  @UseGuards(AuthGuard)
  async createInvoice(@Req() req: any, @Body() body: CreateInvoiceDto) {
    const biz = await this.prisma.business.findUniqueOrThrow({ where: { id: req.user.businessId } });
    const t = this.svc.totals(body.items, body.discountAmount, biz.gstEnabled, Number(biz.gstRate));
    const invNum = await this.svc.nextInvoiceNumber(req.user.businessId);
    const i = await this.prisma.invoice.create({
      data: {
        businessId: req.user.businessId, jobId: body.jobId, invoiceNumber: invNum,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        subtotal: t.subtotal, gstAmount: t.gstAmount, total: t.total, discountAmount: t.discountAmount,
        items: { create: t.lineItems.map((li) => ({ description: li.description, quantity: li.quantity.toString(), unitPrice: li.unitPrice.toString(), lineTotal: li.lineTotal.toString() })) },
      },
      include: { items: true },
    });
    await this.svc.audit(req.user, 'Invoice', i.id, 'create');
    return i;
  }

  @Post('invoices/from-quote/:quoteId')
  @UseGuards(AuthGuard)
  async fromQuote(@Req() req: any, @Param('quoteId') quoteId: string) {
    const q = await this.prisma.quote.findFirstOrThrow({ where: { id: quoteId, businessId: req.user.businessId }, include: { items: true } });
    return this.createInvoice(req, { jobId: q.jobId, discountAmount: Number(q.discountAmount), items: q.items.map((i) => ({ description: i.description, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice) })) } as CreateInvoiceDto);
  }

  @Get('invoices/:id') @UseGuards(AuthGuard)
  async invoice(@Req() req: any, @Param('id') id: string) { const i = await this.prisma.invoice.findFirst({ where: { id, businessId: req.user.businessId }, include: { items: true, payments: true } }); return i ? this.svc.overdue(i) : i; }

  @Patch('invoices/:id') @UseGuards(AuthGuard)
  async patchInvoice(@Req() req: any, @Param('id') id: string, @Body() body: UpdateInvoiceDto) { const i = await this.prisma.invoice.update({ where: { id, businessId: req.user.businessId }, data: body }); await this.svc.audit(req.user, 'Invoice', id, 'update', body); return i; }

  @Post('invoices/:id/send') @UseGuards(AuthGuard)
  sendInvoice(@Req() req: any, @Param('id') id: string) { return this.prisma.invoice.update({ where: { id, businessId: req.user.businessId }, data: { status: InvoiceStatus.SENT } }); }

  @Post('invoices/:id/mark-paid')
  @UseGuards(AuthGuard)
  async markPaid(@Req() req: any, @Param('id') id: string, @Body() body: MarkPaidDto) {
    const payment = await this.prisma.payment.create({ data: { invoiceId: id, amount: body.amount, method: body.method || PaymentMethod.BANK, paidAt: new Date(body.paidAt || new Date()) } });
    await this.prisma.invoice.update({ where: { id, businessId: req.user.businessId }, data: { status: InvoiceStatus.PAID } });
    await this.svc.audit(req.user, 'Payment', payment.id, 'create', { invoiceId: id });
    return payment;
  }

  @Post('invoices/:id/void') @UseGuards(AuthGuard, RolesGuard) @Roles(Role.OWNER)
  voidInvoice(@Req() req: any, @Param('id') id: string) { return this.prisma.invoice.update({ where: { id, businessId: req.user.businessId }, data: { status: InvoiceStatus.VOID } }); }

  // ─── Payment Reminders ──────────────────────────────────────
  @Post('invoices/send-reminders')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  async sendReminders(@Req() req: any) {
    const overdue = await this.svc.sendOverdueReminders(req.user.businessId);
    const biz = await this.prisma.business.findUniqueOrThrow({ where: { id: req.user.businessId } });
    let sent = 0;
    for (const inv of overdue) {
      if (!inv.job.customer.email) continue;
      const buf = await this.pdf.generate({
        documentNumber: inv.invoiceNumber, type: 'Invoice', status: 'OVERDUE',
        business: biz, customer: inv.job.customer, items: [],
        subtotal: Number(inv.subtotal), gstAmount: Number(inv.gstAmount),
        discountAmount: Number(inv.discountAmount), total: Number(inv.total),
        dueDate: inv.dueDate?.toISOString(), createdAt: inv.createdAt.toISOString(),
      });
      const result = await this.email.sendDocument({ to: inv.job.customer.email, businessName: biz.name, documentType: 'Invoice', documentNumber: `REMINDER: ${inv.invoiceNumber}`, pdfBuffer: buf });
      if (result.sent) sent++;
    }
    return { overdueCount: overdue.length, remindersSent: sent };
  }

  // ─── PDF generation ──────────────────────────────────────────
  @Get('quotes/:id/pdf') @UseGuards(AuthGuard)
  async quotePdf(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    const quote = await this.prisma.quote.findFirstOrThrow({ where: { id, businessId: req.user.businessId }, include: { items: true, job: { include: { customer: true } } } });
    const biz = await this.prisma.business.findUniqueOrThrow({ where: { id: req.user.businessId } });
    const buf = await this.pdf.generate({ documentNumber: quote.quoteNumber, type: 'Quote', status: quote.status, business: biz, customer: quote.job.customer, items: quote.items, subtotal: Number(quote.subtotal), gstAmount: Number(quote.gstAmount), discountAmount: Number(quote.discountAmount), total: Number(quote.total), createdAt: quote.createdAt.toISOString() });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${quote.quoteNumber}.pdf"`);
    res.send(buf);
  }

  @Get('invoices/:id/pdf') @UseGuards(AuthGuard)
  async invoicePdf(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    const inv = await this.prisma.invoice.findFirstOrThrow({ where: { id, businessId: req.user.businessId }, include: { items: true, job: { include: { customer: true } } } });
    const biz = await this.prisma.business.findUniqueOrThrow({ where: { id: req.user.businessId } });
    const buf = await this.pdf.generate({ documentNumber: inv.invoiceNumber, type: 'Invoice', status: inv.status, business: biz, customer: inv.job.customer, items: inv.items, subtotal: Number(inv.subtotal), gstAmount: Number(inv.gstAmount), discountAmount: Number(inv.discountAmount), total: Number(inv.total), dueDate: inv.dueDate?.toISOString(), createdAt: inv.createdAt.toISOString() });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${inv.invoiceNumber}.pdf"`);
    res.send(buf);
  }

  // ─── Email delivery ──────────────────────────────────────────
  @Post('quotes/:id/email') @UseGuards(AuthGuard)
  async emailQuote(@Req() req: any, @Param('id') id: string) {
    const quote = await this.prisma.quote.findFirstOrThrow({ where: { id, businessId: req.user.businessId }, include: { items: true, job: { include: { customer: true } } } });
    if (!quote.job.customer.email) return { sent: false, reason: 'Customer has no email address' };
    const biz = await this.prisma.business.findUniqueOrThrow({ where: { id: req.user.businessId } });
    const buf = await this.pdf.generate({ documentNumber: quote.quoteNumber, type: 'Quote', status: quote.status, business: biz, customer: quote.job.customer, items: quote.items, subtotal: Number(quote.subtotal), gstAmount: Number(quote.gstAmount), discountAmount: Number(quote.discountAmount), total: Number(quote.total), createdAt: quote.createdAt.toISOString() });
    const result = await this.email.sendDocument({ to: quote.job.customer.email, businessName: biz.name, documentType: 'Quote', documentNumber: quote.quoteNumber, pdfBuffer: buf });
    if (result.sent) await this.prisma.quote.update({ where: { id }, data: { status: QuoteStatus.SENT } });
    return result;
  }

  @Post('invoices/:id/email') @UseGuards(AuthGuard)
  async emailInvoice(@Req() req: any, @Param('id') id: string) {
    const inv = await this.prisma.invoice.findFirstOrThrow({ where: { id, businessId: req.user.businessId }, include: { items: true, job: { include: { customer: true } } } });
    if (!inv.job.customer.email) return { sent: false, reason: 'Customer has no email address' };
    const biz = await this.prisma.business.findUniqueOrThrow({ where: { id: req.user.businessId } });
    const buf = await this.pdf.generate({ documentNumber: inv.invoiceNumber, type: 'Invoice', status: inv.status, business: biz, customer: inv.job.customer, items: inv.items, subtotal: Number(inv.subtotal), gstAmount: Number(inv.gstAmount), discountAmount: Number(inv.discountAmount), total: Number(inv.total), dueDate: inv.dueDate?.toISOString(), createdAt: inv.createdAt.toISOString() });
    const result = await this.email.sendDocument({ to: inv.job.customer.email, businessName: biz.name, documentType: 'Invoice', documentNumber: inv.invoiceNumber, pdfBuffer: buf });
    if (result.sent) await this.prisma.invoice.update({ where: { id }, data: { status: InvoiceStatus.SENT } });
    return result;
  }

  // ─── Business & ABN Verification ─────────────────────────────
  @Patch('business') @UseGuards(AuthGuard) updateBusiness(@Req() req: any, @Body() body: UpdateBusinessDto) { return this.prisma.business.update({ where: { id: req.user.businessId }, data: body }); }
  @Get('business') @UseGuards(AuthGuard) getBusiness(@Req() req: any) { return this.prisma.business.findUnique({ where: { id: req.user.businessId } }); }

  @Post('business/verify-abn')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  verifyAbn(@Req() req: any, @Body() body: VerifyAbnDto) { return this.svc.verifyAbn(req.user.businessId, body.abn); }

  // ─── Subscription ────────────────────────────────────────────
  @Get('subscription') @UseGuards(AuthGuard)
  getSubscription(@Req() req: any) { return this.svc.getSubscription(req.user.businessId); }

  @Post('subscription/webhook')
  async subscriptionWebhook(@Body() body: any) {
    // PLACEHOLDER: Validate webhook signature from your payment provider.
    // This endpoint is unauthenticated because payment providers POST directly.
    // Example: stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
    return this.svc.handleSubscriptionWebhook(body);
  }

  @Post('subscription/create-checkout')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  async createCheckout(@Req() req: any, @Body('plan') plan: string) {
    // PLACEHOLDER: Create a checkout session with your payment provider.
    // Payments happen on the web (not in-app), bypassing Apple's 30% cut.
    // Return a URL for the user to complete payment in their browser.
    const webUrl = process.env.WEB_URL || 'https://app.tradieflow.com';
    return { url: `${webUrl}/subscribe?plan=${plan}&business=${req.user.businessId}`, message: 'Redirect user to this URL to complete subscription' };
  }

  @Post('subscription/cancel')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  async cancelSubscription(@Req() req: any) {
    return this.prisma.subscription.update({ where: { businessId: req.user.businessId }, data: { cancelAtPeriodEnd: true } });
  }

  // ─── Audit Logs ──────────────────────────────────────────────
  @Get('audit-logs')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  async auditLogs(@Req() req: any, @Query('page') page = '1', @Query('entityType') entityType?: string) {
    const where: any = { businessId: req.user.businessId };
    if (entityType) where.entityType = entityType;
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, include: { user: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: PAGE_SIZE, skip: (Number(page) - 1) * PAGE_SIZE }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data, total, page: Number(page), pageSize: PAGE_SIZE, totalPages: Math.ceil(total / PAGE_SIZE) };
  }

  // ─── Reports ─────────────────────────────────────────────────
  @Get('reports/summary')
  @UseGuards(AuthGuard)
  async summary(@Req() req: any) {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const [jobsToday, inv, activeJobs] = await Promise.all([
      this.prisma.job.count({ where: { businessId: req.user.businessId, createdAt: { gte: todayStart } } }),
      this.prisma.invoice.findMany({ where: { businessId: req.user.businessId } }),
      this.prisma.job.count({ where: { businessId: req.user.businessId, status: { in: ['SCHEDULED', 'IN_PROGRESS'] } } }),
    ]);
    const overdue = inv.filter((i) => i.status === InvoiceStatus.SENT && i.dueDate && new Date(i.dueDate) < new Date());
    const outstanding = inv.filter((i) => i.status !== InvoiceStatus.PAID && i.status !== InvoiceStatus.VOID).reduce((s, i) => s + Number(i.total), 0);
    const paid = inv.filter((i) => i.status === InvoiceStatus.PAID).reduce((s, i) => s + Number(i.total), 0);
    return { jobsTodayCount: jobsToday, activeJobsCount: activeJobs, overdueInvoicesCount: overdue.length, outstandingTotal: outstanding, paidTotal: paid };
  }

  // ─── Exports ─────────────────────────────────────────────────
  @Get('exports/bas') @UseGuards(AuthGuard)
  async bas(@Req() req: any, @Query('from') from: string, @Query('to') to: string, @Res() res: Response) {
    const invoices = await this.prisma.invoice.findMany({ where: { businessId: req.user.businessId, createdAt: { gte: new Date(from), lte: new Date(to) } }, include: { job: { include: { customer: true } } } });
    const csv = stringify(invoices.map((i) => ({ invoiceNumber: i.invoiceNumber, date: i.createdAt.toISOString().slice(0, 10), total: i.total.toString(), gstAmount: i.gstAmount.toString(), customerName: i.job.customer.name, status: i.status })), { header: true });
    res.setHeader('Content-Type', 'text/csv');
    res.send(csv);
  }
}
