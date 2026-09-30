# Chamada Facial — controle de presença por foto da turma

Sistema web para registrar presença de alunos de um projeto social a partir de **uma única foto da turma**.
O professor tira a foto, o sistema detecta todos os rostos, reconhece os alunos já conhecidos e pede ao
professor que identifique os desconhecidos. Cada rosto identificado manualmente passa a ser reconhecido
automaticamente nas chamadas seguintes — o sistema fica mais automático a cada uso.

```text
1ª chamada: 30 rostos → 0 reconhecidos → professor identifica os 30
2ª chamada: 30 rostos → 25 reconhecidos → professor revisa 5
```

## Stack

- **Next.js 16** (App Router, Server Components, Server Actions, Route Handlers) + TypeScript
- **PostgreSQL** + **Prisma 7** (driver adapter `@prisma/adapter-pg`)
- **Tailwind CSS 4**
- **AWS Rekognition** (SDK v3) para detecção e reconhecimento facial
- **sharp** para normalizar a foto e recortar os rostos (em memória)

Sem backend separado: a própria aplicação Next.js faz tudo.

## Arquitetura resumida

```text
Navegador ── reduz a foto (~2400px, JPEG) ──► Server Action (Next.js)
                                                   │
          src/lib/attendance.ts  (fluxo da chamada)│
             1. normaliza a foto (sharp, EXIF, sem metadados)
             2. DetectFaces na foto inteira ─────────────► AWS Rekognition
             3. recorta cada rosto (sharp)
             4. SearchFacesByImage por recorte ──────────► AWS Rekognition (Collection)
             5. traduz FaceId → aluno pelo banco, aplica limiares
             6. grava chamada "em revisão" + recortes temporários ──► PostgreSQL
                                                   │
Tela de revisão ◄──────────────────────────────────┘
   professor confirma / corrige / identifica
                                                   │
          confirmAttendance()                      ▼
             - IndexFaces só dos rostos confirmados manualmente ──► Rekognition
             - grava presenças/ausências, apaga recortes ──► PostgreSQL
```

| Caminho | Conteúdo |
| --- | --- |
| `src/lib/rekognition/` | **Única** camada que fala com a AWS (collection, detectar, buscar, indexar, excluir) |
| `src/lib/attendance.ts` | Fluxo principal: processar foto, confirmar chamada, descartar, excluir identidade facial |
| `src/lib/face-images.ts` | Normalização da foto e recorte de rostos |
| `src/lib/config.ts` | Limiares de reconhecimento e parâmetros (configuráveis por env) |
| `src/lib/auth/` | Sessão por cookie assinado (HMAC) e senhas com scrypt |
| `src/proxy.ts` | Redireciona para `/login` quem não está autenticado |
| `src/app/(app)/` | Telas: início, alunos, turmas, nova chamada, revisão, histórico |
| `src/app/api/faces/[id]/image` | Serve recortes de rosto somente para usuários autenticados |
| `prisma/schema.prisma` | Modelo de dados |
| `scripts/` | `create-user` (cria professor) e `face-smoke-test` (teste rápido da AWS) |

### Modelo de dados

`User` (professor) · `Student` (aluno) · `Classroom` (turma) · `ClassroomStudent` (aluno↔turma) ·
`AttendanceSession` (chamada) · `DetectedFace` (rosto encontrado na foto) · `Attendance` (presença) ·
`FaceIdentity` (vínculo aluno ↔ rosto indexado no Rekognition).

Métodos de presença: `FACIAL_AUTO` (reconhecido acima do limiar automático), `FACIAL_CONFIRMED`
(professor confirmou/corrigiu/identificou o rosto) e `MANUAL` (marcado sem rosto na foto).

### Regras de reconhecimento

- Similaridade ≥ `FACE_AUTO_ACCEPT_THRESHOLD` (padrão 95) → **reconhecido** automaticamente.
- Entre `FACE_REVIEW_THRESHOLD` (padrão 85) e o limiar automático → **possível aluno**, o professor confirma.
- Abaixo de `FACE_REVIEW_THRESHOLD` → **desconhecido**.
- Só são considerados alunos ativos da turma da chamada; um aluno nunca é atribuído a dois rostos.
- **Novos rostos só são cadastrados após confirmação manual** do professor. Reconhecimentos automáticos
  não enriquecem a identidade do aluno. Máximo de 10 rostos por aluno (`src/lib/config.ts`).
- Na primeira chamada (Collection vazia) não há buscas na AWS — apenas a detecção.

## Privacidade (dados biométricos, possivelmente de menores)

- A foto coletiva **não é armazenada**: existe só em memória durante o processamento.
- Os recortes de rosto ficam no banco (`DetectedFace.cropImage`) **apenas até a chamada ser confirmada ou
  descartada**. Chamadas abandonadas em revisão são apagadas após 24 h.
- Recortes são servidos apenas a usuários autenticados, sem cache (`private, no-store`). Nada vai para `public/`.
- Não há embeddings no banco: o Rekognition guarda os vetores; o banco guarda apenas o `FaceId`.
- Logs não contêm imagens, respostas da AWS nem secrets.
- **Exclusão**: na página do aluno, “Excluir identidade facial” remove os rostos da Collection e do banco
  (`deleteStudentFaceIdentity` em `src/lib/attendance.ts`).
- Os pontos onde há dado biométrico estão marcados com comentários `DADO BIOMÉTRICO` no código.

## Como rodar localmente

Pré-requisitos: Node.js 20+ e npm.

```bash
git clone https://github.com/maximoneto2004/face-attendance-system.git
cd face-attendance-system
npm install            # também gera o Prisma Client
cp .env.example .env   # e preencha (veja abaixo)
```

