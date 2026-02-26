import { getSessionFromCookies } from "@/lib/auth";
import { redirect } from "next/navigation";
import Card, { CardBody, CardHeader } from "@/components/ui/Card";
import ProfiloForm from "@/components/admin/ProfiloForm";

export const dynamic = "force-dynamic";

export default async function ProfiloPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/admin/login");

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Il mio profilo</h1>

      {/* Info utente */}
      <Card>
        <CardBody>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Nome</span>
              <span className="text-sm font-medium text-gray-800">{session.nome}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Email</span>
              <span className="text-sm font-medium text-gray-800">{session.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Ruolo</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                session.ruolo === "ADMIN"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600"
              }`}>
                {session.ruolo === "ADMIN" ? "🛡️ Admin" : "👤 Commerciale"}
              </span>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Cambio password */}
      <Card>
        <CardHeader>
          <span className="text-sm font-medium text-gray-700">🔐 Cambia password</span>
        </CardHeader>
        <CardBody>
          <ProfiloForm />
        </CardBody>
      </Card>
    </div>
  );
}
