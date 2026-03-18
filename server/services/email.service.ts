import nodemailer from "nodemailer";

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function from() {
  return process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@thecoralfarm.co.uk";
}

export async function sendMagicLink(email: string, url: string) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: from(),
    to: email,
    subject: "Your login link - The Coral Farm",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1f26; padding: 40px; border-radius: 16px;">
        <h1 style="color: #ffffff; font-size: 24px; margin-bottom: 8px;">The Coral Farm</h1>
        <p style="color: #ffffff99; font-size: 14px; margin-bottom: 32px;">Trade Portal Login</p>
        <p style="color: #ffffffcc; font-size: 16px; margin-bottom: 24px;">Click the button below to sign in to your account. This link expires in 15 minutes.</p>
        <a href="${url}" style="display: inline-block; background: #0984E3; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">Sign In</a>
        <p style="color: #ffffff66; font-size: 12px; margin-top: 32px;">If you didn't request this link, you can safely ignore this email.</p>
      </div>
    `,
    text: `Sign in to The Coral Farm Trade Portal:\n\n${url}\n\nThis link expires in 15 minutes.`,
  });
}

export async function sendOrderNotification(
  adminEmails: string[],
  userEmail: string,
  shipmentName: string,
  orderTotal: string
) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: from(),
    to: adminEmails,
    subject: `New Order Submitted - ${userEmail}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1f26; padding: 40px; border-radius: 16px;">
        <h1 style="color: #ffffff; font-size: 24px; margin-bottom: 8px;">New Order Submitted</h1>
        <p style="color: #ffffffcc; font-size: 16px; margin-bottom: 8px;">Customer: <strong style="color: #0984E3;">${userEmail}</strong></p>
        <p style="color: #ffffffcc; font-size: 16px; margin-bottom: 8px;">Shipment: <strong style="color: #ffffff;">${shipmentName}</strong></p>
        <p style="color: #ffffffcc; font-size: 16px;">Total: <strong style="color: #0984E3;">${orderTotal}</strong></p>
        <p style="color: #ffffff66; font-size: 12px; margin-top: 32px;">Log in to the admin panel to review this order.</p>
      </div>
    `,
    text: `New order submitted by ${userEmail} for shipment "${shipmentName}". Total: ${orderTotal}`,
  });
}

export async function sendOrderStatusUpdate(
  userEmail: string,
  shipmentName: string,
  status: string,
  orderTotal: string
) {
  const transporter = createTransporter();
  const isApproved = status === "APPROVED";
  await transporter.sendMail({
    from: from(),
    to: userEmail,
    subject: `Order ${isApproved ? "Approved" : "Update"} - The Coral Farm`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1f26; padding: 40px; border-radius: 16px;">
        <h1 style="color: #ffffff; font-size: 24px; margin-bottom: 8px;">The Coral Farm</h1>
        <p style="color: #ffffffcc; font-size: 16px; margin-bottom: 8px;">Your order for <strong style="color: #ffffff;">${shipmentName}</strong> has been <strong style="color: ${isApproved ? "#27ae60" : "#e74c3c"};">${status.toLowerCase()}</strong>.</p>
        <p style="color: #ffffffcc; font-size: 16px;">Total: <strong style="color: #0984E3;">${orderTotal}</strong></p>
        <p style="color: #ffffff66; font-size: 12px; margin-top: 32px;">Log in to view your order details.</p>
      </div>
    `,
    text: `Your order for "${shipmentName}" has been ${status.toLowerCase()}. Total: ${orderTotal}`,
  });
}
