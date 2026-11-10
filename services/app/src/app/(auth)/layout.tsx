import Link from "next/link";
import { Wifi } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        "relative flex min-h-screen flex-col items-center justify-center " +
        "p-4 sm:p-6 bg-gradient-to-b from-zinc-100 via-white to-zinc-100 " +
        "dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 " +
        "transition-colors duration-200"
      }
    >
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <Link href="/" className="flex items-center gap-3 group">
          <div
            className={
              "flex h-11 w-11 items-center justify-center rounded-2xl " +
              "bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 " +
              "dark:text-emerald-400 shadow-xs transition-transform duration-300 " +
              "group-hover:scale-105"
            }
          >
            <Wifi className="h-6 w-6" />
          </div>
          <div className="flex flex-col text-left">
            <span
              className="text-xl font-black text-zinc-900 dark:text-white
                         tracking-tight leading-none"
            >
              Kontrol ISP
            </span>
            <span
              className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400
                         uppercase tracking-widest mt-0.5"
            >
              CRM & Multi-Nodo NOC
            </span>
          </div>
        </Link>
      </div>

      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
