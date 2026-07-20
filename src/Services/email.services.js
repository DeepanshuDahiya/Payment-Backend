import { otpTemplate } from "../Templates/otp.template.js";
import transporter from "../Config/mail.js";

export async function sendMail({ to, subject, html, text = "" }) {
  try {
    return transporter.sendMail({
      from: `"PayFlow" <${process.env.MAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });
  } catch (error) {
    console.log(error.message);
  }
}
