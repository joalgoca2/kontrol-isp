import { redirect } from "next/navigation";

/**
 * In B2B Multimarca Architecture, public user registration (/register) is disabled.
 * End-users and staff accounts are created strictly by Brand Admins via /dashboard/users.
 * Any request attempting to access /register is redirected to /login.
 */
export default function RegisterPage() {
  redirect("/login");
}
