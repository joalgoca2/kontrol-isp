"use client";

import React from "react";
import { useSession } from "next-auth/react";
import { SidebarProvider } from "@/context/sidebar-context";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { WalkthroughWizard } from "@/components/onboarding/walkthrough-wizard";
import { LockScreen } from "@/components/security/lock-screen";
import { AiChatWidget } from "@/components/ai/ai-chat-widget";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [cachedRoles, setCachedRoles] = React.useState<string[] | undefined>(
    undefined
  );

  React.useEffect(() => {
    if (session?.user?.roles && session.user.roles.length > 0) {
      setCachedRoles(session.user.roles);
    }
  }, [session?.user?.roles]);

  const userRoles = session?.user?.roles?.length
    ? session.user.roles
    : cachedRoles;

  return (
    <SidebarProvider>
      <div
        className={
          "flex h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 " +
          "dark:text-zinc-100 overflow-hidden font-sans transition-colors duration-200"
        }
      >
        <Sidebar userRoles={userRoles} />
        <div className="flex-1 flex flex-col min-w-0 relative z-10">
          <Header />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">{children}</div>
          </main>
        </div>
        <WalkthroughWizard />
        <LockScreen />
        <AiChatWidget />
      </div>
    </SidebarProvider>
  );
}
