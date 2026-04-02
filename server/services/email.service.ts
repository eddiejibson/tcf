import nodemailer from "nodemailer";
import { log } from "../logger";

let _transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      pool: true,
      maxConnections: 3,
      greetingTimeout: 15000,
      socketTimeout: 30000,
    });
  }
  return _transporter;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendWithRetry(mailOptions: nodemailer.SendMailOptions, retries = 2) {
  const to = Array.isArray(mailOptions.to) ? mailOptions.to.join(", ") : String(mailOptions.to);
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const transporter = getTransporter();
      const info = await transporter.sendMail(mailOptions);
      log.info("Email sent successfully", { meta: { to, subject: String(mailOptions.subject), messageId: info.messageId, response: info.response } });
      return;
    } catch (err) {
      log.error(`Email send failed (attempt ${attempt + 1}/${retries + 1})`, err, { meta: { to, subject: String(mailOptions.subject) } });
      if (attempt === retries) throw err;
      // Reset transporter on connection errors so next attempt gets a fresh one
      _transporter = null;
      await sleep(1000 * (attempt + 1));
    }
  }
}

function from() {
  return process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@thecoralfarm.co.uk";
}

export async function sendMagicLink(email: string, url: string) {
  await sendWithRetry({
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

export async function sendTeamInvite(
  email: string,
  loginUrl: string,
  inviterEmail: string,
  companyName: string | null,
  permissionLabels: string[],
) {
  const permList = permissionLabels.length > 0
    ? permissionLabels.map((p) => `<li style="color: #ffffffcc; font-size: 14px; padding: 4px 0;">${p}</li>`).join("")
    : `<li style="color: #ffffffcc; font-size: 14px; padding: 4px 0;">Full access</li>`;

  const companyLine = companyName ? ` for <strong style="color: #ffffff;">${companyName}</strong>` : "";

  await sendWithRetry({
    from: from(),
    to: email,
    subject: `You've been invited to The Coral Farm Trade Portal`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1f26; padding: 40px; border-radius: 16px;">
        <h1 style="color: #ffffff; font-size: 24px; margin-bottom: 8px;">The Coral Farm</h1>
        <p style="color: #ffffff99; font-size: 14px; margin-bottom: 24px;">Trade Portal Invitation</p>
        <p style="color: #ffffffcc; font-size: 16px; margin-bottom: 16px;">
          <strong style="color: #ffffff;">${inviterEmail}</strong> has added you as a team member${companyLine} on The Coral Farm Trade Portal.
        </p>
        <p style="color: #ffffffcc; font-size: 14px; margin-bottom: 8px;">With your account you can:</p>
        <ul style="margin: 0 0 24px 16px; padding: 0; list-style: none;">
          ${permList}
        </ul>
        <p style="color: #ffffffcc; font-size: 14px; margin-bottom: 24px;">Click the button below to log in and get started.</p>
        <a href="${loginUrl}" style="display: inline-block; background: #0984E3; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">Log In to Your Account</a>
        <p style="color: #ffffff66; font-size: 12px; margin-top: 32px;">If you weren't expecting this invitation, you can safely ignore this email.</p>
      </div>
    `,
    text: `${inviterEmail} has added you as a team member${companyName ? ` for ${companyName}` : ""} on The Coral Farm Trade Portal.\n\nLog in here: ${loginUrl}\n\nIf you weren't expecting this, you can ignore this email.`,
  });
}

export async function sendOrderNotification(
  adminEmails: string[],
  userEmail: string,
  shipmentName: string,
  orderTotal: string,
  orderId: string,
) {
  const baseUrl = process.env.MAGIC_LINK_BASE_URL || "http://localhost:3000";
  const viewUrl = `${baseUrl}/login?to=/admin/orders/${orderId}`;

  await sendWithRetry({
    from: from(),
    to: adminEmails,
    subject: `New Order Submitted - ${userEmail}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1f26; padding: 40px; border-radius: 16px;">
        <h1 style="color: #ffffff; font-size: 24px; margin-bottom: 8px;">New Order Submitted</h1>
        <p style="color: #ffffffcc; font-size: 16px; margin-bottom: 8px;">Customer: <strong style="color: #0984E3;">${userEmail}</strong></p>
        <p style="color: #ffffffcc; font-size: 16px; margin-bottom: 8px;">Shipment: <strong style="color: #ffffff;">${shipmentName}</strong></p>
        <p style="color: #ffffffcc; font-size: 16px; margin-bottom: 24px;">Total: <strong style="color: #0984E3;">${orderTotal}</strong></p>
        <a href="${viewUrl}" style="display: inline-block; background: #0984E3; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">View Order</a>
        <p style="color: #ffffff66; font-size: 12px; margin-top: 32px;">Log in to the admin panel to review this order.</p>
      </div>
    `,
    text: `New order submitted by ${userEmail} for shipment "${shipmentName}". Total: ${orderTotal}. View order: ${viewUrl}`,
  });
}

export async function sendOrderStatusUpdate(
  userEmail: string,
  shipmentName: string,
  status: string,
  orderTotal: string,
  orderId: string,
) {
  const baseUrl = process.env.MAGIC_LINK_BASE_URL || "http://localhost:3000";
  const viewUrl = `${baseUrl}/login?to=/orders/${orderId}`;
  const isAccepted = status === "ACCEPTED";
  const isFulfillment = status === "AWAITING_FULFILLMENT";
  const statusColor = isAccepted ? "#27ae60" : isFulfillment ? "#f39c12" : "#e74c3c";
  const statusText = isFulfillment ? "sent for fulfillment" : status.toLowerCase();
  const subject = isAccepted ? "Order Accepted" : isFulfillment ? "Order Sent for Fulfillment" : "Order Update";
  const footerText = isAccepted
    ? '<p style="color: #ffffffcc; font-size: 14px; margin-top: 16px;">Please log in to complete payment.</p>'
    : isFulfillment
    ? '<p style="color: #ffffffcc; font-size: 14px; margin-top: 16px;">Your order has been sent to our exporter. We will notify you once items are confirmed and payment is due.</p>'
    : "";
  await sendWithRetry({
    from: from(),
    to: userEmail,
    subject: `${subject} - The Coral Farm`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1f26; padding: 40px; border-radius: 16px;">
        <h1 style="color: #ffffff; font-size: 24px; margin-bottom: 8px;">The Coral Farm</h1>
        <p style="color: #ffffffcc; font-size: 16px; margin-bottom: 8px;">Your order for <strong style="color: #ffffff;">${shipmentName}</strong> has been <strong style="color: ${statusColor};">${statusText}</strong>.</p>
        <p style="color: #ffffffcc; font-size: 16px; margin-bottom: 24px;">Total: <strong style="color: #0984E3;">${orderTotal}</strong></p>
        ${footerText}
        <a href="${viewUrl}" style="display: inline-block; background: #0984E3; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; margin-top: 16px;">View Order</a>
        <p style="color: #ffffff66; font-size: 12px; margin-top: 32px;">Log in to view your order details.</p>
      </div>
    `,
    text: `Your order for "${shipmentName}" has been ${statusText}. Total: ${orderTotal}. View order: ${viewUrl}`,
  });
}

export async function sendOrderAcceptedWithInvoice(
  userEmail: string,
  shipmentName: string,
  orderTotal: string,
  orderId: string,
  orderRef: string,
  invoicePdf: Buffer,
) {
  const baseUrl = process.env.MAGIC_LINK_BASE_URL || "http://localhost:3000";
  const viewUrl = `${baseUrl}/login?to=/orders/${orderId}`;

  await sendWithRetry({
    from: from(),
    to: userEmail,
    subject: `Order Accepted - The Coral Farm`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1f26; padding: 40px; border-radius: 16px;">
        <h1 style="color: #ffffff; font-size: 24px; margin-bottom: 8px;">The Coral Farm</h1>
        <p style="color: #ffffffcc; font-size: 16px; margin-bottom: 8px;">Your order for <strong style="color: #ffffff;">${shipmentName}</strong> has been <strong style="color: #27ae60;">accepted</strong>.</p>
        <p style="color: #ffffffcc; font-size: 16px; margin-bottom: 24px;">Total: <strong style="color: #0984E3;">${orderTotal}</strong></p>
        <p style="color: #ffffffcc; font-size: 14px; margin-bottom: 24px;">Your invoice is attached to this email. Please log in to complete payment.</p>
        <a href="${viewUrl}" style="display: inline-block; background: #0984E3; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">View Order &amp; Pay</a>
        <p style="color: #ffffff66; font-size: 12px; margin-top: 32px;">If you have any questions, please contact us.</p>
      </div>
    `,
    text: `Your order for "${shipmentName}" has been accepted. Total: ${orderTotal}. View your order and pay: ${viewUrl}`,
    attachments: [
      {
        filename: `TCF-Invoice-${orderRef}.pdf`,
        content: invoicePdf,
        contentType: "application/pdf",
      },
    ],
  });
}

export async function sendOrderChanges(
  userEmail: string,
  shipmentName: string,
  changes: string[],
  newTotal: string,
  orderId: string,
) {
  const baseUrl = process.env.MAGIC_LINK_BASE_URL || "http://localhost:3000";
  const viewUrl = `${baseUrl}/login?to=/orders/${orderId}`;
  const changeList = changes.map((c) => `<li style="color: #ffffffcc; font-size: 14px; margin-bottom: 4px;">${c}</li>`).join("");
  await sendWithRetry({
    from: from(),
    to: userEmail,
    subject: `Order Updated - The Coral Farm`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1f26; padding: 40px; border-radius: 16px;">
        <h1 style="color: #ffffff; font-size: 24px; margin-bottom: 8px;">The Coral Farm</h1>
        <p style="color: #ffffffcc; font-size: 16px; margin-bottom: 16px;">Your accepted order for <strong style="color: #ffffff;">${shipmentName}</strong> has been updated:</p>
        <ul style="list-style: none; padding: 0; margin: 0 0 16px 0;">${changeList}</ul>
        <p style="color: #ffffffcc; font-size: 16px; margin-bottom: 24px;">New Total: <strong style="color: #0984E3;">${newTotal}</strong></p>
        <a href="${viewUrl}" style="display: inline-block; background: #0984E3; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">View Order</a>
        <p style="color: #ffffff66; font-size: 12px; margin-top: 32px;">Log in to view the updated order.</p>
      </div>
    `,
    text: `Your accepted order for "${shipmentName}" has been updated:\n${changes.join("\n")}\nNew Total: ${newTotal}. View order: ${viewUrl}`,
  });
}

export async function sendOrderPaidNotification(
  adminEmails: string[],
  userEmail: string,
  orderRef: string,
  orderTotal: string,
  paymentMethod: string,
  orderId: string,
) {
  const baseUrl = process.env.MAGIC_LINK_BASE_URL || "http://localhost:3000";
  const viewUrl = `${baseUrl}/login?to=/admin/orders/${orderId}`;
  const methodLabel = paymentMethod === "BANK_TRANSFER" ? "Bank Transfer" : paymentMethod === "CARD" ? "Card Payment" : paymentMethod;
  await sendWithRetry({
    from: from(),
    to: adminEmails,
    subject: `Order Paid - #${orderRef} - ${userEmail}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1f26; padding: 40px; border-radius: 16px;">
        <h1 style="color: #ffffff; font-size: 24px; margin-bottom: 8px;">Order Paid</h1>
        <p style="color: #ffffffcc; font-size: 16px; margin-bottom: 8px;">Customer: <strong style="color: #0984E3;">${userEmail}</strong></p>
        <p style="color: #ffffffcc; font-size: 16px; margin-bottom: 8px;">Order: <strong style="color: #ffffff;">#${orderRef}</strong></p>
        <p style="color: #ffffffcc; font-size: 16px; margin-bottom: 8px;">Total: <strong style="color: #27ae60;">${orderTotal}</strong></p>
        <p style="color: #ffffffcc; font-size: 16px; margin-bottom: 24px;">Method: <strong style="color: #ffffff;">${methodLabel}</strong></p>
        <a href="${viewUrl}" style="display: inline-block; background: #27ae60; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">View Order</a>
        <p style="color: #ffffff66; font-size: 12px; margin-top: 32px;">Log in to the admin panel to view this order.</p>
      </div>
    `,
    text: `Order #${orderRef} has been paid by ${userEmail}. Total: ${orderTotal}. Method: ${methodLabel}. View order: ${viewUrl}`,
  });
}

export async function sendApplicationNotification(
  adminEmails: string[],
  companyName: string,
  applicationId: string,
) {
  const baseUrl = process.env.MAGIC_LINK_BASE_URL || "http://localhost:3000";
  const viewUrl = `${baseUrl}/login?to=/admin/applications/${applicationId}`;

  await sendWithRetry({
    from: from(),
    to: adminEmails,
    subject: `New Trade Account Application - ${companyName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1f26; padding: 40px; border-radius: 16px;">
        <h1 style="color: #ffffff; font-size: 24px; margin-bottom: 8px;">New Trade Application</h1>
        <p style="color: #ffffffcc; font-size: 16px; margin-bottom: 24px;">A new trade account application has been submitted by <strong style="color: #0984E3;">${companyName}</strong>.</p>
        <a href="${viewUrl}" style="display: inline-block; background: #0984E3; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">Review Application</a>
        <p style="color: #ffffff66; font-size: 12px; margin-top: 32px;">Log in to the admin panel to review this application.</p>
      </div>
    `,
    text: `New trade account application from ${companyName}. Review it here: ${viewUrl}`,
  });
}

export async function sendApplicationApproved(
  contactEmail: string,
  companyName: string,
) {
  const baseUrl = process.env.MAGIC_LINK_BASE_URL || "http://localhost:3000";
  const loginUrl = `${baseUrl}/login`;

  await sendWithRetry({
    from: from(),
    to: contactEmail,
    subject: "Trade Account Approved - The Coral Farm",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1f26; padding: 40px; border-radius: 16px;">
        <h1 style="color: #ffffff; font-size: 24px; margin-bottom: 8px;">The Coral Farm</h1>
        <p style="color: #ffffffcc; font-size: 16px; margin-bottom: 8px;">Great news! Your trade account application for <strong style="color: #ffffff;">${companyName}</strong> has been <strong style="color: #27ae60;">approved</strong>.</p>
        <p style="color: #ffffffcc; font-size: 16px; margin-bottom: 24px;">You can now log in to our trade portal using the button below.</p>
        <a href="${loginUrl}" style="display: inline-block; background: #0984E3; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">Log In to Trade Portal</a>
        <p style="color: #ffffff66; font-size: 12px; margin-top: 32px;">Use your email address (${contactEmail}) to request a login link.</p>
      </div>
    `,
    text: `Your trade account application for ${companyName} has been approved! Log in here: ${loginUrl}`,
  });
}

export async function sendApplicationRejected(
  contactEmail: string,
  companyName: string,
  reason?: string,
) {
  await sendWithRetry({
    from: from(),
    to: contactEmail,
    subject: "Trade Account Application Update - The Coral Farm",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1f26; padding: 40px; border-radius: 16px;">
        <h1 style="color: #ffffff; font-size: 24px; margin-bottom: 8px;">The Coral Farm</h1>
        <p style="color: #ffffffcc; font-size: 16px; margin-bottom: 8px;">Thank you for your interest in a trade account with The Coral Farm.</p>
        <p style="color: #ffffffcc; font-size: 16px; margin-bottom: 8px;">Unfortunately, we are unable to approve your application for <strong style="color: #ffffff;">${companyName}</strong> at this time.</p>
        ${reason ? `<p style="color: #ffffffcc; font-size: 14px; margin-top: 16px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px;">${reason}</p>` : ""}
        <p style="color: #ffffff66; font-size: 12px; margin-top: 32px;">If you have any questions, please contact us.</p>
      </div>
    `,
    text: `Thank you for your interest in a trade account with The Coral Farm. Unfortunately, we are unable to approve your application for ${companyName} at this time.${reason ? ` Reason: ${reason}` : ""}`,
  });
}

export async function sendAdminOrderCreated(
  userEmail: string,
  orderRef: string,
  orderTotal: string,
  orderId: string,
  invoicePdf: Buffer
) {
  const baseUrl = process.env.MAGIC_LINK_BASE_URL || "http://localhost:3000";
  const viewUrl = `${baseUrl}/login?to=/orders/${orderId}`;

  await sendWithRetry({
    from: from(),
    to: userEmail,
    subject: `Order Created For You - The Coral Farm`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1f26; padding: 40px; border-radius: 16px;">
        <h1 style="color: #ffffff; font-size: 24px; margin-bottom: 8px;">The Coral Farm</h1>
        <p style="color: #ffffffcc; font-size: 16px; margin-bottom: 8px;">An order has been created for you by The Coral Farm.</p>
        <p style="color: #ffffffcc; font-size: 16px; margin-bottom: 8px;">Order: <strong style="color: #ffffff;">#${orderRef}</strong></p>
        <p style="color: #ffffffcc; font-size: 16px; margin-bottom: 24px;">Total: <strong style="color: #0984E3;">${orderTotal}</strong></p>
        <p style="color: #ffffffcc; font-size: 14px; margin-bottom: 24px;">Your invoice is attached to this email. Please log in to complete payment.</p>
        <a href="${viewUrl}" style="display: inline-block; background: #0984E3; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">Log In &amp; Pay</a>
        <p style="color: #ffffff66; font-size: 12px; margin-top: 32px;">If you have any questions, please contact us.</p>
      </div>
    `,
    text: `An order has been created for you by The Coral Farm. Order #${orderRef}, Total: ${orderTotal}. Your invoice is attached. Log in and pay: ${viewUrl}`,
    attachments: [
      {
        filename: `TCF-Invoice-${orderRef}.pdf`,
        content: invoicePdf,
        contentType: "application/pdf",
      },
    ],
  });
}
