"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, ShieldCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function PaymentResultContent() {
  const searchParams = useSearchParams();
  const refPayco = searchParams.get("ref_payco");

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
          "space-y-5 shadow-md"
        )}
      >
        <div
          className={cn(
            "h-16 w-16 rounded-2xl bg-emerald-500/10 text-emerald-600",
            "dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center",
            "justify-center mx-auto"
          )}
        >
          <CheckCircle2 className="h-10 w-10" />
        </div>

        <div className="space-y-1">
          <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            ¡Transacción Finalizada!
          </h1>
          <p className="text-xs text-zinc-500">
            Tu pago ha sido procesado por la pasarela de pagos. Tu servicio de
            internet se actualizará y reactivará automáticamente.
          </p>
        </div>

        {refPayco && (
          <div
            className={cn(
              "p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border",
              "border-zinc-200 dark:border-zinc-700 text-xs text-left",
              "space-y-1"
            )}
          >
            <span className="text-2xs text-zinc-400 block">
              Referencia de Pago DaviPay / ePayco:
            </span>
            <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
              {refPayco}
            </span>
          </div>
        )}

        <div className="flex items-center justify-center gap-2 text-2xs text-zinc-400">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>Comprobante registrado y auditado por Kontrol ISP</span>
        </div>

        <div className="pt-2">
          <Button
            asChild
            className={cn(
              "w-full rounded-xl text-xs font-semibold gap-2",
              "bg-emerald-600 hover:bg-emerald-700 text-white"
            )}
          >
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              Finalizar y Salir
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentResultPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-6">
          <div
            className={cn(
              "h-8 w-8 border-4 border-emerald-500",
              "border-t-transparent rounded-full animate-spin"
            )}
          />
        </div>
      }
    >
      <PaymentResultContent />
    </Suspense>
  );
}
