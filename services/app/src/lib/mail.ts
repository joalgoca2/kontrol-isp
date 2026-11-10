import nodemailer from "nodemailer";

export const mailTransporter = nodemailer.createTransport({
  host: process.env.EMAIL_SERVER_HOST ?? "localhost",
  port: Number(process.env.EMAIL_SERVER_PORT) || 587,
  secure: Number(process.env.EMAIL_SERVER_PORT) === 465,
  auth: {
    user: process.env.EMAIL_SERVER_USER ?? "",
    pass: process.env.EMAIL_SERVER_PASSWORD ?? "",
  },
});

export async function sendPasswordResetEmail(
  email: string,
  token: string
): Promise<boolean> {
  try {
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const resetLink = `${baseUrl}/reset-password?token=${token}`;

    await mailTransporter.sendMail({
      from: process.env.EMAIL_FROM ?? '"Next.js App" <no-reply@example.com>',
      to: email,
      subject: "Restablecimiento de Contraseña",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #10b981;">Restablecimiento de Contraseña</h2>
          <p>Has solicitado restablecer tu contraseña.</p>
          <p>Haz clic en el siguiente enlace para crear una nueva contraseña:</p>
          <div style="margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Restablecer Contraseña
            </a>
          </div>
          <p style="color: #64748b; font-size: 14px;">Si no solicitaste este cambio, ignora este correo.</p>
        </div>
      `,
    });

    return true;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to send email.";
    console.error("Failed to send password reset email:", message);
    return false;
  }
}

export async function sendWelcomeEmail(
  email: string,
  name: string
): Promise<boolean> {
  try {
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

    await mailTransporter.sendMail({
      from: process.env.EMAIL_FROM ?? '"Next.js App" <no-reply@example.com>',
      to: email,
      subject: "¡Bienvenido a Kontrol!",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #10b981;">¡Bienvenido, ${name}!</h2>
          <p>Tu cuenta ha sido creada exitosamente.</p>
          <div style="margin: 30px 0;">
            <a href="${baseUrl}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Ir a la Aplicación
            </a>
          </div>
        </div>
      `,
    });

    return true;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to send welcome email.";
    console.error("Failed to send welcome email:", message);
    return false;
  }
}
