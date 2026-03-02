import { Body, Controller, Delete, Get, Param, ParseFilePipe, Patch, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InvoiceStatus, PaymentMethod, QuoteStatus, Role } from '@prisma/client';
import { Response } from 'express';
import { diskStorage } from 'multer';
import * as path from 'path';
import { AppService } from './service';
import { PrismaService } from './prisma.service';
import { AuthGuard, Roles, RolesGuard } from './auth';
import * as bcrypt from 'bcrypt';

@Controller()
export class AppController {
  constructor(private svc: AppService, private prisma: PrismaService) {}

  @Post('auth/register-owner') registerOwner(@Body() b: any) { return this.svc.registerOwner(b); }
  @Post('auth/login') login(@Body() b: any) { return this.svc.login(b); }
  @Post('auth/refresh') refresh(@Body('refreshToken') rt: string) { return this.svc.refresh(rt); }
  @Post('auth/logout') logout(@Body('refreshToken') rt: string) { return this.svc.logout(rt); }
  @Get('me') @UseGuards(AuthGuard) async me(@Req() req: any) { return this.prisma.user.findUnique({ where: { id: req.user.sub }, select: { id: true, name: true, email: true, role: true, businessId: true } }); }

  @Get('staff') @UseGuards(AuthGuard, RolesGuard) @Roles(Role.OWNER) staff(@Req() req: any) { return this.prisma.user.findMany({ where: { businessId: req.user.businessId } }); }
  @Post('staff') @UseGuards(AuthGuard, RolesGuard) @Roles(Role.OWNER) async addStaff(@Req() req: any, @Body() b: any) { const created = await this.prisma.user.create({ data: { businessId: req.user.businessId, name: b.name, email: b.email, role: Role.STAFF, passwordHash: await bcrypt.hash(b.password || 'password123', 10) } }); await this.svc.audit(req.user, 'User', created.id, 'create', { name: created.name }); return created; }
  @Patch('staff/:id') @UseGuards(AuthGuard, RolesGuard) @Roles(Role.OWNER) updateStaff(@Req() req: any, @Param('id') id: string, @Body() b: any) { return this.prisma.user.update({ where: { id, businessId: req.user.businessId }, data: b }); }
  @Delete('staff/:id') @UseGuards(AuthGuard, RolesGuard) @Roles(Role.OWNER) removeStaff(@Req() req: any, @Param('id') id: string) { return this.prisma.user.update({ where: { id, businessId: req.user.businessId }, data: { isActive: false } }); }

