"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import {
  Lock,
  Mail,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
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

export default function LoginPage() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);
    try {
      const res = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (res?.error) {
        toast.error(
          t(
            "auth.invalidCredentials",
            "Credenciales inválidas. Verifica tu correo y contraseña."
          )
        );
      } else {
        toast.success(t("toasts.loginSuccess", "¡Sesión iniciada con éxito!"));
        window.location.href = "/dashboard";
      }
    } catch (_error: unknown) {
      toast.error(
        t("toasts.errorOccurred", "Ocurrió un error inesperado al iniciar sesión.")
      );
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
            {t("auth.loginTitle", "Acceso al Panel NOC")}
          </CardTitle>
          <CardDescription className="text-xs text-zinc-600 dark:text-zinc-400">
            {t(
              "auth.loginSubtitle",
              "Ingresa tus credenciales para administrar nodos MikroTik, contratos y facturación."
            )}
          </CardDescription>
        </CardHeader>

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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold">
                  {t("auth.password", "Contraseña")}
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-emerald-600 hover:text-emerald-500
                             dark:text-emerald-400 dark:hover:text-emerald-300 font-semibold"
                >
                  {t("auth.forgotPassword", "¿Olvidaste tu contraseña?")}
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t("auth.passwordPlaceholder", "••••••••")}
                  disabled={isLoading}
                  className="pl-9 pr-9 h-10 text-xs rounded-xl"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-zinc-400
                             hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-rose-500 font-medium">
                  {errors.password.message}
                </p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pt-0">
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700
                         text-white font-bold text-xs gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t("common.verifying", "Verificando...")}</span>
                </>
              ) : (
                <>
                  <span>{t("auth.signIn", "Ingresar al Panel")}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>

            <div className="w-full text-center">
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {t(
                  "auth.b2bNotice",
                  "Las cuentas de operador y administrador son gestionadas por el ISP."
                )}
              </p>
            </div>
          </CardFooter>
        </form>
      </Card>

      <div className="text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold
                     text-zinc-500 hover:text-zinc-800 dark:text-zinc-400
                     dark:hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{t("common.backHome", "Volver al Inicio")}</span>
        </Link>
      </div>
    </div>
  );
}
