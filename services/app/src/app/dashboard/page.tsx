"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Server,
  Network,
  Headphones,
  CheckCircle2,
  Wifi,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";
import { useBrand } from "@/context/brand-context";
import { getMikrotikNodes } from "@/actions/nodes";
import { getContracts } from "@/actions/contracts";
import { getClients } from "@/actions/clients";
import { getSupportTickets } from "@/actions/tickets";
import type { MikrotikNode, Contract } from "@/types";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function MainDashboardPage() {
  const { activeBrandId, activeBrand } = useBrand();

  const [nodes, setNodes] = useState<MikrotikNode[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [totalClients, setTotalClients] = useState<number>(0);
  const [totalContracts, setTotalContracts] = useState<number>(0);
  const [pendingTickets, setPendingTickets] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  const loadKpis = useCallback(async () => {
    setLoading(true);
    try {
      const [nodesRes, contractsRes, clientsRes, ticketsRes] = await Promise.all([
        getMikrotikNodes(activeBrandId),
        getContracts({ brandId: activeBrandId, pageSize: 5 }),
        getClients({ brandId: activeBrandId, pageSize: 1 }),
        getSupportTickets({
          brandId: activeBrandId,
          status: "TRANSFERIDO_HUMANO",
          pageSize: 1,
        }),
      ]);

      if (nodesRes.success && nodesRes.data) {
        setNodes(nodesRes.data);
      }

      if (contractsRes.success && contractsRes.data) {
        setContracts(contractsRes.data.items);
        setTotalContracts(contractsRes.data.total);
      }

      if (clientsRes.success && clientsRes.data) {
        setTotalClients(clientsRes.data.total);
      }

      if (ticketsRes.success && ticketsRes.data) {
        setPendingTickets(ticketsRes.data.total);
      }
    } catch (_err) {
      toast.error("Error al cargar telemetría del dashboard.");
    } finally {
      setLoading(false);
    }
  }, [activeBrandId]);

  useEffect(() => {
    loadKpis();
  }, [loadKpis]);

  const totalActivePppSessions = nodes.reduce((acc, n) => acc + (n.activeSessions || 0), 0);
  const onlineNodesCount = nodes.filter((n) => n.status === "ONLINE").length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
            NOC & Centro de Operaciones ISP
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            {activeBrand ? activeBrand.name : "Todas las Marcas (Global NOC)"} — Monitor de routers, enlaces y abonados.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadKpis}
            disabled={loading}
            className="rounded-xl gap-2 text-xs font-semibold"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Actualizar NOC
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Nodos MikroTik */}
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-500">Nodos MikroTik</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Server className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-zinc-900 dark:text-white">
              {onlineNodesCount} / {nodes.length}
            </div>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> {onlineNodesCount} routers online
            </p>
          </div>
        </div>

        {/* Sesiones PPPoE Activas */}
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-500">Sesiones PPPoE Activas</span>
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Wifi className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-zinc-900 dark:text-white">
              {totalActivePppSessions}
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              En tiempo real en los routers
            </p>
          </div>
        </div>

        {/* Total Contratos */}
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-500">Abonados & Contratos</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Network className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-zinc-900 dark:text-white">
              {totalContracts}
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {totalClients} titulares registrados
            </p>
          </div>
        </div>

        {/* Casos IA Traspaso */}
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-500">Traspasos IA Pendientes</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Headphones className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {pendingTickets}
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Casos escalados para asesor humano
            </p>
          </div>
        </div>
      </div>

      {/* Nodes Health Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Server className="h-4 w-4 text-emerald-500" />
            Estado de Nodos MikroTik en Vivo
          </h2>
          <Link
            href="/dashboard/nodes"
            className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
          >
            Ver todos los nodos <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {nodes.map((node) => (
            <div
              key={node.id}
              className="p-4 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                  {node.code}
                </span>

                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-extrabold",
                    node.status === "ONLINE"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-rose-500/10 text-rose-600"
                  )}
                >
                  {node.status}
                </span>
              </div>

              <div>
                <h3 className="font-bold text-sm text-zinc-900 dark:text-white truncate">
                  {node.name}
                </h3>
                <p className="text-xs text-zinc-500 font-mono mt-0.5">
                  {node.host}:{node.port}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <div>
                  <span className="text-[11px] text-zinc-400">Abonados Activos:</span>
                  <p className="font-bold text-zinc-800 dark:text-zinc-200">
                    {node.activeSessions}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-zinc-400">Latencia API:</span>
                  <p className="font-bold text-zinc-800 dark:text-zinc-200">
                    {node.latencyMs ? `${node.latencyMs} ms` : "N/D"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Contracts Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Network className="h-4 w-4 text-emerald-500" />
            Últimos Contratos & Enlaces de Servicio
          </h2>
          <Link
            href="/dashboard/contracts"
            className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
          >
            Ver todos los contratos <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-950/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 font-extrabold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Contrato #</th>
                <th className="px-4 py-3">Titular</th>
                <th className="px-4 py-3">Nodo Router</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3 text-center">Cartera</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/70 dark:divide-zinc-800/80">
              {contracts.slice(0, 5).map((c) => (
                <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <td className="px-4 py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    #{c.contractNumber}
                  </td>
                  <td className="px-4 py-3 font-bold text-zinc-800 dark:text-zinc-200">
                    {c.client?.fullName}
                  </td>
                  <td className="px-4 py-3 font-mono text-zinc-500 text-[11px]">
                    {c.node?.name}
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    {c.plan?.name}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-extrabold",
                        c.billingStatus === "ACTIVO"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-rose-500/10 text-rose-600"
                      )}
                    >
                      {c.billingStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
