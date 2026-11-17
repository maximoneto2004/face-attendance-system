import Link from "next/link";
import { EmptyState, buttonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <EmptyState
      icon="search"
      title="Página não encontrada"
      action={
        <Link href="/" className={buttonClass("primary")}>
          Voltar ao início
        </Link>
      }
    >
      O item que você procura não existe mais ou o endereço está incorreto. Chamadas não confirmadas são descartadas
      automaticamente após 24 horas.
    </EmptyState>
  );
}
