"""Email verification via Resend (port of the Node mailer).

When RESEND_API_KEY is not configured (local development) the code is logged
and returned so the flow can be tested end-to-end. The code is never returned
to the client in production."""

import asyncio
from dataclasses import dataclass

import httpx

from ..config import settings


@dataclass
class VerificationEmailResult:
    delivered: bool
    devCode: str | None = None


def _escape_html(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#39;")
    )


async def send_verification_email(to: str, name: str, code: str) -> VerificationEmailResult:
    if settings.is_test or not settings.resend_api_key:
        print(f"[mailer] dev fallback: verification code for {to} is {code}")
        return VerificationEmailResult(delivered=False, devCode=code)

    html = f"""
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; color: #1d1d1f;">
      <h1 style="font-size: 22px; margin: 0 0 12px;">Verify your AccessiPath email</h1>
      <p style="font-size: 15px; line-height: 1.5;">Hi {_escape_html(name)},</p>
      <p style="font-size: 15px; line-height: 1.5;">Your verification code is:</p>
      <p style="font-size: 32px; font-weight: 700; letter-spacing: 6px; margin: 16px 0; color: #0071e3;">{_escape_html(code)}</p>
      <p style="font-size: 15px; line-height: 1.5;">
        Enter it on the AccessiPath verification page. This code expires in
        {settings.verification_code_ttl_minutes} minutes. If you did not create an
        account, you can ignore this email.
      </p>
    </div>
    """

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {settings.resend_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": settings.resend_from,
                    "to": [to],
                    "subject": "Your AccessiPath verification code",
                    "html": html,
                },
            )
        if response.status_code >= 300:
            print(
                f"[mailer] Resend error {response.status_code}: {response.text[:500]}"
            )
            raise RuntimeError("Verification email could not be sent.")
        return VerificationEmailResult(delivered=True)
    except (httpx.HTTPError, asyncio.TimeoutError):
        raise RuntimeError("Verification email could not be sent.")