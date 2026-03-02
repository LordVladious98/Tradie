import { AppService } from '../src/service';

describe('AppService', () => {
  it('calculates totals with GST', () => {
    const svc = new AppService({} as any, {} as any);
    const totals = svc.totals([{ quantity: 2, unitPrice: 10.115 }], 0, true, 0.1);
    expect(totals.subtotal).toBe(20.23);
    expect(totals.gstAmount).toBe(2.02);
    expect(totals.total).toBe(22.25);
  });
});
