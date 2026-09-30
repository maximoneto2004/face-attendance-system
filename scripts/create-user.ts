// Cria (ou redefine a senha de) um professor/administrador. Não há cadastro público.
//
//   npm run user:create -- <email> <senha> "<Nome>"

import "dotenv/config";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

const args = z.tuple([
  z.email("E-mail inválido."),
  z.string().min(8, "A senha deve ter pelo menos 8 caracteres."),
  z.string().trim().min(1, "Informe o nome."),
]);

async function main() {
  const parsed = args.safeParse(process.argv.slice(2));
  if (!parsed.success) {
    console.error('Uso: npm run user:create -- <email> <senha> "<Nome>"');
    console.error(parsed.error.issues.map((i) => `- ${i.message}`).join("\n"));
    process.exit(1);
  }
  const [rawEmail, password, name] = parsed.data;
  const email = rawEmail.toLowerCase();
  const passwordHash = await hashPassword(password);

  const user = await db.user.upsert({
    where: { email },
    create: { email, name, passwordHash },
    update: { name, passwordHash },
  });
  console.log(`Usuário pronto: ${user.email}`);
}

main()
  .catch((error: unknown) => {
    console.error(`Erro: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
