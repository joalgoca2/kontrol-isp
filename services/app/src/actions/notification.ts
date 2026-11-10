"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { ApiResponse } from "@/types";

export interface DbNotification {
  id: string;
  userId: string;
  title: string;
  desc: string;
  type: string;
  read: boolean;
  createdAt: Date;
}

export async function getUserNotificationsAction(): Promise<
  ApiResponse<DbNotification[]>
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const notifications = await prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return { success: true, data: notifications };
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Error fetching notifications";
    return { success: false, error: msg };
  }
}

export async function markNotificationReadAction(
  id: string
): Promise<ApiResponse<boolean>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    await prisma.notification.updateMany({
      where: { id, userId: session.user.id },
      data: { read: true },
    });

    return { success: true, data: true };
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Error updating notification";
    return { success: false, error: msg };
  }
}

export async function markAllNotificationsReadAction(): Promise<
  ApiResponse<boolean>
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    await prisma.notification.updateMany({
      where: { userId: session.user.id, read: false },
      data: { read: true },
    });

    return { success: true, data: true };
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Error updating notifications";
    return { success: false, error: msg };
  }
}

export async function createNotificationAction(params: {
  userId: string;
  title: string;
  desc: string;
  type?: string;
}): Promise<ApiResponse<boolean>> {
  try {
    await prisma.notification.create({
      data: {
        userId: params.userId,
        title: params.title,
        desc: params.desc,
        type: params.type || "system",
        read: false,
      },
    });

    return { success: true, data: true };
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Error creating notification";
    return { success: false, error: msg };
  }
}
