"use client";

import { createContext, useContext } from "react";

export interface SessionInfo {
  nome: string;
  email: string;
  ruolo: "ADMIN" | "COMMERCIALE";
}

export const SessionContext = createContext<SessionInfo | null>(null);

export function useSession() {
  return useContext(SessionContext);
}

export function useIsAdmin() {
  const session = useContext(SessionContext);
  return session?.ruolo === "ADMIN";
}
