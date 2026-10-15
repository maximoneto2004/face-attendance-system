# Evidências do MVP de chamada facial

Data da validação: 15/10/2026 (America/Sao_Paulo)

As imagens desta pasta contêm dados biométricos e permanecem somente no ambiente local. Os formatos de imagem estão bloqueados no `.gitignore`; este relatório textual não contém fotografias nem credenciais.

## Ambiente

- Aplicação: `http://localhost:3000`
- Servidor local: **RUNNING**
- Banco: PostgreSQL local em Prisma Postgres, **CONNECTED**
- Migration: `20260930202912_init`, sem migrations pendentes
- AWS Rekognition: **CONNECTED**
- Região AWS: `us-east-1`
- Collection: `face-attendance-dev`
- Turma: `Turma Jiu-Jitsu Teste`
- Alunos técnicos: 25 (`Aluno 01` a `Aluno 25`)
- Limiares: AUTO ≥ 95%; REVIEW ≥ 85%

## Auditoria e validações

- Stack: Next.js 16.3.8, React 19.2.8, TypeScript 5, Prisma 7.10/PostgreSQL, Tailwind 4, AWS SDK v3, Sharp.
- Autenticação: cookie assinado HMAC e senha com scrypt; rotas e recortes exigem sessão.
- A foto coletiva é processada em memória. Os recortes ficam no banco apenas durante a revisão e são apagados ao confirmar ou descartar.
- `.env`, `fotos/`, `tmp/`, uploads, recortes e screenshots estão fora do Git.
- A Collection foi descrita com sucesso; `DetectFaces`, `IndexFaces`, `SearchFacesByImage` e `DeleteFaces` foram exercitados com a AWS real.
- Smoke test: um rosto foi indexado com confiança de 100%, localizado em outra foto entre 28 rostos com similaridade de 99,9% e removido ao final.

## Detecção em lote

O comando `npm run face:batch-test -- fotos` analisou as 17 fotos locais e detectou 366 rostos.

| Foto | Dimensões | Rostos |
| --- | ---: | ---: |
| WhatsApp Image 2026-10-14 at 19.03.40.jpeg | 1280×960 | 25 |
| WhatsApp Image 2026-10-14 at 19.03.41 (1).jpeg | 1280×960 | 27 |
| WhatsApp Image 2026-10-14 at 19.03.41 (2).jpeg | 960×1280 | 24 |
| WhatsApp Image 2026-10-14 at 19.03.41 (3).jpeg | 1280×960 | 21 |
| WhatsApp Image 2026-10-14 at 19.03.41 (4).jpeg | 1280×960 | 27 |
| WhatsApp Image 2026-10-14 at 19.03.41 (5).jpeg | 720×1280 | 12 |
| WhatsApp Image 2026-10-14 at 19.03.41.jpeg | 960×1280 | 28 |
| WhatsApp Image 2026-10-14 at 19.03.42 (1).jpeg | 1280×960 | 28 |
| WhatsApp Image 2026-10-14 at 19.03.42 (2).jpeg | 960×1280 | 13 |
| WhatsApp Image 2026-10-14 at 19.03.42 (3).jpeg | 1280×960 | 19 |
| WhatsApp Image 2026-10-14 at 19.03.42 (4).jpeg | 960×1280 | 13 |
| WhatsApp Image 2026-10-14 at 19.03.42 (5).jpeg | 960×1280 | 21 |
| WhatsApp Image 2026-10-14 at 19.03.42.jpeg | 960×1280 | 22 |
| WhatsApp Image 2026-10-14 at 19.03.43 (1).jpeg | 960×1280 | 20 |
| WhatsApp Image 2026-10-14 at 19.03.43 (2).jpeg | 960×1280 | 23 |
| WhatsApp Image 2026-10-14 at 19.03.43 (3).jpeg | 1280×960 | 18 |
| WhatsApp Image 2026-10-14 at 19.03.43.jpeg | 960×1280 | 25 |

O log informa bounding box relativa, confiança de detecção e tamanho aproximado de cada rosto. A opção `--crops` grava recortes somente em `tmp/face-crops/`, que é ignorado pelo Git.

## Primeira chamada — cadastro assistido

Imagem: `WhatsApp Image 2026-10-14 at 19.03.40.jpeg`

