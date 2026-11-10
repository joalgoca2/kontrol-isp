"use server";

import { prisma } from "@/lib/prisma";
import type { ApiResponse } from "@/types";

export async function updateUserLocale(
  userId: string,
  locale: string
): Promise<ApiResponse<null>> {
  try {
    if (!userId || !locale) {
      return { success: false, error: "UserId and locale are required." };
    }

    await prisma.user.update({
      where: { id: userId },
      data: { locale },
    });

    return { success: true, data: null };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to update user locale.";
    return { success: false, error: message };
  }
}
