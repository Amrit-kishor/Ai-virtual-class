import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const teacherPassword = await bcrypt.hash('teacher123', 10);
  const studentPassword = await bcrypt.hash('student123', 10);

  const teacher = await prisma.user.upsert({
    where: { email: 'teacher@classroom.ai' },
    update: {},
    create: {
      email: 'teacher@classroom.ai',
      name: 'Prof. Alex Mercer',
      passwordHash: teacherPassword,
      role: 'TEACHER',
    },
  });

  const student = await prisma.user.upsert({
    where: { email: 'student@classroom.ai' },
    update: {},
    create: {
      email: 'student@classroom.ai',
      name: 'Sarah Connor',
      passwordHash: studentPassword,
      role: 'STUDENT',
    },
  });

  console.log('Database seeded successfully:', { teacher, student });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
