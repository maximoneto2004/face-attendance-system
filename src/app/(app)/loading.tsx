// Esqueleto exibido durante a navegação entre páginas.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Carregando" className="animate-pulse">
      <div className="mb-8 space-y-3">
        <div className="h-8 w-56 rounded-lg bg-slate-200" />
        <div className="h-4 w-80 max-w-full rounded bg-slate-200" />
      </div>
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-slate-200/70" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-16 rounded-2xl bg-slate-200/70" />
        ))}
      </div>
    </div>
  );
}
