import { z } from "zod";

export const idSchema = z
  .string({ required_error: "errors.idRequired" })
  .min(1, "errors.idEmpty")
  .max(50, "errors.idTooLong");

export const emailSchema = z
  .string({ required_error: "errors.emailRequired" })
  .trim()
  .email("errors.emailInvalid")
  .max(255, "errors.emailTooLong");

export const nameSchema = z
  .string({ required_error: "errors.nameRequired" })
  .trim()
  .min(2, "errors.nameMinLength")
  .max(100, "errors.nameMaxLength");

export const loginPasswordSchema = z
  .string({ required_error: "errors.passwordRequired" })
  .min(1, "errors.passwordRequired");

export const passwordSchema = z
  .string({ required_error: "errors.passwordRequired" })
  .min(8, "errors.passwordMinLength")
  .max(100, "errors.passwordMaxLength")
  .regex(/[A-Z]/, "errors.passwordUppercase")
  .regex(/[a-z]/, "errors.passwordLowercase")
  .regex(/[0-9]/, "errors.passwordNumber")
  .regex(/[^A-Za-z0-9]/, "errors.passwordSpecialChar");

export const bioSchema = z
  .string()
  .trim()
  .max(1000, "errors.bioTooLong")
  .optional();

export const localeSchema = z
  .string()
  .trim()
  .min(2, "errors.localeMinLength")
  .max(10, "errors.localeMaxLength")
  .default("es");

export const timezoneSchema = z
  .string()
  .trim()
  .min(1, "errors.timezoneRequired")
  .max(50, "errors.timezoneMaxLength")
  .default("UTC");
