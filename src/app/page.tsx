import Link from "next/link";

const fluxo = [
  { passo: "01", titulo: "Cliente pede no WhatsApp", desc: "Mensagem em texto livre, sem app nem site." },
  { passo: "02", titulo: "IA interpreta e confirma", desc: "Extrai itens, quantidades e horário; confirma antes de gravar." },
  { passo: "03", titulo: "Comanda impressa", desc: "Impressão automática na térmica do balcão." },
  { passo: "04", titulo: "Retirada organizada", desc: "Cliente é avisado quando o pedido fica pronto." },
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      {/* textura de fundo sutil */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, var(--foreground) 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10">
        {/* topo */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <span className="font-display text-lg font-semibold">A</span>
            </div>
            <span className="font-display text-lg font-semibold tracking-tight">
              Açougue Inteligente
            </span>
          </div>
          <Link
            href="/login"
            className="rounded-full border border-border bg-secondary px-4 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-card"
          >
            Entrar
          </Link>
        </header>

        {/* hero */}
        <section className="flex flex-1 flex-col justify-center py-16">
          <p className="mb-4 inline-flex w-fit items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-sm font-medium text-accent-foreground">
            <span className="size-2 rounded-full bg-accent" />
            Ambiente provisionado e no ar
          </p>

          <h1 className="max-w-3xl font-display text-5xl font-light leading-[1.05] tracking-tight text-foreground sm:text-6xl">
            Pedidos de carne pelo{" "}
            <span className="font-semibold text-primary">WhatsApp</span>,
            <br />
            organizados sozinhos.
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            O cliente pede como sempre fez. A IA interpreta, a comanda é impressa
            automaticamente e a equipe gerencia tudo num painel. Sem app, sem fila,
            sem erro de anotação.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Acessar o painel
            </Link>
            <Link
              href="/api/health"
              className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-card px-6 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              Health check
            </Link>
          </div>
        </section>

        {/* fluxo */}
        <section className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {fluxo.map((f) => (
            <div key={f.passo} className="bg-card p-5">
              <span className="font-display text-sm font-semibold text-accent">{f.passo}</span>
              <h3 className="mt-2 font-medium text-foreground">{f.titulo}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>

        {/* rodapé */}
        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6 text-sm text-muted-foreground">
          <span>MVP · Next.js 16 · Supabase · Prisma</span>
          <span>Cliente → WhatsApp → Pedido → Impressão → Retirada</span>
        </footer>
      </div>
    </main>
  );
}
