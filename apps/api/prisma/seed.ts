import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const business = await prisma.business.upsert({
    where: { id: 'demo-business' },
    update: {},
    create: { id: 'demo-business', name: 'Demo Tradie Pty Ltd', email: 'demo@tradieflow.app' }
  });
  const owner = await prisma.user.upsert({
    where: { email: 'owner@demo.com' },
    update: {},
    create: {
      businessId: business.id,
      name: 'Demo Owner',
      email: 'owner@demo.com',
      role: Role.OWNER,
      passwordHash: await bcrypt.hash('Password123!', 10)
    }
  });
  const customer = await prisma.customer.create({ data: { businessId: business.id, name: 'Acme Property', email: 'contact@acme.com' } });
  await prisma.job.create({ data: { businessId: business.id, customerId: customer.id, title: 'Fix leaking tap', assignedUserId: owner.id } });
  console.log('Seeded demo data');
}

main().finally(() => prisma.$disconnect());
