import sg from "@sendgrid/mail";
import dotenv from "dotenv";
dotenv.config();
sg.setApiKey(process.env.SENDGRID_API_KEY);

export async function sendCodeEmail(to, subject, code) {
  await sg.send({
    to,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL || process.env.SENDGRID_FROM,
      name: process.env.SENDGRID_FROM_NAME || "Ecommerce Platform",
    },
    subject,
    text: `Mã của bạn: ${code}`,
    html: `<p>Mã của bạn: <b>${code}</b></p>`,
  });
}
