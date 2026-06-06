/**
 * Layout das telas de autenticação (login e onboarding).
 * Centraliza o conteúdo numa coluna estreita, com a mesma textura de fundo
 * sutil da landing page.
 */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, var(--foreground) 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
      />
      <div className="relative w-full max-w-md">{children}</div>
    </main>
  );
}
