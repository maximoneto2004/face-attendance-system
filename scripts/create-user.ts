// Cria (ou redefine a senha de) um professor/administrador. Não há cadastro público.
//
//   npm run user:create -- <email> <senha> "<Nome>" [--coordenacao | --tech]
//
// --coordenacao: acesso de coordenação (vê e gerencia todas as turmas e professores).
// --tech: administrador tech (tudo da coordenação + tela "Uso do sistema").
// Sem opção, cria um professor (vê só as turmas pelas quais é responsável).

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
  const argv = process.argv.slice(2);
  const role = argv.includes("--tech") ? "TECH" : argv.includes("--coordenacao") ? "ADMIN" : "TEACHER";
  const parsed = args.safeParse(argv.filter((a) => a !== "--coordenacao" && a !== "--tech"));
  if (!parsed.success) {
    console.error('Uso: npm run user:create -- <email> <senha> "<Nome>" [--coordenacao | --tech]');
    console.error(parsed.error.issues.map((i) => `- ${i.message}`).join("\n"));
    process.exit(1);
  }
  const [rawEmail, password, name] = parsed.data;
  const email = rawEmail.toLowerCase();
  const passwordHash = await hashPassword(password);

  const user = await db.user.upsert({
    where: { email },
    create: { email, name, passwordHash, role },
    // Redefinir a senha desconecta os aparelhos que usavam a antiga.
    // Sem --coordenacao/--tech, o perfil de um usuário existente não muda.
    update: { name, passwordHash, ...(role !== "TEACHER" ? { role } : {}), sessionVersion: { increment: 1 } },
  });
  console.log(`Usuário pronto: ${user.email} (${{ ADMIN: "coordenação", TECH: "administrador tech", TEACHER: "professor" }[role]})`);
}

main()
  .catch((error: unknown) => {
    console.error(`Erro: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
