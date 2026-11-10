# Antigravity Customization Rules & Guidelines

## User Approval & Confirmation Workflow

- **Mandatory Pre-Save Confirmation**: BEFORE creating, modifying, or saving source code files, ALWAYS create/update an `implementation_plan.md` artifact (or present a clear code diff breakdown) with `RequestFeedback: true` so the user can inspect the added and deleted code lines and explicitly approve the changes before files are updated.

## Code Style & Linter Rules

- **No `any` Types**: Never use `any` in TypeScript code. Use explicit types, interfaces, or `unknown` with type guards.
- **Mandatory Semicolons**: Always end statements with semicolons `;`.
- **Line Length (<100 Chars)**: Always break lines to keep code strictly under 100 characters per line.
- **Explicit Type Imports**: Always use `import type { ... }` when importing types or interfaces.
- **No Unused Variables**: Never leave unused variables (prefix with `_` if intentionally unused, e.g. `_req`).
- **Prefer `const`**: Always use `const` instead of `let` when variables are not reassigned.
- **Strict Equality**: Always use strict equality `===` and `!==`.
- **Clean Console**: Do not leave `console.log` in app code (permitted only in `prisma/**/*.ts` CLI seed scripts).
- **Zero Simulation / Mock Fallback Standard**: NEVER include dev simulation fallbacks (`isDev`, `"modo simulación dev"`, fake telemetry, or mock success responses) when communicating with external infrastructure or services (MikroTik RouterOS API, Evolution API, Webhooks, SMTP, Database). Always return the real connection status and explicit failure message so testing and diagnostics reflect 100% real system behavior.

## Database & Type Synchronization Rules

- **UTC Database Standard**: All timestamps and date fields in Prisma schemas and database models MUST always be stored in UTC (`DateTime @default(now())`).
- **Audit Fields (`createdBy` & `updatedBy`) Evaluation Standard**: Whenever a new Prisma model/table is added or modified, ALWAYS evaluate whether it is a core business, operational, financial, or administrative entity (as opposed to ephemeral auth/session tables, pivot tables, or immutable system logs). For all business/operational tables, include `createdBy String?` and `updatedBy String?` in `prisma/schema.prisma` and populate them in Server Actions using `const actor = session.user.email ?? null;` (`createdBy: actor, updatedBy: actor` on `create`, and `updatedBy: actor` on `update` / `updateMany`).
- **User & Brand Timezone Localization**: Use the `timezone` field (e.g. `"UTC"`, `"America/Mexico_City"`) and `locale` field on `User` and `Brand` models exclusively for localized UI formatting.
- **Automatic Type Synchronization**: Whenever a new Prisma model/table is added or modified in `prisma/schema.prisma`, ALWAYS create or update its corresponding TypeScript interface in `services/app/src/types/<domain>.ts` and export it in `services/app/src/types/index.ts`.
- **Idempotent Database Seeding**: All seeding in `prisma/seed.ts` MUST strictly use `prisma.<entity>.upsert()` for 100% of seeded records so `make db-seed` and `make db-setup` can be safely executed repeatedly without duplicate key collisions.
- **Accent-Insensitive Search Standard (`unaccent` / `f_unaccent`)**: Always maintain the PostgreSQL `unaccent` extension and the immutable `public.f_unaccent(text)` wrapper function in database migrations, and route all server-side text searches through `searchIdsWithUnaccent()` in `@/lib/search` so all queries are 100% accent-insensitive and case-insensitive.
- **Strict Migration Workflow Standard (Zero `db push`)**: NEVER execute `prisma db push`
  in development or production. All schema changes in `prisma/schema.prisma` MUST strictly
  be applied through Prisma migrations created via `make db-migrate` (handled manually by
  the developer) so the migration history in `prisma/migrations` and `_prisma_migrations`
  remains 100% in sync without schema drift.

## Server Actions & Database Access Rules

- **Prisma Singleton Standard**: ALWAYS import the Prisma Client singleton from `@/lib/prisma` (`import { prisma } from "@/lib/prisma"`). NEVER instantiate `new PrismaClient()` in application code.
- **Server Actions Directory**: Place Server Actions in domain-driven files under `services/app/src/actions/<domain>.ts` using `"use server"` (e.g. `src/actions/auth.ts`, `src/actions/billing.ts`).
- **Structured Action Response**: Server Actions MUST return consistent `ApiResponse<T>` objects (`{ success: boolean, data?: T, error?: string }`).

