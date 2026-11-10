"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { ApiResponse } from "@/types";

export async function completeWalkthroughAction(): Promise<ApiResponse<boolean>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        showWalkthrough: false,
        walkthroughStep: 3,
        walkthroughDoneAt: new Date(),
      },
    });

    return { success: true, data: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error updating walkthrough";
    return { success: false, error: msg };
  }
}

export async function skipWalkthroughAction(): Promise<ApiResponse<boolean>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        showWalkthrough: false,
      },
    });

    return { success: true, data: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error skipping walkthrough";
    return { success: false, error: msg };
  }
}

export async function updateWalkthroughStepAction(
  step: number
): Promise<ApiResponse<boolean>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        walkthroughStep: Math.max(0, step),
      },
    });

    return { success: true, data: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error updating step";
    return { success: false, error: msg };
  }
}

export async function getWalkthroughStatusAction(): Promise<
  ApiResponse<{ showWalkthrough: boolean; step: number }>
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { showWalkthrough: true, walkthroughStep: true },
    });

    return {
      success: true,
      data: {
        showWalkthrough: user?.showWalkthrough ?? false,
        step: user?.walkthroughStep ?? 0,
      },
    };
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Error fetching walkthrough status";
    return { success: false, error: msg };
  }
}
