"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  Loader2,
  Play,
  RotateCcw,
} from "lucide-react";
import { useTranslation } from "@/components/providers/i18n-provider";
import {
  previewReconciliationFileAction,
  applyReconciliationBatchAction,
} from "@/actions/billing";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import type { ReconciliationPreviewResult } from "@/lib/payments/reconciliation";

interface ReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  brandId?: string;
  onSuccess?: () => void;
}

export function ReconciliationModal({
  isOpen,
  onClose,
  brandId,
  onSuccess,
}: ReconciliationModalProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [provider, setProvider] = useState<"EFECTY" | "DAVIPAY">("EFECTY");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [applying, setApplying] = useState(false);
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

    if (!brandId) {
      toast.error(
        t("reconciliation.selectBrandPrompt", "Selecciona una marca válida.")
      );
      return;
    }

    setAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("brandId", brandId);
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
    if (!preview || !brandId) return;

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
        brandId,
        itemsToApply,
        provider
      );

      if (res.success && res.data) {
        const count = res.data.appliedCount;
        const msg = `${t("reconciliation.appliedPrefix", "Se aplicaron")} ${count} ` +
          t("reconciliation.appliedSuffix", "pagos nuevos sin duplicidad.");
        toast.success(msg);
        onSuccess?.();
        handleReset();
        onClose();
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
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <UploadCloud className="h-5 w-5 text-emerald-500" />
            {t(
              "reconciliation.modalTitle",
              "Conciliación y Carga Masiva de Archivos"
            )}
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400">
            {t(
              "reconciliation.modalDesc",
              "Sube archivos diarios CSV o TXT. El sistema cruzará las transacciones " +
                "con webhooks para evitar doble contabilidad."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* STEP 1: CONFIGURATION & UPLOAD */}
          {!preview && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">
                  {t("reconciliation.providerLabel", "Plataforma de Origen")}
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setProvider("EFECTY")}
                    className={
                      "p-3.5 rounded-2xl border text-left transition-all " +
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
                      "p-3.5 rounded-2xl border text-left transition-all " +
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
                  "border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer " +
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
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={
                      "p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 " +
                      "text-zinc-600 dark:text-zinc-300"
                    }
                  >
                    <FileText className="h-6 w-6" />
                  </div>
                  {selectedFile ? (
                    <div>
                      <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                        {selectedFile.name}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                        {t(
                          "reconciliation.dragPrompt",
                          "Haz clic o arrastra aquí el archivo de recaudo"
                        )}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        Formatos soportados: .TXT plano o .CSV delimitado
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="rounded-xl text-xs h-10 px-4"
                >
                  {t("common.cancel", "Cancelar")}
                </Button>
                <Button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={analyzing || !selectedFile}
                  className={
                    "bg-emerald-600 hover:bg-emerald-700 text-white font-bold " +
                    "text-xs h-10 px-5 rounded-xl gap-2 shadow-sm"
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
            </div>
          )}

          {/* STEP 2: PREVIEW METRICS & ITEM LIST */}
          {preview && (
            <div className="space-y-5">
              {/* METRIC SUMMARY CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* ALREADY PAID */}
                <div
                  className={
                    "p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 border " +
                    "border-zinc-200 dark:border-zinc-700/60"
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
                  <span className="text-xl font-black text-zinc-700 dark:text-zinc-200 mt-1 block">
                    {preview.alreadyPaidCount}
                  </span>
                  <span className="text-[10px] text-zinc-400 mt-0.5 block">
                    Cero duplicidad contable
                  </span>
                </div>

                {/* READY TO APPLY */}
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                  <span
                    className={
                      "text-[11px] font-bold text-emerald-700 " +
                      "dark:text-emerald-400 uppercase tracking-wider block"
                    }
                  >
                    Nuevos Listos para Aplicar
                  </span>
                  <span
                    className={
                      "text-xl font-black text-emerald-600 " +
                      "dark:text-emerald-300 mt-1 block"
                    }
                  >
                    {preview.readyToApplyCount}
                  </span>
                  <span className="text-[10px] text-emerald-600/80 mt-0.5 block">
                    Reactivarán servicio MikroTik
                  </span>
                </div>

                {/* NOT FOUND / ERRORS */}
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30">
                  <span
                    className={
                      "text-[11px] font-bold text-rose-700 " +
                      "dark:text-rose-400 uppercase tracking-wider block"
                    }
                  >
                    No Encontrados / Error
                  </span>
                  <span className="text-xl font-black text-rose-600 dark:text-rose-300 mt-1 block">
                    {preview.errorCount}
                  </span>
                  <span className="text-[10px] text-rose-600/80 mt-0.5 block">
                    Requieren revisión manual
                  </span>
                </div>
              </div>

              {/* PREVIEW TABLE */}
              <div
                className={
                  "border border-zinc-200 dark:border-zinc-800 " +
                  "rounded-2xl overflow-hidden"
                }
              >
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead
                      className={
                        "bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 font-bold " +
                        "sticky top-0 border-b border-zinc-200 dark:border-zinc-800"
                      }
                    >
                      <tr>
                        <th className="p-2.5">Referencia</th>
                        <th className="p-2.5">Abonado / Contrato</th>
                        <th className="p-2.5 text-right">Monto</th>
                        <th className="p-2.5 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {preview.items.map((item, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30"
                        >
                          <td className="p-2.5 font-mono font-medium">
                            {item.reference}
                          </td>
                          <td className="p-2.5 truncate max-w-[180px]">
                            {item.clientName ? (
                              <div>
                                <span
                                  className={
                                    "font-bold text-zinc-900 " +
                                    "dark:text-zinc-100 block truncate"
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
                          <td className="p-2.5 text-right font-mono font-bold">
                            ${item.amount.toLocaleString("es-CO")}
                          </td>
                          <td className="p-2.5 text-center">
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
              </div>

              {/* ACTIONS */}
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

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    className="rounded-xl text-xs h-10 px-4"
                  >
                    {t("common.cancel", "Cerrar")}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleApply}
                    disabled={applying || preview.readyToApplyCount === 0}
                    className={
                      "bg-emerald-600 hover:bg-emerald-700 text-white font-bold " +
                      "text-xs h-10 px-5 rounded-xl gap-2 shadow-sm"
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
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
