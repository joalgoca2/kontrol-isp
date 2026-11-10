"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { requestPasswordReset } from "@/actions/auth";
import { emailSchema } from "@/lib/validations/common";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const forgotSchema = z.object({ email: emailSchema });
type ForgotInput = z.infer<typeof forgotSchema>;

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotInput>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: ForgotInput) => {
    setIsLoading(true);
    try {
      const res = await requestPasswordReset(data.email);
      if (res.success) {
        setIsSubmitted(true);
        toast.success(t("common.success", "Correo de recuperación enviado."));
      } else {
        toast.error(res.error ?? t("common.error", "No se pudo procesar la solicitud."));
      }
    } catch (_error: unknown) {
      toast.error(t("common.error", "Ocurrió un error inesperado."));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full space-y-4">
      <Card
        className="border-zinc-200 bg-white/90 dark:border-zinc-800
                   dark:bg-zinc-900/50 backdrop-blur shadow-sm rounded-2xl"
      >
        <CardHeader className="space-y-1 text-center">
          <CardTitle
            className="text-xl sm:text-2xl font-black tracking-tight
                       text-zinc-900 dark:text-white"
          >
            {t("auth.forgotTitle", "Recuperar Acceso")}
          </CardTitle>
          <CardDescription className="text-xs text-zinc-600 dark:text-zinc-400">
            {t(
              "auth.forgotSubtitle",
              "Ingresa tu correo de operador para recibir instrucciones."
            )}
          </CardDescription>
        </CardHeader>

        {isSubmitted ? (
          <CardContent className="space-y-4 text-center py-6">
            <div
              className="mx-auto flex h-12 w-12 items-center justify-center
                         rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            >
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                {t("auth.emailSentTitle", "¡Instrucciones enviadas!")}
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                {t(
                  "auth.emailSentDesc",
                  "Si el correo existe, habrás recibido un enlace de recuperación."
                )}
              </p>
            </div>
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-4 pt-0">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold">
                  {t("auth.email", "Correo Electrónico")}
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder={t("auth.emailPlaceholder", "usuario@isp.com")}
                    disabled={isLoading}
                    className="pl-9 h-10 text-xs rounded-xl"
                    {...register("email")}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-rose-500 font-medium">
                    {errors.email.message}
                  </p>
                )}
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3 pt-0">
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700
                           text-white font-bold text-xs"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span>{t("common.sending", "Enviando enlace...")}</span>
                  </>
                ) : (
                  <span>{t("auth.sendLink", "Enviar Enlace de Recuperación")}</span>
                )}
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>

      <div className="text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-xs font-semibold
                     text-zinc-500 hover:text-zinc-800 dark:text-zinc-400
                     dark:hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{t("auth.backToLogin", "Volver al inicio de sesión")}</span>
        </Link>
      </div>
    </div>
  );
}