- 25 rostos detectados
- 25 rostos inicialmente desconhecidos
- 25 associações técnicas, sem inferir nomes reais
- 25 identidades cadastradas no Rekognition e persistidas no banco
- 25 presentes, 0 ausentes
- Chamada `cmv8o9hgm000qnkuyts8aqxrt` confirmada
- Recortes temporários apagados após a confirmação

Antes da confirmação válida, o teste tentou atribuir duas faces ao mesmo aluno e comprovou a rejeição com a mensagem “O mesmo aluno foi marcado mais de uma vez”.

## Reconhecimento em chamadas seguintes

| Foto | Detectados | AUTO | REVIEW | UNKNOWN | Presentes | Ausentes | Similaridade média | Menor |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 19.03.41 (1) | 27 | 13 | 0 | 14 | 13 | 12 | 99,87% | 98,52% |
| 19.03.41 (4) | 27 | 13 | 0 | 14 | 13 | 12 | 99,92% | 99,59% |
| 19.03.41 | 28 | 13 | 0 | 15 | 13 | 12 | 99,93% | 99,45% |
| 19.03.42 (1) | 28 | 15 | 0 | 13 | 15 | 10 | 99,75% | 98,36% |
| 19.03.42 | 22 | 12 | 0 | 10 | 12 | 13 | 99,98% | 99,94% |
| 19.03.43 | 25 | 9 | 0 | 16 | 9 | 16 | 99,94% | 99,77% |
| 19.03.43 (2), navegador | 23 | 11 | 0 | 12 | 11 | 14 | 99,77% | 98,27% |

Totais das sete chamadas de reconhecimento:

- 180 rostos detectados
- 86 reconhecimentos automáticos
- 0 resultados na faixa REVIEW
- 94 desconhecidos preservados sem associação forçada
- similaridade média ponderada: 99,88%
- menor similaridade aceita: 98,27%
- maior similaridade observada: 100,00%
- maior similaridade rejeitada: indisponível, pois `SearchFacesByImage` não retorna resultados abaixo do limiar de 85%

Não houve falso positivo percebido na conferência visual dos matches mostrados. Não há rótulos reais de identidade para calcular falso negativo; os 94 eventos UNKNOWN incluem pessoas que não estavam entre os 25 rostos da matrícula inicial e possíveis variações de pose/oclusão. Os resultados não justificam reduzir os limiares atuais.

## Identidades persistidas

Os FaceIds não são credenciais. Eles identificam registros biométricos na Collection e estão vinculados aos alunos técnicos abaixo.

