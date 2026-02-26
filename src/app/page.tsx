import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Hero */}
      <section className="mx-auto max-w-2xl px-6 py-20 text-center">
        <span className="inline-block rounded-full bg-blue-100 px-4 py-1 text-xs font-medium text-blue-700 mb-6">
          Agenzia Immobiliare
        </span>
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-4">
          Qualifica la tua richiesta{" "}
          <span className="text-blue-600">in 60 secondi</span>
        </h1>
        <p className="text-lg text-gray-500 mb-10">
          Rispondi a poche domande e ricevi subito un riepilogo. Il nostro agente ti
          contatterà con una proposta su misura.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/qualifica?tipo=buyer"
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            🏠 Voglio Comprare
          </Link>
          <Link
            href="/qualifica?tipo=seller"
            className="flex items-center justify-center gap-2 rounded-xl bg-white border border-gray-200 px-8 py-4 text-base font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            💰 Voglio Vendere
          </Link>
        </div>
      </section>

      {/* Come funziona */}
      <section className="mx-auto max-w-3xl px-6 pb-20">
        <h2 className="text-center text-2xl font-semibold text-gray-900 mb-10">
          Come funziona
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { n: "1", title: "Rispondi", desc: "Poche domande mirate, nessun dato personale richiesto." },
            { n: "2", title: "Ricevi il riepilogo", desc: "Vedi subito un riepilogo della tua richiesta." },
            { n: "3", title: "Vieni contattato", desc: "Un agente ti raggiungerà con la proposta giusta." },
          ].map((step) => (
            <div key={step.n} className="rounded-xl border border-gray-100 bg-white px-6 py-6 text-center shadow-sm">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-lg">
                {step.n}
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{step.title}</h3>
              <p className="text-sm text-gray-500">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer GDPR */}
      <footer className="border-t border-gray-100 bg-white py-6 text-center text-xs text-gray-400">
        I dati forniti sono trattati in conformità al GDPR (Reg. UE 2016/679) e utilizzati
        esclusivamente per rispondere alla tua richiesta.
      </footer>
    </main>
  );
}
