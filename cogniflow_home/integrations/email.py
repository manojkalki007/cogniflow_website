"""Email sender using SMTP (Google Workspace).

Sends transactional emails: booking confirmations, follow-ups,
payment receipts. Uses aiosmtplib for async SMTP.
"""

import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import aiosmtplib

from cogniflow_home.config import settings

logger = logging.getLogger("cogniflow_home.email")


class EmailSender:

    async def send(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: str = "",
        tenant_id: str = "",
    ) -> bool:
        from cogniflow_home.credentials.resolver import credentials
        config = await credentials.get(tenant_id, "smtp")

        smtp_user = config.get("user", "")
        smtp_password = config.get("password", "")
        if not smtp_user or not smtp_password:
            logger.warning("SMTP not configured — email not sent")
            return False

        msg = MIMEMultipart("alternative")
        msg["From"] = f"{config.get('from_name', 'Cogniflow')} <{config.get('from_email', settings.smtp_from_email)}>"
        msg["To"] = to_email
        msg["Subject"] = subject

        if text_body:
            msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        try:
            await aiosmtplib.send(
                msg,
                hostname=config.get("host", settings.smtp_host),
                port=int(config.get("port", settings.smtp_port)),
                username=smtp_user,
                password=smtp_password,
                start_tls=True,
            )
            logger.info(f"Email sent to {to_email}: {subject}")
            return True
        except Exception:
            logger.exception(f"Failed to send email to {to_email}")
            return False

    async def send_booking_confirmation(
        self,
        to_email: str,
        name: str,
        date: str,
        time: str,
        notes: str = "",
        company: str = "Cogniflow",
        tenant_id: str = "",
    ) -> bool:
        subject = f"Booking Confirmed — {date} at {time}"

        html_body = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
            <div style="text-align: center; margin-bottom: 28px;">
                <div style="display: inline-block; background: linear-gradient(135deg, #3B82F6, #6366F1); border-radius: 12px; padding: 10px 14px;">
                    <span style="color: white; font-size: 20px; font-weight: 700;">{company}</span>
                </div>
            </div>

            <h2 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; color: #111;">Your booking is confirmed!</h2>
            <p style="margin: 0 0 24px; color: #666; font-size: 15px;">Hi {name}, here are your appointment details:</p>

            <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #e9ecef;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px 0; color: #888; font-size: 13px; width: 100px;">Date</td>
                        <td style="padding: 8px 0; font-weight: 600; font-size: 15px;">{date}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #888; font-size: 13px;">Time</td>
                        <td style="padding: 8px 0; font-weight: 600; font-size: 15px;">{time}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #888; font-size: 13px;">Name</td>
                        <td style="padding: 8px 0; font-weight: 600; font-size: 15px;">{name}</td>
                    </tr>
                    {"<tr><td style='padding: 8px 0; color: #888; font-size: 13px;'>Notes</td><td style='padding: 8px 0; font-size: 14px; color: #555;'>" + notes + "</td></tr>" if notes else ""}
                </table>
            </div>

            <p style="color: #888; font-size: 13px; margin: 0;">
                Need to reschedule? Simply call us and we'll sort it out.
            </p>

            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0 16px;">
            <p style="color: #aaa; font-size: 11px; text-align: center; margin: 0;">
                {company} &middot; Automated confirmation &middot; Do not reply to this email
            </p>
        </div>
        """

        text_body = (
            f"Booking Confirmed\n\n"
            f"Hi {name},\n\n"
            f"Your appointment is confirmed:\n"
            f"Date: {date}\nTime: {time}\n"
            f"{('Notes: ' + notes) if notes else ''}\n\n"
            f"Need to reschedule? Just call us.\n\n"
            f"— {company}"
        )

        return await self.send(to_email, subject, html_body, text_body, tenant_id=tenant_id)

    async def send_followup(
        self,
        to_email: str,
        name: str,
        details: str,
        company: str = "Cogniflow",
        tenant_id: str = "",
    ) -> bool:
        subject = f"Following up — {company}"

        html_body = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
            <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 700;">Hi {name},</h2>
            <p style="margin: 0 0 20px; color: #555; font-size: 15px; line-height: 1.6;">
                Thank you for speaking with us. As discussed:
            </p>
            <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #e9ecef;">
                <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #333;">{details}</p>
            </div>
            <p style="color: #888; font-size: 13px;">If you have any questions, don't hesitate to call us.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0 16px;">
            <p style="color: #aaa; font-size: 11px; text-align: center;">{company}</p>
        </div>
        """

        return await self.send(to_email, subject, html_body, tenant_id=tenant_id)


email_sender = EmailSender()
