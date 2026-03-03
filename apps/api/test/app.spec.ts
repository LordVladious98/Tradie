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

    it('handles empty items array', () => {
      const totals = svc.totals([], 0, true, 0.1);
      expect(totals.subtotal).toBe(0);
      expect(totals.gstAmount).toBe(0);
      expect(totals.total).toBe(0);
      expect(totals.lineItems).toHaveLength(0);
    });

    it('handles discount larger than subtotal+GST', () => {
      const totals = svc.totals([{ quantity: 1, unitPrice: 10 }], 50, true, 0.1);
      expect(totals.subtotal).toBe(10);
      expect(totals.gstAmount).toBe(1);
      expect(totals.total).toBe(-39); // 10 + 1 - 50
    });

    it('handles fractional quantities', () => {
      const totals = svc.totals([{ quantity: 1.5, unitPrice: 10 }], 0, true, 0.1);
      expect(totals.subtotal).toBe(15);
      expect(totals.gstAmount).toBe(1.5);
      expect(totals.total).toBe(16.5);
    });

    it('handles custom GST rate', () => {
      const totals = svc.totals([{ quantity: 1, unitPrice: 100 }], 0, true, 0.2);
      expect(totals.subtotal).toBe(100);
      expect(totals.gstAmount).toBe(20);
      expect(totals.total).toBe(120);
    });

    it('uses default GST rate of 10%', () => {
      const totals = svc.totals([{ quantity: 1, unitPrice: 100 }]);
      expect(totals.gstAmount).toBe(10);
      expect(totals.total).toBe(110);
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

    it('blocks backward from multiple states', () => {
      expect(() => svc.assertForward(JobStatus.IN_PROGRESS, JobStatus.QUOTED)).toThrow('Invalid status transition');
      expect(() => svc.assertForward(JobStatus.INVOICED, JobStatus.SCHEDULED)).toThrow('Invalid status transition');
      expect(() => svc.assertForward(JobStatus.PAID, JobStatus.COMPLETED)).toThrow('Invalid status transition');
    });

    it('allows cancellation from any non-paid status', () => {
      expect(() => svc.assertForward(JobStatus.LEAD, JobStatus.CANCELLED)).not.toThrow();
      expect(() => svc.assertForward(JobStatus.SCHEDULED, JobStatus.CANCELLED)).not.toThrow();
      expect(() => svc.assertForward(JobStatus.IN_PROGRESS, JobStatus.CANCELLED)).not.toThrow();
      expect(() => svc.assertForward(JobStatus.QUOTED, JobStatus.CANCELLED)).not.toThrow();
      expect(() => svc.assertForward(JobStatus.COMPLETED, JobStatus.CANCELLED)).not.toThrow();
      expect(() => svc.assertForward(JobStatus.INVOICED, JobStatus.CANCELLED)).not.toThrow();
    });

    it('blocks cancellation from PAID status', () => {
      expect(() => svc.assertForward(JobStatus.PAID, JobStatus.CANCELLED)).toThrow('Invalid status transition');
    });

    it('blocks same-status transition', () => {
      expect(() => svc.assertForward(JobStatus.LEAD, JobStatus.LEAD)).toThrow('Invalid status transition');
      expect(() => svc.assertForward(JobStatus.COMPLETED, JobStatus.COMPLETED)).toThrow('Invalid status transition');
    });

    it('allows owner force override', () => {
      expect(() => svc.assertForward(JobStatus.LEAD, JobStatus.COMPLETED, true)).not.toThrow();
      expect(() => svc.assertForward(JobStatus.PAID, JobStatus.LEAD, true)).not.toThrow();
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

    it('does not mark VOID invoice as overdue', () => {
      const invoice = { status: 'VOID', dueDate: new Date('2020-01-01') };
      const result = svc.overdue(invoice);
      expect(result.isOverdue).toBe(false);
      expect(result.computedStatus).toBe('VOID');
    });

    it('does not mark DRAFT invoice as overdue', () => {
      const invoice = { status: 'DRAFT', dueDate: new Date('2020-01-01') };
      const result = svc.overdue(invoice);
      expect(result.isOverdue).toBe(false);
      expect(result.computedStatus).toBe('DRAFT');
    });

    it('handles invoice with no due date', () => {
      const invoice = { status: 'SENT', dueDate: null };
      const result = svc.overdue(invoice);
      expect(result.isOverdue).toBeFalsy();
      expect(result.computedStatus).toBe('SENT');
    });

    it('preserves all original invoice fields', () => {
      const invoice = { id: '123', status: 'SENT', dueDate: new Date('2020-01-01'), total: 500, items: [] };
      const result = svc.overdue(invoice);
      expect(result.id).toBe('123');
      expect(result.total).toBe(500);
      expect(result.items).toEqual([]);
    });
  });

  describe('password validation regex', () => {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

    it('accepts valid passwords', () => {
      expect(regex.test('Password1')).toBe(true);
      expect(regex.test('MyStr0ngPass')).toBe(true);
      expect(regex.test('abcDEF123')).toBe(true);
    });

    it('rejects passwords without uppercase', () => {
      expect(regex.test('password1')).toBe(false);
    });

    it('rejects passwords without lowercase', () => {
      expect(regex.test('PASSWORD1')).toBe(false);
    });

    it('rejects passwords without digit', () => {
      expect(regex.test('PasswordOnly')).toBe(false);
    });

    it('rejects passwords shorter than 8 characters', () => {
      expect(regex.test('Pass1')).toBe(false);
      expect(regex.test('Ab1defg')).toBe(false);
    });
  });

  describe('ABN checksum validation', () => {
    const validateAbn = (abn: string): boolean => {
      const clean = abn.replace(/\s/g, '');
      if (!/^\d{11}$/.test(clean)) return false;
      const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
      const digits = clean.split('').map(Number);
      digits[0] -= 1;
      const sum = digits.reduce((acc, d, i) => acc + d * weights[i], 0);
      return sum % 89 === 0;
    };

    it('validates a known valid ABN', () => {
      // 51 824 753 556 is a known valid ABN (Australian Taxation Office)
      expect(validateAbn('51824753556')).toBe(true);
    });

    it('validates ABN with spaces', () => {
      expect(validateAbn('51 824 753 556')).toBe(true);
    });

    it('rejects ABN with wrong checksum', () => {
      expect(validateAbn('12345678901')).toBe(false);
    });

    it('rejects ABN with wrong length', () => {
      expect(validateAbn('1234567890')).toBe(false);
      expect(validateAbn('123456789012')).toBe(false);
    });

    it('rejects non-numeric ABN', () => {
      expect(validateAbn('5182475355a')).toBe(false);
    });
  });

  describe('whereScoped', () => {
    it('scopes query by businessId', () => {
      const user = { businessId: 'biz-123' };
      expect(svc.whereScoped(user)).toEqual({ businessId: 'biz-123' });
    });

    it('merges extra conditions', () => {
      const user = { businessId: 'biz-123' };
      expect(svc.whereScoped(user, { status: 'ACTIVE' })).toEqual({ businessId: 'biz-123', status: 'ACTIVE' });
    });
  });
});