  @Get('customers') @UseGuards(AuthGuard) customers(@Req() req: any, @Query('q') q?: string, @Query('page') page='1') { return this.prisma.customer.findMany({ where: { businessId: req.user.businessId, OR: q ? [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }, { phone: { contains: q, mode: 'insensitive' } }] : undefined }, take: 20, skip: (Number(page)-1)*20 }); }
  @Post('customers') @UseGuards(AuthGuard) async createCustomer(@Req() req: any, @Body() b: any) { const c= await this.prisma.customer.create({ data: { ...b, businessId: req.user.businessId } }); await this.svc.audit(req.user,'Customer',c.id,'create',b); return c; }
  @Get('customers/:id') @UseGuards(AuthGuard) customer(@Req() req: any,@Param('id') id:string){ return this.prisma.customer.findFirst({where:{id,businessId:req.user.businessId}}); }
  @Patch('customers/:id') @UseGuards(AuthGuard) async patchCustomer(@Req() req:any,@Param('id')id:string,@Body()b:any){ const c= await this.prisma.customer.update({where:{id,businessId:req.user.businessId},data:b}); await this.svc.audit(req.user,'Customer',id,'update',b); return c; }
  @Delete('customers/:id') @UseGuards(AuthGuard) async delCustomer(@Req() req:any,@Param('id')id:string){ const c= await this.prisma.customer.delete({where:{id,businessId:req.user.businessId}}); await this.svc.audit(req.user,'Customer',id,'delete'); return c; }

  @Get('jobs') @UseGuards(AuthGuard) jobs(@Req() req:any,@Query() q:any){ return this.prisma.job.findMany({where:{businessId:req.user.businessId,status:q.status,assignedUserId:q.assignedUserId,customerId:q.customerId},include:{customer:true}}); }
  @Post('jobs') @UseGuards(AuthGuard) async createJob(@Req() req:any,@Body()b:any){ const j= await this.prisma.job.create({data:{...b,businessId:req.user.businessId}}); await this.svc.audit(req.user,'Job',j.id,'create',b); return j; }
  @Get('jobs/:id') @UseGuards(AuthGuard) job(@Req() req:any,@Param('id')id:string){ return this.prisma.job.findFirst({where:{id,businessId:req.user.businessId},include:{notes:true,photos:true}}); }
  @Patch('jobs/:id') @UseGuards(AuthGuard) async patchJob(@Req() req:any,@Param('id')id:string,@Body()b:any){ const j= await this.prisma.job.update({where:{id,businessId:req.user.businessId},data:b}); await this.svc.audit(req.user,'Job',id,'update',b); return j; }
  @Post('jobs/:id/status') @UseGuards(AuthGuard) async status(@Req() req:any,@Param('id')id:string,@Body()b:any){ const j= await this.prisma.job.findFirstOrThrow({where:{id,businessId:req.user.businessId}}); this.svc.assertForward(j.status,b.status,b.force && req.user.role===Role.OWNER); const u=await this.prisma.job.update({where:{id},data:{status:b.status}}); await this.svc.audit(req.user,'Job',id,'status_change',{from:j.status,to:b.status}); return u; }
  @Post('jobs/:id/notes') @UseGuards(AuthGuard) addNote(@Req() req:any,@Param('id')id:string,@Body('note')note:string){ return this.prisma.jobNote.create({data:{jobId:id,userId:req.user.sub,note}}); }
  @Post('jobs/:id/photos') @UseGuards(AuthGuard) @UseInterceptors(FileInterceptor('file',{storage:diskStorage({destination:process.env.UPLOAD_DIR||'uploads',filename:(_,f,cb)=>cb(null,`${Date.now()}-${f.originalname}`)})}))
  async addPhoto(@Req() req:any,@Param('id')id:string,@UploadedFile() file: Express.Multer.File,@Body('caption')caption:string){ return this.prisma.jobPhoto.create({data:{jobId:id,userId:req.user.sub,url:`/uploads/${file.filename}`,caption}}); }

  @Get('quotes') @UseGuards(AuthGuard) quotes(@Req() req:any){ return this.prisma.quote.findMany({where:{businessId:req.user.businessId},include:{items:true}}); }
  @Post('quotes') @UseGuards(AuthGuard) async createQuote(@Req() req:any,@Body()b:any){ const biz=await this.prisma.business.findUniqueOrThrow({where:{id:req.user.businessId}}); const t=this.svc.totals(b.items,b.discountAmount,biz.gstEnabled,Number(biz.gstRate)); const qn=await this.svc.nextQuoteNumber(req.user.businessId); const q= await this.prisma.quote.create({data:{businessId:req.user.businessId,jobId:b.jobId,quoteNumber:qn,subtotal:t.subtotal,gstAmount:t.gstAmount,total:t.total,discountAmount:t.discountAmount,items:{create:t.lineItems.map(i=>({...i,quantity:i.quantity.toString(),unitPrice:i.unitPrice.toString(),lineTotal:i.lineTotal.toString()}))}},include:{items:true}}); await this.svc.audit(req.user,'Quote',q.id,'create'); return q; }
  @Get('quotes/:id') @UseGuards(AuthGuard) quote(@Req() req:any,@Param('id')id:string){ return this.prisma.quote.findFirst({where:{id,businessId:req.user.businessId},include:{items:true}}); }
  @Patch('quotes/:id') @UseGuards(AuthGuard) async patchQuote(@Req() req:any,@Param('id')id:string,@Body()b:any){ const biz=await this.prisma.business.findUniqueOrThrow({where:{id:req.user.businessId}}); const t=this.svc.totals(b.items,b.discountAmount,biz.gstEnabled,Number(biz.gstRate)); await this.prisma.quoteItem.deleteMany({where:{quoteId:id}}); const q=await this.prisma.quote.update({where:{id,businessId:req.user.businessId},data:{discountAmount:t.discountAmount,subtotal:t.subtotal,gstAmount:t.gstAmount,total:t.total,items:{create:t.lineItems.map(i=>({...i,quantity:i.quantity.toString(),unitPrice:i.unitPrice.toString(),lineTotal:i.lineTotal.toString()}))}},include:{items:true}}); await this.svc.audit(req.user,'Quote',id,'update'); return q; }
  @Post('quotes/:id/send') @UseGuards(AuthGuard) qsend(@Req() req:any,@Param('id')id:string){ return this.prisma.quote.update({where:{id,businessId:req.user.businessId},data:{status:QuoteStatus.SENT}}); }
  @Post('quotes/:id/accept') @UseGuards(AuthGuard) qaccept(@Req() req:any,@Param('id')id:string){ return this.prisma.quote.update({where:{id,businessId:req.user.businessId},data:{status:QuoteStatus.ACCEPTED}}); }
  @Post('quotes/:id/decline') @UseGuards(AuthGuard) qdecline(@Req() req:any,@Param('id')id:string){ return this.prisma.quote.update({where:{id,businessId:req.user.businessId},data:{status:QuoteStatus.DECLINED}}); }

  @Get('invoices') @UseGuards(AuthGuard) async invoices(@Req() req:any){ const list= await this.prisma.invoice.findMany({where:{businessId:req.user.businessId},include:{items:true}}); return list.map(i=>this.svc.overdue(i)); }
  @Post('invoices') @UseGuards(AuthGuard) async createInvoice(@Req() req:any,@Body()b:any){ const biz=await this.prisma.business.findUniqueOrThrow({where:{id:req.user.businessId}}); const t=this.svc.totals(b.items,b.discountAmount,biz.gstEnabled,Number(biz.gstRate)); const invNum=await this.svc.nextInvoiceNumber(req.user.businessId); const i= await this.prisma.invoice.create({data:{businessId:req.user.businessId,jobId:b.jobId,invoiceNumber:invNum,dueDate:b.dueDate?new Date(b.dueDate):null,subtotal:t.subtotal,gstAmount:t.gstAmount,total:t.total,discountAmount:t.discountAmount,items:{create:t.lineItems.map(li=>({...li,quantity:li.quantity.toString(),unitPrice:li.unitPrice.toString(),lineTotal:li.lineTotal.toString()}))}},include:{items:true}}); await this.svc.audit(req.user,'Invoice',i.id,'create'); return i; }
  @Post('invoices/from-quote/:quoteId') @UseGuards(AuthGuard) async fromQuote(@Req() req:any,@Param('quoteId')quoteId:string){ const q=await this.prisma.quote.findFirstOrThrow({where:{id:quoteId,businessId:req.user.businessId},include:{items:true}}); return this.createInvoice(req,{jobId:q.jobId,discountAmount:q.discountAmount,items:q.items.map(i=>({description:i.description,quantity:Number(i.quantity),unitPrice:Number(i.unitPrice)}))}); }
  @Get('invoices/:id') @UseGuards(AuthGuard) async invoice(@Req() req:any,@Param('id')id:string){ const i=await this.prisma.invoice.findFirst({where:{id,businessId:req.user.businessId},include:{items:true,payments:true}}); return i?this.svc.overdue(i):i; }
  @Patch('invoices/:id') @UseGuards(AuthGuard) async patchInvoice(@Req() req:any,@Param('id')id:string,@Body()b:any){ const i=await this.prisma.invoice.update({where:{id,businessId:req.user.businessId},data:b}); await this.svc.audit(req.user,'Invoice',id,'update',b); return i; }
  @Post('invoices/:id/send') @UseGuards(AuthGuard) sendInvoice(@Req() req:any,@Param('id')id:string){ return this.prisma.invoice.update({where:{id,businessId:req.user.businessId},data:{status:InvoiceStatus.SENT}}); }
  @Post('invoices/:id/mark-paid') @UseGuards(AuthGuard) async markPaid(@Req() req:any,@Param('id')id:string,@Body()b:any){ const payment=await this.prisma.payment.create({data:{invoiceId:id,amount:b.amount,method:b.method||PaymentMethod.BANK,paidAt:new Date(b.paidAt||new Date())}}); await this.prisma.invoice.update({where:{id,businessId:req.user.businessId},data:{status:InvoiceStatus.PAID}}); await this.svc.audit(req.user,'Payment',payment.id,'create',{invoiceId:id}); return payment; }
  @Post('invoices/:id/void') @UseGuards(AuthGuard, RolesGuard) @Roles(Role.OWNER) voidInvoice(@Req() req:any,@Param('id')id:string){ return this.prisma.invoice.update({where:{id,businessId:req.user.businessId},data:{status:InvoiceStatus.VOID}}); }

  @Get('reports/summary') @UseGuards(AuthGuard) async summary(@Req() req:any){ const todayStart=new Date(); todayStart.setHours(0,0,0,0); const jobsToday=await this.prisma.job.count({where:{businessId:req.user.businessId,createdAt:{gte:todayStart}}}); const inv=await this.prisma.invoice.findMany({where:{businessId:req.user.businessId}}); const overdue=inv.filter(i=>i.status===InvoiceStatus.SENT&&i.dueDate&&new Date(i.dueDate)<new Date()); const outstanding=inv.filter(i=>i.status!==InvoiceStatus.PAID&&i.status!==InvoiceStatus.VOID).reduce((s,i)=>s+Number(i.total),0); return {jobsTodayCount:jobsToday,overdueInvoicesCount:overdue.length,outstandingTotal:outstanding}; }

  @Get('exports/bas') @UseGuards(AuthGuard) async bas(@Req() req:any,@Query('from')from:string,@Query('to')to:string,@Res() res:Response){ const invoices=await this.prisma.invoice.findMany({where:{businessId:req.user.businessId,createdAt:{gte:new Date(from),lte:new Date(to)}},include:{job:{include:{customer:true}}}}); const csv=stringify(invoices.map(i=>({invoiceNumber:i.invoiceNumber,date:i.createdAt.toISOString().slice(0,10),total:i.total.toString(),gstAmount:i.gstAmount.toString(),customerName:i.job.customer.name,status:i.status})),{header:true}); res.setHeader('Content-Type','text/csv'); res.send(csv); }

  @Patch('business') @UseGuards(AuthGuard) updateBusiness(@Req()req:any,@Body()b:any){ return this.prisma.business.update({where:{id:req.user.businessId},data:b}); }
  @Get('business') @UseGuards(AuthGuard) getBusiness(@Req()req:any){ return this.prisma.business.findUnique({where:{id:req.user.businessId}}); }
}