## Input Validation & Zod Schemas Rules

- **Validation Directory**: Place domain-driven Zod schemas in `services/app/src/lib/validations/<domain>.ts` and export them in `services/app/src/lib/validations/index.ts`.
- **Strict Type & Length Validation**: Every input field MUST validate data type, trim strings (`.trim()`), and enforce min/max length constraints (`min()`, `max()`).
- **Dual-Layer Validation**: Reuse Zod schemas on client forms (`react-hook-form` + `zodResolver`) and validate with `schema.safeParse(data)` inside Server Actions before database execution.
- **Unique Field Validation Convention**: All unique/non-repeatable fields (such as `email`, `slug`, `sku`) MUST be validated server-side **after the form submit button is pressed (On Submit)** inside Server Actions. When a duplicate value is detected: NEVER clear the input field text; highlight the input field with red error styling (`border-rose-500 ring-2 ring-rose-500/20`), display a localized error message directly below the field (`setError(field, { message })`), and trigger a Toast notification.

## UI & Table Conventions

- **Mandatory Pagination Control**: EVERY data table component in the application MUST include the `PaginationControl` component (`@/components/ui/pagination-control`) with server-side pagination (`skip` & `take` in Prisma SQL queries), unless explicitly specified otherwise by the user.
- **Always-Visible Pagination**: The `PaginationControl` component MUST remain visible at all times (showing "Página 1 de 1" even if there is only 1 page of data).
- **Server-Side URL Query Sync**: For all paginated tables/lists, pagination (`page`) and filtering parameters (`search`, `role`) MUST be synchronized with URL search parameters (`searchParams` / `useSearchParams`) to support deep-linking, browser history navigation, and link sharing.
- **Server-Side Search Trigger Standard (Enter or Search Button Only)**: Search inputs in paginated tables/lists MUST NEVER trigger server queries on every keystroke (`onChange` / `debounce`). They MUST only execute the server-side search when the user presses `Enter` (`<form onSubmit={handleSearchSubmit}>`) or clicks the magnifying glass search button (`<button type="submit">`), and include a clear (`X`) button when text is present. All server-side text searches MUST use `searchIdsWithUnaccent()` from `@/lib/search` for accent-insensitive matching.
- **Tailwind CSS v4 Dark Mode**: Ensure `@custom-variant dark (&:where(.dark, .dark *));` is declared at the top of `globals.css` so `next-themes` class-based dark mode works seamlessly.
- **Dual Light/Dark Theme Support**: All layout shells, navigation components, UI elements, and dashboard subpages MUST support both Light and Dark modes seamlessly using responsive Tailwind `dark:` variants instead of hardcoded static background or text colors.
- **Filter Metric Cards Standard**: All interactive metric/count filter cards MUST share the identical selection classes:
  - Base: `"cursor-pointer transition-all duration-200 border rounded-2xl backdrop-blur"`
  - Active: `"ring-2 ring-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500 shadow-md"`
  - Inactive: `"border-zinc-200 bg-white/90 dark:border-zinc-800 dark:bg-zinc-900/60 hover:border-emerald-500/40 hover:shadow-xs"`
- **Table Checkbox & Actions Placement Standard**: In all data tables with multi-selection, the row actions dropdown (`ActionsDropdown`) MUST be placed on the left side, immediately adjacent to the checkbox, with an empty header cell (no title text):
  - Header:
    `<TableHead className="w-10 p-2 text-center align-middle"><input type="checkbox" ... /></TableHead>`
    `<TableHead className="w-10 p-2 text-center"></TableHead>`
  - Rows:
    `<TableCell className="p-2 text-center align-middle w-10"><input type="checkbox" ... /></TableCell>`
    `<TableCell className="p-2 text-center align-middle w-10"><ActionsDropdown align="left" items={actions} /></TableCell>`
- **Activation & Status Toggle Standard**: Every entity with an active/inactive status MUST implement activation and deactivation actions both per row (`ActionsDropdown`) and in bulk (`BulkActionsBar`).

## Next.js 16 & Authentication Rules

