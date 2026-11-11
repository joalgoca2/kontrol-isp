"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import { Search, X, User, Phone, Mail, MapPin, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Client } from "@/types";

interface ClientSearchSelectorProps {
  clients?: Client[];
  selectedClient?: Client | null;
  selectedClientId?: string;
  onSelect: (client: Client | null) => void;
  onSearchServer?: (query: string) => Promise<Client[]>;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function ClientSearchSelector({
  clients = [],
  selectedClient: controlledSelectedClient,
  selectedClientId,
  onSelect,
  onSearchServer,
  label = "Titular / Abonado",
  placeholder = "Buscar por nombre, cédula o código...",
  required = false,
  disabled = false,
  className,
}: ClientSearchSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [serverResults, setServerResults] = useState<Client[]>([]);
  const [isPending, startTransition] = useTransition();

  const selectedClient = useMemo(() => {
    if (controlledSelectedClient !== undefined) {
      return controlledSelectedClient;
    }
    if (!selectedClientId) return null;
    const foundLocal = clients.find((c) => c.id === selectedClientId);
    if (foundLocal) return foundLocal;
    return serverResults.find((c) => c.id === selectedClientId) ?? null;
  }, [controlledSelectedClient, selectedClientId, clients, serverResults]);

  useEffect(() => {
    if (!onSearchServer) return;
    const q = searchTerm.trim();
    if (!q) {
      setServerResults([]);
      return;
    }

    const timer = setTimeout(() => {
      startTransition(async () => {
        try {
          const results = await onSearchServer(q);
          setServerResults(results);
        } catch (_err) {
          setServerResults([]);
        }
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm, onSearchServer]);

  const displayedList = useMemo(() => {
    if (onSearchServer) {
      if (serverResults.length > 0) return serverResults;
      if (!searchTerm.trim()) return clients.slice(0, 8);
      return [];
    }

    const q = searchTerm.trim().toLowerCase();
    if (!q) return clients.slice(0, 8);

    return clients
      .filter((c) => {
        const name = c.fullName?.toLowerCase() ?? "";
        const doc = c.documentNumber?.toLowerCase() ?? "";
        const code = c.clientCode?.toLowerCase() ?? "";
        const phone = c.phonePrimary?.toLowerCase() ?? "";
        return (
          name.includes(q) ||
          doc.includes(q) ||
          code.includes(q) ||
          phone.includes(q)
        );
      })
      .slice(0, 8);
  }, [clients, searchTerm, serverResults, onSearchServer]);

  const handleSelect = (client: Client) => {
    onSelect(client);
    setSearchTerm("");
    setServerResults([]);
  };

  const handleClear = () => {
    onSelect(null);
    setSearchTerm("");
    setServerResults([]);
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
        {selectedClient && (
          <span
            className={cn(
              "text-[11px] font-semibold",
              "text-emerald-600 dark:text-emerald-400"
            )}
          >
            Titular seleccionado
          </span>
        )}
      </div>

      {selectedClient ? (
        /* Selected Client Card */
        <div
          className={cn(
            "p-3.5 rounded-2xl border transition-all duration-200",
            "bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent",
            "dark:from-emerald-950/30 dark:via-emerald-950/15 dark:to-transparent",
            "border-emerald-500/30 dark:border-emerald-500/25 shadow-xs space-y-2.5"
          )}
        >
          {/* Row 1: Identity & Clear Button */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={cn(
                  "h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
                  "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
                  "border border-emerald-500/30 shadow-xs"
                )}
              >
                <User className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-extrabold text-xs text-zinc-900 dark:text-white truncate">
                    {selectedClient.fullName}
                  </span>
                  {selectedClient.clientCode && (
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[10px] py-0 px-1.5 font-mono font-bold",
                        "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                        "border border-emerald-500/30"
                      )}
                    >
                      ID: #{selectedClient.clientCode}
                    </Badge>
                  )}
                  {selectedClient.documentNumber && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] py-0 px-1.5 font-mono",
                        "text-zinc-600 dark:text-zinc-400"
                      )}
                    >
                      {selectedClient.documentType}: {selectedClient.documentNumber}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={handleClear}
              className={cn(
                "h-7 text-xs font-semibold rounded-lg px-2.5 shrink-0 transition-colors",
                "text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400",
                "hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20"
              )}
              title="Cambiar o buscar otro titular"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Cambiar
            </Button>
          </div>

          {/* Row 2: Contact Pills */}
          <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
            {selectedClient.phonePrimary && (
              <span
                className={cn(
                  "px-2 py-0.5 rounded-lg font-mono font-medium flex items-center gap-1",
                  "bg-white/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300",
                  "border border-zinc-200 dark:border-zinc-700"
                )}
              >
                <Phone className="h-3 w-3 text-emerald-600" />
                {selectedClient.phonePrimary}
              </span>
            )}
            {selectedClient.email && (
              <span
                className={cn(
                  "px-2 py-0.5 rounded-lg font-medium flex items-center gap-1",
                  "bg-white/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300",
                  "border border-zinc-200 dark:border-zinc-700 truncate max-w-[220px]"
                )}
                title={selectedClient.email}
              >
                <Mail className="h-3 w-3 text-cyan-600" />
                <span className="truncate">{selectedClient.email}</span>
              </span>
            )}
            <Badge
              variant={selectedClient.isActive ? "default" : "secondary"}
              className="text-[10px] py-0 px-1.5"
            >
              {selectedClient.isActive ? "Activo" : "Inactivo"}
            </Badge>
          </div>

          {/* Row 3: Physical Address */}
          {selectedClient.address && (
            <div
              className={cn(
                "flex items-center gap-1.5 text-[11px]",
                "text-zinc-500 dark:text-zinc-400 pt-0.5",
                "border-t border-emerald-500/15"
              )}
            >
              <MapPin className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="truncate" title={selectedClient.address}>
                {selectedClient.address}
                {selectedClient.city ? ` (${selectedClient.city})` : ""}
              </span>
            </div>
          )}
        </div>
      ) : (
        /* Search Box & Results List */
        <div className="space-y-1.5">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-zinc-400 absolute left-3 top-2.5" />
            <Input
              value={searchTerm}
              disabled={disabled}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={placeholder}
              className="h-8.5 pl-8 pr-7 rounded-xl text-xs"
            />
            {isPending ? (
              <Loader2
                className="h-3.5 w-3.5 text-zinc-400 absolute right-2.5 top-2.5 animate-spin"
              />
            ) : searchTerm ? (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setServerResults([]);
                }}
                className={cn(
                  "absolute right-2.5 top-2 text-zinc-400",
                  "hover:text-zinc-600 cursor-pointer"
                )}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          {/* Interactive Results List */}
          <div
            className={cn(
              "border border-zinc-200 dark:border-zinc-800 rounded-xl",
              "max-h-48 overflow-y-auto divide-y divide-zinc-100",
              "dark:divide-zinc-800 bg-white dark:bg-zinc-900 shadow-sm"
            )}
          >
            {displayedList.length === 0 ? (
              <div className="p-3 text-center text-xs text-zinc-400">
                {isPending
                  ? "Buscando titulares..."
                  : "No se encontraron titulares coincidentes."}
              </div>
            ) : (
              displayedList.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelect(c)}
                  className={cn(
                    "w-full text-left p-2.5 hover:bg-emerald-50/70",
                    "dark:hover:bg-emerald-950/20 transition-colors cursor-pointer",
                    "flex items-center justify-between gap-2 text-xs"
                  )}
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-zinc-800 dark:text-zinc-100 truncate">
                        {c.fullName}
                      </span>
                      {c.clientCode && (
                        <span className="font-mono text-[10px] text-emerald-600 font-semibold">
                          #{c.clientCode}
                        </span>
                      )}
                      {c.documentNumber && (
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {c.documentType}: {c.documentNumber}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-500 truncate flex items-center gap-1.5">
                      <span className="font-mono">{c.phonePrimary}</span>
                      {c.address && (
                        <>
                          <span>&bull;</span>
                          <span className="truncate">{c.address}</span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
