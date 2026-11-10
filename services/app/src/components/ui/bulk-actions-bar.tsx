"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Trash2,
  X,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useTranslation } from "@/components/providers/i18n-provider";

export interface BulkActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onActivate?: () => void;
  onDeactivate?: () => void;
  onDelete?: () => void;
  deleteConfirmationWord?: string;
  resourceName?: string;
  isLoading?: boolean;
}

export function BulkActionsBar({
  selectedCount,
  onClearSelection,
  onActivate,
  onDeactivate,
  onDelete,
  deleteConfirmationWord = "ELIMINAR",
  resourceName,
  isLoading = false,
}: BulkActionsBarProps) {
  const { t } = useTranslation();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [confirmInputText, setConfirmInputText] = useState("");

  if (selectedCount <= 0) return null;

  const isDeleteConfirmed =
    confirmInputText.trim().toUpperCase() ===
    deleteConfirmationWord.toUpperCase();

  const handleConfirmDelete = () => {
    if (!isDeleteConfirmed || !onDelete) return;
    onDelete();
    setIsDeleteModalOpen(false);
    setConfirmInputText("");
  };

  const defaultResourceName =
    resourceName || t("bulk.elements", "elementos");

  return (
    <>
      {/* Floating Action Bar */}
      <div
        className={
          "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center " +
          "gap-3 px-4 py-3 rounded-2xl bg-zinc-900/95 dark:bg-zinc-950/95 " +
          "text-white border border-zinc-700/60 shadow-2xl backdrop-blur-xl " +
          "animate-in fade-in slide-in-from-bottom-4 duration-300"
        }
      >
        <div
          className={
            "flex items-center gap-2 pr-3 border-r " +
            "border-zinc-700/60 text-xs font-semibold"
          }
        >
          <span
            className={
              "flex h-6 w-6 items-center justify-center rounded-full " +
              "bg-emerald-500 font-extrabold text-[11px] text-zinc-950"
            }
          >
            {selectedCount}
          </span>
          <span>
            {selectedCount === 1
              ? t("bulk.selectedSingle", "Elemento seleccionado")
              : t("bulk.selectedMultiple", "Elementos seleccionados")}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onActivate && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onActivate}
              disabled={isLoading}
              className={
                "h-8 px-2.5 text-xs text-emerald-400 hover:text-emerald-300 " +
                "hover:bg-emerald-500/10 rounded-xl gap-1.5 font-bold cursor-pointer"
              }
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{t("common.activate", "Activar")}</span>
            </Button>
          )}

          {onDeactivate && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onDeactivate}
              disabled={isLoading}
              className={
                "h-8 px-2.5 text-xs text-amber-400 hover:text-amber-300 " +
                "hover:bg-amber-500/10 rounded-xl gap-1.5 font-bold cursor-pointer"
              }
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>{t("common.deactivate", "Desactivar")}</span>
            </Button>
          )}

          {onDelete && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setConfirmInputText("");
                setIsDeleteModalOpen(true);
              }}
              disabled={isLoading}
              className={
                "h-8 px-2.5 text-xs text-rose-400 hover:text-rose-300 " +
                "hover:bg-rose-500/10 rounded-xl gap-1.5 font-bold cursor-pointer"
              }
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{t("common.delete", "Borrar")}</span>
            </Button>
          )}
        </div>

        <div className="pl-2 border-l border-zinc-700/60">
          <Button
            size="sm"
            variant="ghost"
            onClick={onClearSelection}
            className="h-7 w-7 p-0 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800"
            title={t("bulk.clearSelection", "Deseleccionar todo")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Strict Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent
          className={
            "max-w-md rounded-2xl bg-white dark:bg-zinc-950 border-zinc-200 " +
            "dark:border-zinc-800"
          }
        >
          <DialogHeader>
            <DialogTitle
              className={
                "text-lg font-bold flex items-center gap-2 text-rose-600 " +
                "dark:text-rose-400"
              }
            >
              <AlertTriangle className="h-5 w-5" />
              {t("bulk.confirmDeleteTitle", "¿Confirmar eliminación en lote?")}
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-600 dark:text-zinc-400">
              {t("bulk.confirmDeleteDesc1", "Estás a punto de eliminar")}{" "}
              <strong className="text-zinc-900 dark:text-white">
                {selectedCount}
              </strong>{" "}
              {defaultResourceName}.{" "}
              {t("bulk.confirmDeleteDesc2", "Esta acción no se puede deshacer.")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <p className="text-xs text-zinc-500">
              {t(
                "bulk.confirmDeleteInstruction",
                "Para confirmar la eliminación permanente, por favor escribe la palabra"
              )}{" "}
              <strong className="text-rose-600 dark:text-rose-400 font-mono uppercase">
                {deleteConfirmationWord}
              </strong>{" "}
              {t("bulk.confirmDeleteFieldSuffix", "en el siguiente campo:")}
            </p>

            <Input
              value={confirmInputText}
              onChange={(e) => setConfirmInputText(e.target.value)}
              placeholder={`${t("bulk.typePrompt", "Escribe")} ${deleteConfirmationWord}...`}
              className={`rounded-xl text-xs font-mono uppercase tracking-wider ${
                isDeleteConfirmed
                  ? "border-emerald-500 ring-2 ring-emerald-500/20"
                  : "border-zinc-300 dark:border-zinc-800"
              }`}
            />
          </div>

          <DialogFooter className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsDeleteModalOpen(false)}
              className="rounded-xl text-xs"
            >
              {t("common.cancel", "Cancelar")}
            </Button>
            <Button
              type="button"
              disabled={!isDeleteConfirmed || isLoading}
              onClick={handleConfirmDelete}
              className={
                "bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white " +
                "font-bold rounded-xl text-xs gap-1.5 cursor-pointer"
              }
            >
              <Trash2 className="h-4 w-4" />
              {t("bulk.deletePermanently", "Eliminar Definitivamente")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
