import "dotenv/config";

import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const baseUrl = process.env.MVP_BASE_URL ?? "http://localhost:3000";
const email = process.env.MVP_TEST_EMAIL;
const password = process.env.MVP_TEST_PASSWORD;
const resumeSessionId = process.env.MVP_REVIEW_SESSION_ID;
const reviewOnly = process.env.MVP_REVIEW_ONLY === "1";

async function main() {
  if (!email || !password) {
    throw new Error("Configure MVP_TEST_EMAIL e MVP_TEST_PASSWORD apenas no ambiente do comando.");
  }

  const data = JSON.parse(await readFile("tmp/mvp-results.json", "utf8")) as {
    class: { id: string };
  };
  const outputDir = path.resolve("planning", "provas");
  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });

  async function shot(name: string, fullPage = true) {
    await page.screenshot({ path: path.join(outputDir, name), fullPage });
    console.log(`[evidence] ${name} url=${page.url()}`);
  }

  try {
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await Promise.all([page.waitForURL(`${baseUrl}/`), page.getByRole("button", { name: "Entrar" }).click()]);
  await shot("01-dashboard.png");

  await page.goto(`${baseUrl}/classes/${data.class.id}`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Turma Jiu-Jitsu Teste" }).waitFor();
  await shot("02-turma.png");

  await page.goto(`${baseUrl}/students`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Alunos" }).waitFor();
  await shot("03-alunos.png");

  await page.goto(`${baseUrl}/attendance/new?classroomId=${data.class.id}`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Nova chamada" }).waitFor();
  await shot("04-nova-chamada.png");

  const photo = path.resolve("fotos", "WhatsApp Image 2026-10-14 at 19.03.43 (2).jpeg");
  await page.locator('input[type="file"]').setInputFiles(photo);
  await page.locator('img[alt="Pré-visualização da foto"]').waitFor();
  await shot("05-upload-foto.png");

  if (resumeSessionId) {
    await page.goto(`${baseUrl}/attendance/${resumeSessionId}`, { waitUntil: "networkidle" });
  } else {
    await page.getByRole("button", { name: "Processar foto" }).click({ noWaitAfter: true });
    await page.getByRole("button", { name: /Detectando e reconhecendo rostos/ }).waitFor();
    await shot("06-processamento.png", false);
    await page.waitForURL(/\/attendance\/[^/]+$/, { timeout: 120_000 });
  }
  await page.waitForFunction(
    () => document.body.innerText.includes("Confirmar chamada") || document.body.innerText.includes("presente(s)"),
    undefined,
    { timeout: 120_000 },
  );
  if ((await page.getByRole("button", { name: "Confirmar chamada" }).count()) === 0) {
    await page.getByText(/presente\(s\)/).first().waitFor();
    await shot("14-chamada-confirmada.png");
    await page.goto(`${baseUrl}/attendance`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Histórico de chamadas" }).waitFor();
    await shot("15-historico.png");
    return;
  }
  await page.getByText(/rosto\(s\) detectado\(s\)/).waitFor();
  await page.waitForFunction(
    () => {
      const images = [...document.querySelectorAll<HTMLImageElement>('img[alt="Rosto detectado"]')];
      return images.length > 0 && images.every((image) => image.complete && image.naturalWidth > 0);
    },
    undefined,
    { timeout: 60_000 },
  );
  const faceImages = page.locator('img[alt="Rosto detectado"]');
  for (let index = 0; index < (await faceImages.count()); index += 1) {
    await faceImages.nth(index).scrollIntoViewIfNeeded();
    await page.waitForTimeout(30);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot("07-rostos-detectados.png");
  await shot("08-revisao.png");

  const faceSelects = page.locator('select[aria-label="Aluno deste rosto"]');
  const selectCount = await faceSelects.count();
  let stagedIndex: number | null = null;
  for (let index = 0; index < selectCount; index += 1) {
    const select = faceSelects.nth(index);
    if ((await select.inputValue()) !== "") continue;
    const studentValue = await select.locator("option:not([disabled])").evaluateAll((options) => {
      const option = options.find((node) => {
        const value = (node as HTMLOptionElement).value;
        return value !== "" && value !== "__ignore";
      }) as HTMLOptionElement | undefined;
      return option?.value ?? null;
    });
    if (studentValue) {
      await select.selectOption(studentValue);
      stagedIndex = index;
      break;
    }
  }
  if (stagedIndex !== null) await shot("09-associacao-manual.png");

  // Não persiste uma associação arbitrária: desconhecidos são explicitamente ignorados.
  if (stagedIndex !== null) await faceSelects.nth(stagedIndex).selectOption("__ignore");
  for (let index = 0; index < selectCount; index += 1) {
    const select = faceSelects.nth(index);
    if ((await select.inputValue()) === "") await select.selectOption("__ignore");
  }

  await shot("12-reconhecimento-automatico.png");
  await shot("13-scores-similaridade.png");
  if (reviewOnly) {
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Descartar" }).click();
    await page.waitForURL(`${baseUrl}/attendance`);
    console.log("[evidence] review session discarded");
    return;
  }
  await page.getByRole("button", { name: "Confirmar chamada" }).click();
  await page.getByText(/presente\(s\)/).first().waitFor({ timeout: 120_000 });
  await shot("14-chamada-confirmada.png");

  await page.goto(`${baseUrl}/attendance`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Histórico de chamadas" }).waitFor();
  await shot("15-historico.png");
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error(`[evidence] error=${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
