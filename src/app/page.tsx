import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Hero */}
      <section className="mx-auto max-w-2xl px-6 py-20 text-center">
        <span className="inline-block rounded-full bg-blue-100 px-4 py-1 text-xs font-medium text-blue-700 mb-6">
          Magnus SRL — Ricambi Auto Americani
        </span>
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-4">
          Invia la tua richiesta{" "}
          <span className="text-blue-600">in pochi minuti</span>
        </h1>
        <p className="text-lg text-gray-500 mb-10">
          Ricambi, accessori e lubrificanti AMSOIL per veicoli americani. Compila il
          form e il nostro team commerciale ti contatterà con la migliore offerta.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/qualifica"
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            🚗 Invia la tua richiesta
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
            {
              n: "1",
              title: "Descrivi cosa cerchi",
              desc: "Ricambi, accessori, lubrificanti: dicci di cosa hai bisogno e per quale veicolo.",
            },
            {
              n: "2",
              title: "Ricevi conferma",
              desc: "A invio completato ricevi una email di riepilogo con i dati inseriti.",
            },
            {
              n: "3",
              title: "Vieni contattato",
              desc: "Il team Magnus ti risponderà con disponibilità e quotazione personalizzata.",
            },
          ].map((step) => (
            <div
              key={step.n}
              className="rounded-xl border border-gray-100 bg-white px-6 py-6 text-center shadow-sm"
            >
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-lg">
                {step.n}
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{step.title}</h3>
              <p className="text-sm text-gray-500">{step.desc}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-gray-400">
          Magnus SRL serve principalmente clienti B2B. L&apos;ordine minimo è di <strong>€300</strong>.
        </p>
      </section>

      {/* Footer GDPR */}
      <footer className="border-t border-gray-100 bg-white py-6 text-center text-xs text-gray-400">
        I dati forniti sono trattati in conformità al GDPR (Reg. UE 2016/679) e utilizzati
        esclusivamente per la gestione della tua richiesta da parte di Magnus SRL.
      </footer>
    </main>
  );
}
