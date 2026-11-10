"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AiChatRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/whatsapp-chat");
  }, [router]);

  return (
    <div className="p-12 text-center text-xs text-zinc-400">
      Redirigiendo a la nueva Bandeja de WhatsApp Web...
    </div>
  );
}
