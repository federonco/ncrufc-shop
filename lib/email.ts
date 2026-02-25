import nodemailer from "nodemailer";

function getRecipients() {
  const raw = process.env.ORDERS_TO_EMAILS ?? "";
  return raw
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

export async function sendOrderEmail(params: {
  subject: string;
  html: string;
}) {
  const user = process.env.SMTP_USER ?? "";
  const pass = process.env.SMTP_PASS ?? "";
  const to = getRecipients();

  if (!user || !pass) throw new Error("Missing SMTP_USER / SMTP_PASS");
  if (to.length === 0) throw new Error("No recipients in ORDERS_TO_EMAILS");

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: `"NCRUFC Shop" <${user}>`,
    to, // <- array de recipients
    subject: params.subject,
    html: params.html,
    replyTo: user, // opcional (así replies vuelven al merch)
  });
}
