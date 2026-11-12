import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { getPublicContractPaymentInfo } from "@/actions/portal";
import { PortalClient } from "./portal-client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function PaymentPortalPage({ params }: PageProps) {
  const { token } = await params;
  if (!token) {
    notFound();
  }

  const res = await getPublicContractPaymentInfo(token);

  if (!res.success || !res.data) {
    return (
      <div
        className={cn(
          "min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col",
          "items-center justify-center p-6 text-center"
        )}
      >
        <div
          className={cn(
            "max-w-md w-full bg-white dark:bg-zinc-900 border",
            "border-zinc-200 dark:border-zinc-800 rounded-3xl p-8",
            "space-y-4 shadow-xs"
          )}
        >
          <div
            className={cn(
              "h-12 w-12 rounded-2xl bg-rose-500/10 text-rose-600",
              "flex items-center justify-center mx-auto"
            )}
          >
            <AlertCircle className="h-6 w-6" />
          </div>
          <h1 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            Enlace de Pago No Disponible
          </h1>
          <p className="text-xs text-zinc-500">
            {res.error ||
              "El enlace de pago no es válido o ha expirado. Por favor, " +
                "solicita uno nuevo a tu proveedor de internet."}
          </p>
          <div className="pt-2">
            <Button
              asChild
              variant="outline"
              className="rounded-xl text-xs"
            >
              <Link href="/">Volver al Inicio</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <PortalClient initialData={res.data} token={token} />;
}