### 1. PostgreSQL

Escolha uma opção:

- **Sem instalar nada (recomendado para dev):** `npx prisma dev` sobe um Postgres local e mostra a URL
  (`postgres://postgres:postgres@localhost:51214/template1?sslmode=disable`). Use-a em `DATABASE_URL`.
  Para rodar em segundo plano: `npx prisma dev --name face-attendance --detach`.
- **Docker:** `docker run -d --name face-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=face_attendance -p 5432:5432 postgres:17`
  → `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/face_attendance"`
- **Gerenciado:** Neon, Supabase, RDS etc. — basta a connection string.

### 2. Migrations

```bash
npm run db:migrate     # desenvolvimento (prisma migrate dev)
npm run db:deploy      # produção (prisma migrate deploy)
```

### 3. `.env`

| Variável | Descrição |
| --- | --- |
| `DATABASE_URL` | Connection string do PostgreSQL |
| `AUTH_SECRET` | ≥ 32 caracteres aleatórios. Gere: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `AWS_REGION` | Região do Rekognition (ex.: `us-east-1`) |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Credenciais do usuário IAM (somente local) |
| `AWS_REKOGNITION_COLLECTION_ID` | Nome da Collection (criada automaticamente no 1º uso). Use nomes diferentes para dev e produção |
| `FACE_AUTO_ACCEPT_THRESHOLD` / `FACE_REVIEW_THRESHOLD` | Limiares de similaridade (0–100) |

### 4. AWS Rekognition

1. No console AWS, IAM → Users → **Create user** (ex.: `face-attendance-app`), sem acesso ao console.
2. Anexe uma policy inline mínima (troque região, conta e collection):

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "rekognition:CreateCollection",
           "rekognition:DescribeCollection",
           "rekognition:IndexFaces",
           "rekognition:SearchFacesByImage",
           "rekognition:DeleteFaces"
         ],
         "Resource": "arn:aws:rekognition:us-east-1:SEU_ACCOUNT_ID:collection/face-attendance*"
       },
       { "Effect": "Allow", "Action": "rekognition:DetectFaces", "Resource": "*" }
     ]
   }
   ```

3. Security credentials → **Create access key** → preencha `AWS_ACCESS_KEY_ID` e `AWS_SECRET_ACCESS_KEY`.
4. A Collection é criada automaticamente no primeiro uso.

**Produção:** não use chaves fixas. Rode com um IAM Role (EC2/ECS/App Runner/Lambda) ou OIDC
(ex.: Vercel → AWS) e deixe `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` vazios — o SDK usa a cadeia
padrão de credenciais automaticamente.

**Custo aproximado:** cada chamada com 30 rostos faz ~1 `DetectFaces` + 30 `SearchFacesByImage`
(+ `IndexFaces` dos rostos confirmados). Na tabela pública da AWS isso fica em torno de US$ 0,03 por
chamada; o armazenamento de rostos é praticamente desprezível. Confira a página de preços do Rekognition
para sua região.

### 5. Teste rápido da integração facial

Sem banco e sem interface — valida credenciais e reconhecimento:

```bash
npm run face:test -- caminho/foto-A.jpg caminho/foto-B.jpg
```

Cadastra o rosto da foto A, detecta todos os rostos da foto B (pode ser foto de grupo), procura cada um e
informa se a pessoa da foto A foi reconhecida. O rosto de teste é removido ao final.
(Coloque fotos de teste em `test-photos/` — a pasta é ignorada pelo git.)

### 6. Criar o professor e rodar

```bash
npm run user:create -- professor@exemplo.org "uma-senha-forte" "Nome do Professor"
npm run dev            # http://localhost:3000
```

Não há cadastro público; novos professores são criados pelo mesmo comando.

### Build e verificação

```bash
npm run lint
npm run typecheck
npm run build && npm start
```

## Principais fluxos

1. **Turmas → criar turma → “Cadastrar novos alunos”** (um nome por linha) ou adicionar alunos existentes.
2. **Nova chamada** → escolher turma → tirar/escolher a foto → **Processar foto**.
3. **Revisão**: cada rosto aparece recortado com o status:
   - ✅ *Reconhecido* (já marcado; dá para trocar no seletor);
   - ⚠️ *Possível aluno* → **Confirmar** ou **Corrigir**;
   - ❓ *Desconhecido* → selecionar o aluno (alunos sem rosto cadastrado aparecem primeiro) ou ignorar.
   Alunos que não aparecem na foto podem ser marcados presentes manualmente.
4. **Confirmar chamada**: grava presenças/ausências, cadastra no Rekognition os rostos identificados
   manualmente e apaga os recortes.
5. **Histórico**: lista de chamadas com presentes e ausentes de cada uma.
6. **Aluno**: editar, ativar/desativar, ver/excluir identidade facial.

## Situação atual

**Funcionando e verificado localmente:** autenticação, alunos, turmas, cadastro em lote, tela de nova
chamada, tela de revisão, confirmação (presenças, ausências, validações, bloqueio de dupla confirmação,
limpeza dos recortes), histórico, dashboard, lint, typecheck e build.

**Implementado, aguardando credenciais AWS para validação real:** detecção dos rostos, busca na Collection
e cadastro de rostos confirmados. Sem credenciais, a aplicação mostra uma mensagem clara do que falta configurar.

**Próximos passos sugeridos:**

- Validar com fotos reais e calibrar os limiares (`FACE_*_THRESHOLD`).
- Exportar presenças (CSV) por turma/período.
- Termo de consentimento/registro de base legal (LGPD) por aluno antes de cadastrar o rosto.
- Deploy (ex.: Vercel/App Runner + Postgres gerenciado + IAM Role).
