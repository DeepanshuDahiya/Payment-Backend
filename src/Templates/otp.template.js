export function otpTemplate(name, otp) {
  return `
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Your OTP</title>
  </head>

  <body
    style="
      margin: 0;
      padding: 0;
      background: #f4f7fb;
      font-family: Arial, Helvetica, sans-serif;
    "
  >
    <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 0">
      <tr>
        <td align="center">
          <table
            width="600"
            cellpadding="0"
            cellspacing="0"
            style="
              background: #ffffff;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
            "
          >
            <tr>
              <td
                style="
                  background: #3464ca;
                  padding: 30px;
                  text-align: center;
                  color: white;
                  font-size: 30px;
                  font-weight: bold;
                "
              >
                💳 PayFlow
              </td>
            </tr>

            <tr>
              <td style="padding: 40px">
                <p style="font-size: 16px; color: #555; line-height: 28px">
                  Hi <strong>${name}</strong>,
                </p>

                <p style="font-size: 16px; color: #555; line-height: 28px">
                  Use the following One-Time Password (OTP) to continue.
                </p>

                <div style="margin: 35px 0; text-align: center">
                  <div
                    style="
                      display: inline-block;
                      padding: 18px 40px;
                      background: #f3f6ff;
                      border: 2px dashed #2563eb;
                      border-radius: 10px;
                      font-size: 38px;
                      font-weight: bold;
                      letter-spacing: 10px;
                      color: #2563eb;
                    "
                  >
                    ${otp}
                  </div>
                </div>

                <p style="font-size: 15px; color: #666; line-height: 26px">
                  This OTP is valid for <strong>10 minutes</strong>. Do not
                  share it with anyone.
                </p>

                <p style="font-size: 15px; color: #666; line-height: 26px">
                  If you didn't request this verification, you can safely ignore
                  this email.
                </p>

                <hr
                  style="
                    margin: 40px 0;
                    border: none;
                    border-top: 1px solid #eee;
                  "
                />

                <p
                  style="
                    font-size: 13px;
                    color: #999;
                    text-align: center;
                    line-height: 22px;
                  "
                >
                  This is an automated email from PayFlow.<br />
                  Please do not reply to this message.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}
