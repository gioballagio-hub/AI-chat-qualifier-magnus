"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SessionContext } from "@/lib/session-context";
import type { SessionInfo } from "@/lib/session-context";

const NAV = [
  { href: "/admin", label: "Richieste", exact: true },
  { href: "/admin/impostazioni", label: "Impostazioni", exact: false },
  { href: "/admin/utenti", label: "Utenti", exact: false, adminOnly: true },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<SessionInfo | null>(null);

  useEffect(() => {
    // Legge le info utente dal cookie di sessione via endpoint leggero
    fetch("/api/auth/me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setSession(data); })
      .catch(() => {});
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
  };

  if (pathname === "/admin/login") return <>{children}</>;

  const isAdmin = session?.ruolo === "ADMIN";

  return (
    <SessionContext.Provider value={session}>
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-100 bg-white px-6 py-3">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-gray-900 text-sm">🚗 Magnus SRL</span>
            <nav className="flex gap-1">
              {NAV.filter((item) => !item.adminOnly || isAdmin).map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                      active
                        ? "bg-gray-100 font-medium text-gray-900"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {session && (
              <span className="text-xs text-gray-500">
                {session.ruolo === "ADMIN" ? "🛡️" : "👤"} {session.nome}
              </span>
            )}
            <button
              onClick={logout}
              className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              Esci
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
    </div>
    </SessionContext.Provider>
  );
}
