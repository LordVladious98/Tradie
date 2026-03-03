import { AppService } from '../src/service';
import { JobStatus } from '@prisma/client';

describe('AppService', () => {
  const svc = new AppService({} as any, {} as any);

  describe('totals', () => {
    it('calculates totals with GST', () => {
      const totals = svc.totals([{ quantity: 2, unitPrice: 10.115 }], 0, true, 0.1);
      expect(totals.subtotal).toBe(20.23);
      expect(totals.gstAmount).toBe(2.02);
      expect(totals.total).toBe(22.25);
    });

    it('calculates totals without GST', () => {
      const totals = svc.totals([{ quantity: 3, unitPrice: 50 }], 0, false, 0.1);
      expect(totals.subtotal).toBe(150);
      expect(totals.gstAmount).toBe(0);
      expect(totals.total).toBe(150);
    });

    it('applies discount correctly', () => {
      const totals = svc.totals([{ quantity: 1, unitPrice: 100 }], 10, true, 0.1);
      expect(totals.subtotal).toBe(100);
      expect(totals.gstAmount).toBe(10);
      expect(totals.total).toBe(100); // 100 + 10 GST - 10 discount
      expect(totals.discountAmount).toBe(10);
    });

    it('handles multiple line items', () => {
      const items = [
        { quantity: 2, unitPrice: 25 },
        { quantity: 1, unitPrice: 50 },
        { quantity: 3, unitPrice: 10 },
      ];
      const totals = svc.totals(items, 0, true, 0.1);
      expect(totals.subtotal).toBe(130); // 50 + 50 + 30
      expect(totals.gstAmount).toBe(13);
      expect(totals.total).toBe(143);
      expect(totals.lineItems).toHaveLength(3);
      expect(totals.lineItems[0].lineTotal).toBe(50);
      expect(totals.lineItems[1].lineTotal).toBe(50);
      expect(totals.lineItems[2].lineTotal).toBe(30);
    });

    it('handles zero quantity', () => {
      const totals = svc.totals([{ quantity: 0, unitPrice: 100 }], 0, true, 0.1);
      expect(totals.subtotal).toBe(0);
      expect(totals.total).toBe(0);
    });
  });

  describe('assertForward', () => {
    it('allows valid forward transitions', () => {
      expect(() => svc.assertForward(JobStatus.LEAD, JobStatus.QUOTED)).not.toThrow();
      expect(() => svc.assertForward(JobStatus.QUOTED, JobStatus.SCHEDULED)).not.toThrow();
      expect(() => svc.assertForward(JobStatus.SCHEDULED, JobStatus.IN_PROGRESS)).not.toThrow();
      expect(() => svc.assertForward(JobStatus.IN_PROGRESS, JobStatus.COMPLETED)).not.toThrow();
      expect(() => svc.assertForward(JobStatus.COMPLETED, JobStatus.INVOICED)).not.toThrow();
      expect(() => svc.assertForward(JobStatus.INVOICED, JobStatus.PAID)).not.toThrow();
    });

    it('blocks skipping steps', () => {
      expect(() => svc.assertForward(JobStatus.LEAD, JobStatus.COMPLETED)).toThrow('Invalid status transition');
      expect(() => svc.assertForward(JobStatus.QUOTED, JobStatus.PAID)).toThrow('Invalid status transition');
    });

    it('blocks backward transitions', () => {
      expect(() => svc.assertForward(JobStatus.COMPLETED, JobStatus.LEAD)).toThrow('Invalid status transition');
    });

    it('allows cancellation from any non-paid status', () => {
      expect(() => svc.assertForward(JobStatus.LEAD, JobStatus.CANCELLED)).not.toThrow();
      expect(() => svc.assertForward(JobStatus.SCHEDULED, JobStatus.CANCELLED)).not.toThrow();
      expect(() => svc.assertForward(JobStatus.IN_PROGRESS, JobStatus.CANCELLED)).not.toThrow();
    });

    it('allows owner force override', () => {
      expect(() => svc.assertForward(JobStatus.LEAD, JobStatus.COMPLETED, true)).not.toThrow();
    });
  });

  describe('overdue', () => {
    it('marks sent invoice past due date as overdue', () => {
      const invoice = { status: 'SENT', dueDate: new Date('2020-01-01') };
      const result = svc.overdue(invoice);
      expect(result.isOverdue).toBe(true);
      expect(result.computedStatus).toBe('OVERDUE');
    });

    it('does not mark future-due invoice as overdue', () => {
      const invoice = { status: 'SENT', dueDate: new Date('2099-01-01') };
      const result = svc.overdue(invoice);
      expect(result.isOverdue).toBe(false);
      expect(result.computedStatus).toBe('SENT');
    });

    it('does not mark paid invoice as overdue', () => {
      const invoice = { status: 'PAID', dueDate: new Date('2020-01-01') };
      const result = svc.overdue(invoice);
      expect(result.isOverdue).toBe(false);
      expect(result.computedStatus).toBe('PAID');
    });
  });
});
