"use client";

import { useState, useRef, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Play,
  RotateCcw,
  Search,
  Scale,
} from "lucide-react";
import { useBrand } from "@/context/brand-context";
import { useTranslation } from "@/components/providers/i18n-provider";
import {
  previewReconciliationFileAction,
  applyReconciliationBatchAction,
} from "@/actions/billing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { ReconciliationPreviewResult } from "@/lib/payments/reconciliation";

export default function ReconciliationPage() {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Brand context & Global mode verification
  const { activeBrandId, activeBrand, isSuperAdmin } = useBrand();
  const isGlobalMode =
    isSuperAdmin && (activeBrandId === "ALL" || !activeBrand);
  const effectiveBrandId =
    !isGlobalMode && activeBrand ? activeBrand.id : undefined;

  const [provider, setProvider] = useState<"EFECTY" | "DAVIPAY">("EFECTY");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [preview, setPreview] = useState<ReconciliationPreviewResult | null>(
    null
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setPreview(null);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      toast.error(
        t("reconciliation.selectFilePrompt", "Por favor selecciona un archivo.")
      );
      return;
    }

    if (!effectiveBrandId) {
      toast.error(
        t("reconciliation.selectBrandPrompt", "Selecciona una marca válida.")
      );
      return;
    }

    setAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("brandId", effectiveBrandId);
      formData.append("provider", provider);

      const res = await previewReconciliationFileAction(formData);
      if (res.success && res.data) {
        setPreview(res.data);
        toast.success(
          t(
            "reconciliation.analyzeSuccess",
            "Archivo analizado exitosamente. Revisa los resultados antes de aplicar."
          )
        );
      } else {
        toast.error(res.error || "Error al analizar archivo.");
      }
    } catch {
      toast.error("Error al procesar el archivo.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApply = async () => {
    if (!preview || !effectiveBrandId) return;

    const itemsToApply = preview.items.filter(
      (item) => item.matchStatus === "READY_TO_APPLY"
    );

    if (itemsToApply.length === 0) {
      toast.error(
        t(
          "reconciliation.noItemsToApply",
          "No hay pagos nuevos válidos para aplicar."
        )
      );
      return;
    }

    setApplying(true);
    try {
      const res = await applyReconciliationBatchAction(
        effectiveBrandId,
        itemsToApply,
        provider
      );

      if (res.success && res.data) {
        const count = res.data.appliedCount;
        const msg =
          `${t("reconciliation.appliedPrefix", "Se aplicaron")} ${count} ` +
          t("reconciliation.appliedSuffix", "pagos nuevos sin duplicidad.");
        toast.success(msg);
        handleReset();
      } else {
        toast.error(res.error || "Error al aplicar el lote.");
      }
    } catch {
      toast.error("Error al guardar recaudos en el sistema.");
    } finally {
      setApplying(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreview(null);
    setSearchQuery("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const filteredItems = useMemo(() => {
    if (!preview) return [];
    if (!searchQuery.trim()) return preview.items;
    const query = searchQuery.toLowerCase();
    return preview.items.filter(
      (i) =>
        i.reference.toLowerCase().includes(query) ||
        i.externalTxId.toLowerCase().includes(query) ||
        (i.clientName && i.clientName.toLowerCase().includes(query)) ||
        (i.contractNumber && i.contractNumber.toLowerCase().includes(query))
    );
  }, [preview, searchQuery]);

  return (
    <div className="space-y-6">
      {/* HEADER & NAVIGATION */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/dashboard/billing"
              className={
                "inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 " +
                "hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              }
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>{t("common.backDashboard", "Volver a Facturación")}</span>
            </Link>
          </div>
          <h1
            className={
              "text-2xl font-black text-zinc-900 dark:text-zinc-100 " +
              "flex items-center gap-2.5 tracking-tight"
            }
          >
            <Scale className="h-6 w-6 text-emerald-500 shrink-0" />
            {t("reconciliation.modalTitle", "Conciliación de Pagos")}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {t(
              "reconciliation.modalDesc",
              "Sube archivos diarios CSV o TXT. El sistema cruzará las transacciones " +
                "con webhooks para evitar doble contabilidad."
            )}
          </p>
        </div>

        {activeBrand && !isGlobalMode && (
          <Badge
            variant="outline"
            className={
              "self-start sm:self-center border-zinc-200 " +
              "dark:border-zinc-800 text-xs px-3 py-1"
            }
          >
            {activeBrand.name}
          </Badge>
        )}
      </div>

      {/* GLOBAL MODE WARNING BANNER */}
      {isGlobalMode || !effectiveBrandId ? (
        <Card
          className={
            "border-zinc-200 bg-white/90 dark:border-zinc-800 dark:bg-zinc-900/60 " +
            "backdrop-blur rounded-3xl shadow-sm overflow-hidden p-6"
          }
        >
          <div
            className={
              "p-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 " +
              "text-amber-950 dark:text-amber-200 flex flex-col sm:flex-row " +
              "items-start sm:items-center justify-between gap-4"
            }
          >
            <div className="flex items-start gap-3">
              <div
                className={
                  "h-9 w-9 rounded-xl bg-amber-500/20 text-amber-600 " +
                  "dark:text-amber-400 flex items-center justify-center shrink-0 font-bold"
                }
              >
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider">
                  {t(
                    "reconciliation.globalNoticeTitle",
                    "Conciliación no disponible en vista Global"
                  )}
                </h4>
                <p className="text-xs mt-0.5 text-amber-900 dark:text-amber-300">
                  {t(
                    "reconciliation.globalNoticeDesc",
                    "La conciliación bancaria y el procesamiento de archivos operan " +
                      "de forma aislada por empresa. Selecciona una marca específica " +
                      "en el selector del menú lateral para gestionar la conciliación."
                  )}
                </p>
              </div>
            </div>
            <Badge
              variant="outline"
              className={
                "border-amber-500/40 text-amber-700 dark:text-amber-300 " +
                "text-[11px] shrink-0 font-bold"
              }
            >
              {t(
                "settings.whatsappGlobalBadge",
                "Requiere seleccionar marca en el menú"
              )}
            </Badge>
          </div>
        </Card>
      ) : (
        /* CONCILIATION CONSOLE */
        <div className="space-y-6">
          {!preview ? (
            <Card
              className={
                "border-zinc-200 bg-white/90 dark:border-zinc-800 dark:bg-zinc-900/60 " +
                "backdrop-blur rounded-3xl shadow-sm overflow-hidden"
              }
            >
              <CardHeader className="p-6 border-b border-zinc-100 dark:border-zinc-800/60">
                <CardTitle
                  className={
                    "text-base font-bold text-zinc-900 dark:text-zinc-100 " +
                    "flex items-center gap-2"
                  }
                >
                  <UploadCloud className="h-5 w-5 text-emerald-500" />
                  {t(
                    "reconciliation.uploadTitle",
                    "Carga de Archivo de Recaudo"
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">
                    {t("reconciliation.providerLabel", "Plataforma de Origen")}
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setProvider("EFECTY")}
                      className={
                        "p-4 rounded-2xl border text-left transition-all " +
                        (provider === "EFECTY"
                          ? "border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/20"
                          : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900")
                      }
                    >
                      <span className="text-xs font-bold block text-zinc-900 dark:text-zinc-100">
                        Efecty Colombia
                      </span>
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block mt-0.5">
                        Archivos planos de taquilla (.txt, .csv)
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setProvider("DAVIPAY")}
                      className={
                        "p-4 rounded-2xl border text-left transition-all " +
                        (provider === "DAVIPAY"
                          ? "border-red-500 bg-red-500/10 ring-2 ring-red-500/20"
                          : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900")
                      }
                    >
                      <span className="text-xs font-bold block text-zinc-900 dark:text-zinc-100">
                        DaviPay / ePayco
                      </span>
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block mt-0.5">
                        Liquidaciones PSE y Tarjetas (.csv)
                      </span>
                    </button>
                  </div>
                </div>

                {/* DRAG & DROP ZONE */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={
                    "border-2 border-dashed rounded-3xl p-10 text-center cursor-pointer " +
                    "transition-all duration-200 hover:border-emerald-500/60 " +
                    (selectedFile
                      ? "border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10"
                      : "border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/30")
                  }
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center gap-3">
                    <div
                      className={
                        "p-3.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 " +
                        "text-zinc-600 dark:text-zinc-300"
                      }
                    >
                      <FileText className="h-7 w-7" />
                    </div>
                    {selectedFile ? (
                      <div>
                        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          {selectedFile.name}
                        </p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {(selectedFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          {t(
                            "reconciliation.dragPrompt",
                            "Haz clic o arrastra aquí el archivo de recaudo"
                          )}
                        </p>
                        <p className="text-xs text-zinc-500 mt-1">
                          Formatos soportados: .TXT plano o .CSV delimitado
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    onClick={handleAnalyze}
                    disabled={analyzing || !selectedFile}
                    className={
                      "bg-emerald-600 hover:bg-emerald-700 text-white font-bold " +
                      "text-xs h-10 px-6 rounded-xl gap-2 shadow-sm"
                    }
                  >
                    {analyzing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    {t("reconciliation.analyzeBtn", "Analizar y Previsualizar")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* PREVIEW DASHBOARD */
            <div className="space-y-6">
              {/* METRIC SUMMARY CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <Card
                  className={
                    "border-zinc-200 dark:border-zinc-800 " +
                    "bg-white/90 dark:bg-zinc-900/60 p-4 rounded-2xl"
                  }
                >
                  <span
                    className={
                      "text-[11px] font-bold text-zinc-500 uppercase " +
                      "tracking-wider block"
                    }
                  >
                    Total Transacciones
                  </span>
                  <span
                    className={
                      "text-2xl font-black text-zinc-900 " +
                      "dark:text-zinc-100 mt-1 block"
                    }
                  >
                    {preview.totalRows}
                  </span>
                  <span className="text-[11px] text-zinc-500 mt-0.5 block font-mono">
                    ${preview.totalAmount.toLocaleString("es-CO")} COP
                  </span>
                </Card>

                <Card
                  className={
                    "border-zinc-200 dark:border-zinc-800 " +
                    "bg-zinc-100 dark:bg-zinc-800/80 p-4 rounded-2xl"
                  }
                >
                  <span
                    className={
                      "text-[11px] font-bold text-zinc-500 uppercase " +
                      "tracking-wider block"
                    }
                  >
                    Ya Conciliados (Webhook)
                  </span>
                  <span
                    className={
                      "text-2xl font-black text-zinc-700 " +
                      "dark:text-zinc-200 mt-1 block"
                    }
                  >
                    {preview.alreadyPaidCount}
                  </span>
                  <span className="text-[11px] text-zinc-400 mt-0.5 block">
                    Cero duplicidad contable
                  </span>
                </Card>

                <Card className="border-emerald-500/30 bg-emerald-500/10 p-4 rounded-2xl">
                  <span
                    className={
                      "text-[11px] font-bold text-emerald-700 " +
                      "dark:text-emerald-400 uppercase tracking-wider block"
                    }
                  >
                    Nuevos para Aplicar
                  </span>
                  <span
                    className={
                      "text-2xl font-black text-emerald-600 " +
                      "dark:text-emerald-300 mt-1 block"
                    }
                  >
                    {preview.readyToApplyCount}
                  </span>
                  <span className="text-[11px] text-emerald-600/80 mt-0.5 block">
                    Reactivarán MikroTik
                  </span>
                </Card>

                <Card className="border-rose-500/30 bg-rose-500/10 p-4 rounded-2xl">
                  <span
                    className={
                      "text-[11px] font-bold text-rose-700 " +
                      "dark:text-rose-400 uppercase tracking-wider block"
                    }
                  >
                    No Encontrados / Error
                  </span>
                  <span
                    className={
                      "text-2xl font-black text-rose-600 " +
                      "dark:text-rose-300 mt-1 block"
                    }
                  >
                    {preview.errorCount}
                  </span>
                  <span className="text-[11px] text-rose-600/80 mt-0.5 block">
                    Requieren revisión
                  </span>
                </Card>
              </div>

              {/* TABLE CARD */}
              <Card
                className={
                  "border-zinc-200 bg-white/90 dark:border-zinc-800 dark:bg-zinc-900/60 " +
                  "backdrop-blur rounded-3xl shadow-sm overflow-hidden"
                }
              >
                <CardHeader
                  className={
                    "p-5 border-b border-zinc-100 dark:border-zinc-800/60 " +
                    "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  }
                >
                  <CardTitle className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Detalle de Transacciones del Archivo
                  </CardTitle>

                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                    <Input
                      placeholder="Filtrar referencia o titular..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 h-9 text-xs rounded-xl border-zinc-200 dark:border-zinc-800"
                    />
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead
                        className={
                          "bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 font-bold " +
                          "sticky top-0 border-b border-zinc-200 dark:border-zinc-800"
                        }
                      >
                        <tr>
                          <th className="p-3">Referencia</th>
                          <th className="p-3">ID Transacción</th>
                          <th className="p-3">Abonado / Contrato</th>
                          <th className="p-3 text-right">Monto</th>
                          <th className="p-3 text-center">Estado de Cruce</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {filteredItems.map((item, idx) => (
                          <tr
                            key={idx}
                            className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30"
                          >
                            <td className="p-3 font-mono font-medium">
                              {item.reference}
                            </td>
                            <td className="p-3 font-mono text-zinc-500 truncate max-w-[140px]">
                              {item.externalTxId}
                            </td>
                            <td className="p-3 truncate max-w-[200px]">
                              {item.clientName ? (
                                <div>
                                  <span
                                    className={
                                      "font-bold text-zinc-900 dark:text-zinc-100 " +
                                      "block truncate"
                                    }
                                  >
                                    {item.clientName}
                                  </span>
                                  <span className="text-[10px] text-zinc-400 block font-mono">
                                    {item.contractNumber}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-zinc-400 italic">
                                  No identificado
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right font-mono font-bold">
                              ${item.amount.toLocaleString("es-CO")}
                            </td>
                            <td className="p-3 text-center">
                              {item.matchStatus === "ALREADY_PAID" && (
                                <Badge
                                  variant="outline"
                                  className="border-zinc-300 bg-zinc-100 text-zinc-600 text-[10px]"
                                >
                                  Ya Conciliado
                                </Badge>
                              )}
                              {item.matchStatus === "READY_TO_APPLY" && (
                                <Badge
                                  variant="outline"
                                  className={
                                    "border-emerald-500/40 bg-emerald-500/10 " +
                                    "text-emerald-600 text-[10px] font-bold"
                                  }
                                >
                                  Listo para Aplicar
                                </Badge>
                              )}
                              {item.matchStatus === "NOT_FOUND" && (
                                <Badge
                                  variant="outline"
                                  className={
                                    "border-rose-500/40 bg-rose-500/10 " +
                                    "text-rose-600 text-[10px]"
                                  }
                                >
                                  No Encontrado
                                </Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* ACTION BUTTONS */}
              <div className="flex items-center justify-between pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  className="rounded-xl text-xs h-10 px-4 gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {t("reconciliation.loadAnother", "Cargar otro archivo")}
                </Button>

                <Button
                  type="button"
                  onClick={handleApply}
                  disabled={applying || preview.readyToApplyCount === 0}
                  className={
                    "bg-emerald-600 hover:bg-emerald-700 text-white font-bold " +
                    "text-xs h-10 px-6 rounded-xl gap-2 shadow-sm"
                  }
                >
                  {applying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {t("reconciliation.applyBtnPrefix", "Aplicar")} (
                  {preview.readyToApplyCount}){" "}
                  {t("reconciliation.applyBtnSuffix", "Pagos Nuevos")}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