- **Proxy Interceptor Standard**: Use `src/proxy.ts` (instead of `src/middleware.ts`) for edge routing, RBAC protection, and security headers in Next.js 16.
- **Hard Navigation After Auth**: Use `window.location.href` after authentication actions (login, register, logout) to ensure stale browser session cache and NextAuth states are completely purged.

## Multi-Language (i18n) Rules

- **Mandatory i18n Preparedness**: ALL UI pages, components, layouts, headings, descriptions, field labels, input placeholders, toast notifications, and modal dialogs MUST be prepared for multi-language support. NEVER leave hardcoded static UI text strings without adding their corresponding translation keys.
- **`useTranslation()` Standard**: In client components, ALWAYS use the `useTranslation()` hook from `@/components/providers/i18n-provider` and consume strings via `t("domain.key", "Fallback Text")`.
- **Synchronized Translation Dictionaries**: Whenever a new UI key is created or modified in `services/app/src/locales/es.json`, ALWAYS add its corresponding translation to `services/app/src/locales/en.json` to guarantee 100% key parity across locales.
- **Dual Persistence i18n Strategy**: Persist language preference to `User.locale` in the database for logged-in users, AND store in `localStorage` (`NEXT_LOCALE`) + HTTP cookies for unauthenticated guest visitors.

## Architecture & CLI Shortcuts

- **Microservices Directory Structure**: Keep application services inside `services/app`.
- **Docker Isolation Standard**: All NPM, Node.js, and Prisma commands MUST be executed inside Docker containers using `make` shortcuts to keep the host environment clean.
- **Docker Compose**: Container ports and environment configurations MUST be kept unique per project (`COMPOSE_PROJECT_NAME`) to prevent Docker volume collisions.
- **Makefile Shortcuts & Validation**:
  - ALWAYS use Makefile shortcuts instead of raw host commands or ad-hoc shell scripts.
  - For full validation (TypeScript type-checking + ESLint), strictly use `make prod-validate` (or `make check`).
  - `make prod-validate`: Run full TypeScript checking & ESLint inside Docker container.
  - `make dev-up`: Launch dev environment in foreground.
  - `make dev-up-d`: Launch dev environment in detached mode.
  - `make dev-up-build`: Force container rebuild & launch.
  - `make dev-down`: Stop dev container environment.
  - `make db-generate`: Regenerate Prisma Client types inside container.
  - `make db-migrate`: Run Prisma dev migrations inside container.
  - `make db-seed`: Execute database seeding script.
  - `make db-setup`: Full DB setup (generate + migrate + seed).
  - `make db-studio`: Launch Prisma Studio.
  - `make check`: Run TypeScript type-checking & ESLint inside Docker.
  - `make logs`: Tail active container logs.
  - `make shell-app`: Interactive shell inside the app container.
  - `make clean`: Deep clean containers, volumes, and `.next` cache.

## Webhooks & Outbound Delivery Rules

- **Asynchronous Outbound Dispatch**: Always dispatch outbound webhooks asynchronously using `triggerOutboundWebhook()` from `@/lib/webhook` so client Server Actions are never blocked by external HTTP latency.
- **Brand-Level Webhook Resolution**: Resolve target URLs using brand settings (`billingWebhookUrl` for payments/subscriptions, `generalWebhookUrl` for system events) with global system fallback (`process.env.N8N_URL`).
- **Delivery Auditing & Exponential Backoff**: Log all outbound delivery attempts in `WebhookLog` with latency in milliseconds (`durationMs`), HTTP status, and exponential backoff retry schedules (`30s`, `2m`, `10m`, `30m`).
- **Stateless Inbound Health Endpoints**: Inbound status/health endpoints (such as `/api/v1/brand/status`) MUST be stateless and return immediate responses without performing database logging to prevent database I/O bloat.

## Date & Timezone Conversion Rules

- **UI Input to UTC Conversion**: Always parse localized date inputs from forms/pickers using `toUtcDate(input, userTimezone)` from `@/lib/date` to produce a valid UTC `Date` object before persisting to Prisma.
- **UI DatePicker Initialization**: Format UTC dates from the database for HTML date inputs using `formatDateForPicker(utcDate, userTimezone, includeTime)` in `@/lib/date`.
