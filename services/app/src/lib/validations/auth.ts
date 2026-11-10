import { z } from "zod";
import {
  bioSchema,
  emailSchema,
  localeSchema,
  loginPasswordSchema,
  nameSchema,
  passwordSchema,
  timezoneSchema,
} from "./common";

export const loginSchema = z.object({
  email: emailSchema,
  password: loginPasswordSchema,
});

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const updateProfileSchema = z.object({
  name: nameSchema.optional(),
  bio: bioSchema,
  locale: localeSchema.optional(),
  timezone: timezoneSchema.optional(),
});

export const roleNameEnum = z.enum([
  "SUPER_ADMIN",
  "ADMIN",
  "TECHNICIAN",
  "BILLING",
  "SUPPORT",
]);

export const createUserSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  roleName: roleNameEnum,
  brandId: z.string().nullable().optional(),
});

export const updateUserSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || val.trim() === "") return true;
        return (
          val.length >= 8 &&
          val.length <= 100 &&
          /[A-Z]/.test(val) &&
          /[a-z]/.test(val) &&
          /[0-9]/.test(val) &&
          /[^A-Za-z0-9]/.test(val)
        );
      },
      {
        message: "errors.passwordPolicyFull",
      }
    ),
  roleName: roleNameEnum,
  isActive: z.boolean(),
  brandId: z.string().nullable().optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "errors.passwordRequired"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "errors.passwordsDoNotMatch",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