| Aluno | StudentId | Rekognition FaceId |
| --- | --- | --- |
| Aluno 01 | `cmv8o9csh0001nkuyeqkmcagm` | `bd45e817-eb01-47d5-8775-f9ec8ac0121e` |
| Aluno 02 | `cmv8o9d3i0002nkuynv71fsrw` | `c65922d7-bf98-4ca7-817c-758b2feb5f74` |
| Aluno 03 | `cmv8o9d7w0003nkuy3ibprm6m` | `22ebae4f-a750-4cd4-9467-28be2ef12db3` |
| Aluno 04 | `cmv8o9dbt0004nkuybn5yqyx9` | `137714c1-3a29-4a0a-b8ba-9c94e4ce635e` |
| Aluno 05 | `cmv8o9dgm0005nkuyeivxo6wy` | `1156a3bc-43ae-448b-97a5-90cb5253f56f` |
| Aluno 06 | `cmv8o9dkx0006nkuylw1es4ej` | `485ebac6-a746-483c-b8d8-a903b0e85b59` |
| Aluno 07 | `cmv8o9dq10007nkuyzu0pdopl` | `6030d2d1-0379-4bc4-9388-66830ed85a31` |
| Aluno 08 | `cmv8o9dtl0008nkuyk7sc05t3` | `4987ef6e-3bb7-418a-825c-dcce5d32dcb7` |
| Aluno 09 | `cmv8o9dx80009nkuy4o0frlab` | `4653ae4d-1d14-49a6-bd18-a490a98aa79b` |
| Aluno 10 | `cmv8o9e1i000ankuylr2y1a18` | `496389f4-1573-4461-92de-3cab9e71bf80` |
| Aluno 11 | `cmv8o9e60000bnkuydd9ljn09` | `487a9578-d3a1-4e5e-bedc-66ffa0f16a30` |
| Aluno 12 | `cmv8o9e9m000cnkuyanvtsz5f` | `be9a9a7f-6244-402c-8f19-221ea1b606f4` |
| Aluno 13 | `cmv8o9ed2000dnkuy4fuwm2ob` | `52982ced-7b71-4492-9b4e-64b70e54195e` |
| Aluno 14 | `cmv8o9egv000enkuyoobr36r2` | `f248b775-c0ed-40e0-908b-87106597b4fd` |
| Aluno 15 | `cmv8o9ekd000fnkuyv98a2a0d` | `eac6f437-daf7-4c7a-90d5-82de0d922410` |
| Aluno 16 | `cmv8o9eo7000gnkuycvnvdcv6` | `f0e5e318-bff5-4fb1-9ad2-6cd082c6f778` |
| Aluno 17 | `cmv8o9erv000hnkuy4nsapt9y` | `a592c1f6-8805-4aa5-bb32-3c5b49de11c2` |
| Aluno 18 | `cmv8o9eve000inkuy6n7bvta2` | `c2331411-61ec-45c8-81b8-ceb831adc83c` |
| Aluno 19 | `cmv8o9ez7000jnkuyr72h1h9c` | `43fa598c-0527-4030-ac9d-cc9f77ae14f0` |
| Aluno 20 | `cmv8o9f2y000knkuyj8a3th9w` | `85ed3b34-1b33-48ac-88aa-3ffc6316b3fc` |
| Aluno 21 | `cmv8o9f6u000lnkuyf899rn9j` | `eebfc40b-9c90-4859-994b-4fc61b18775b` |
| Aluno 22 | `cmv8o9fas000mnkuyzd8gn0j7` | `a865bd32-5308-4306-9752-a9e2967546a9` |
| Aluno 23 | `cmv8o9feg000nnkuyma6p2wcj` | `418d4bfb-20a6-483d-ac10-06c1106d6198` |
| Aluno 24 | `cmv8o9fhx000onkuyufdp0ynk` | `348201d5-ffe8-455a-8574-15360fef0247` |
| Aluno 25 | `cmv8o9flg000pnkuyoe2u5sox` | `d810ede8-5572-4c04-be84-366232cdadbc` |

## Testes de regras

- associação manual e persistência de 25 identidades
- criação e confirmação de oito chamadas
- 200 registros de presença/ausência no histórico (25 por chamada)
- recusa de duas faces atribuídas ao mesmo aluno
- restrição de matches aos alunos da turma
- desconhecidos não forçados a um aluno
- chamadas em revisão descartadas sem deixar recortes
- recortes apagados após confirmação
- histórico e detalhes de chamada validados no navegador
- rota privada de recorte validada com sessão e sem cache

## Problemas encontrados e corrigidos

- O PostgreSQL local estava parado; a instância `face-attendance` foi iniciada e reconectada.
- `fotos/` ainda não estava ignorada; fotos, recortes e imagens de prova foram adicionados ao `.gitignore`.
- O runner E2E precisava da condição de módulo `react-server`; o script passou a executá-la explicitamente.
- A rota do recorte podia produzir erro do adaptador ao ler `BYTEA` nulo durante a confirmação; agora filtra recortes nulos e responde como imagem indisponível.
- A automação de screenshot passou a aguardar o carregamento real dos recortes.
- Uma associação usada apenas para encenar a captura foi removida da AWS e revertida no banco; a Collection final contém somente as 25 identidades do cadastro inicial.

## Screenshots locais

- `01-dashboard.png`
- `02-turma.png`
- `03-alunos.png`
- `04-nova-chamada.png`
- `05-upload-foto.png`
- `06-processamento.png`
- `07-rostos-detectados.png`
- `08-revisao.png`
- `09-associacao-manual.png` (interação encenada e descartada, sem persistência)
- `12-reconhecimento-automatico.png`
- `13-scores-similaridade.png`
- `14-chamada-confirmada.png`
- `15-historico.png`

Todas foram geradas automaticamente com Playwright/Chrome local. Os arquivos de imagem são privados e ignorados pelo Git.

## Comandos de reprodução

```text
npm run face:test -- <foto-referência> <foto-alvo>
npm run face:batch-test -- fotos
npm run mvp:e2e
npm run mvp:report-data
npm run evidence:capture
```

O comando de captura exige `MVP_TEST_EMAIL` e `MVP_TEST_PASSWORD` no ambiente do processo. Não grave a senha no repositório.
