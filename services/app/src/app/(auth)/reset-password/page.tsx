"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Lock, ArrowRight, ArrowLeft, Loader2, KeyRound } from "lucide-react";
import { resetPassword } from "@/actions/auth";
import { passwordSchema } from "@/lib/validations/common";
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

const resetSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirma tu contraseña."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });

type ResetInput = z.infer<typeof resetSchema>;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetInput>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = async (data: ResetInput) => {
    if (!token) {
      toast.error(t("auth.invalidTokenDesc", "Token de recuperación no válido o ausente."));
      return;
    }

    setIsLoading(true);
    try {
      const res = await resetPassword(token, data.password);
      if (res.success) {
        toast.success(t("common.success", "¡Contraseña restablecida con éxito!"));
        router.push("/login");
      } else {
        toast.error(res.error ?? t("common.error", "No se pudo restablecer la contraseña."));
      }
    } catch (_error: unknown) {
      toast.error(t("common.error", "Ocurrió un error inesperado."));
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center space-y-4 py-4">
        <KeyRound className="mx-auto h-12 w-12 text-rose-400" />
        <h4 className="font-semibold text-zinc-900 dark:text-white">
          {t("auth.invalidToken", "Enlace Inválido")}
        </h4>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          {t(
            "auth.invalidTokenDesc",
            "No se encontró un token válido en la dirección de enlace."
          )}
        </p>
        <Link href="/forgot-password">
          <Button variant="outline" size="sm" className="mt-2">
            {t("auth.requestNewLink", "Solicitar nuevo enlace")}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">{t("auth.newPassword", "Nueva Contraseña")}</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <Input
            id="password"
            type="password"
            placeholder="Mínimo 8 caracteres"
            className="pl-9"
            error={Boolean(errors.password)}
            {...register("password")}
          />
        </div>
        {errors.password && (
          <p className="text-xs text-rose-500">{t(errors.password.message ?? "")}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">
          {t("auth.confirmPassword", "Confirmar Contraseña")}
        </Label>
        <div className="relative">
          <Lock className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <Input
            id="confirmPassword"
            type="password"
            placeholder="Repite la contraseña"
            className="pl-9"
            error={Boolean(errors.confirmPassword)}
            {...register("confirmPassword")}
          />
        </div>
        {errors.confirmPassword && (
          <p className="text-xs text-rose-500">
            {t(errors.confirmPassword.message ?? "")}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full gap-2 font-bold" disabled={isLoading}>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <span>{t("auth.updatePassword", "Actualizar Contraseña")}</span>
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  const { t } = useTranslation();

  return (
    <div className="w-full space-y-4">
      {/* Top Header Controls: Back link */}
      <div className="flex items-center justify-start">
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-2 text-xs">
            <ArrowLeft className="h-4 w-4" />
            <span>{t("common.backHome", "Volver al Inicio")}</span>
          </Button>
        </Link>
      </div>

      <Card
        className="border-zinc-200 bg-white/90 dark:border-zinc-800
                   dark:bg-zinc-900/70 backdrop-blur shadow-xl"
      >
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">
            {t("auth.resetTitle", "Nueva Contraseña")}
          </CardTitle>
          <CardDescription>
            {t("auth.resetSubtitle", "Ingresa y confirma tu nueva clave de acceso")}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Suspense
            fallback={
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
              </div>
            }
          >
            <ResetPasswordForm />
          </Suspense>
        </CardContent>

        <CardFooter className="flex justify-center border-t border-zinc-200 dark:border-zinc-800/80 pt-4">
          <Link
            href="/login"
            className="text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          >
            {t("auth.backToLogin", "Volver al inicio de sesión")}
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
