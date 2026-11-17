-- Perfis de acesso: coordenação (ADMIN) vê tudo; professor (TEACHER) vê só as próprias turmas.

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'TEACHER');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'TEACHER',
ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "classes" ADD COLUMN     "teacherId" TEXT;

-- CreateIndex
CREATE INDEX "classes_teacherId_idx" ON "classes"("teacherId");

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Dados existentes ---------------------------------------------------------

-- 1. O primeiro usuário criado (conta de quem instalou o sistema) vira coordenação,
--    para que sempre exista alguém capaz de atribuir turmas e gerenciar professores.
UPDATE "users" SET "role" = 'ADMIN'
WHERE "id" = (SELECT "id" FROM "users" ORDER BY "createdAt" ASC, "id" ASC LIMIT 1);

-- 2. Cada turma passa a pertencer ao usuário que mais fez chamadas nela
--    (cada perfil de modalidade continua vendo as turmas que já usava).
UPDATE "classes" AS c
SET "teacherId" = s."createdById"
FROM (
  SELECT DISTINCT ON ("classroomId") "classroomId", "createdById"
  FROM "attendance_sessions"
  GROUP BY "classroomId", "createdById"
  ORDER BY "classroomId", COUNT(*) DESC, MAX("takenAt") DESC
) AS s
WHERE c."id" = s."classroomId";
