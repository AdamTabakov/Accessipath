"""Authentication endpoints (port of the Node auth router)."""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Response

from ..config import settings
from ..core.errors import HttpError
from ..core.ratelimit import auth_limiter
from ..schemas import LoginBody, ResendBody, SignupBody, VerifyBody, to_safe_user
from ..services.auth import (
    generate_verification_code,
    hash_password,
    hash_verification_code,
    safe_equal,
    sign_token,
    verify_password,
)
from ..services.mailer import send_verification_email
from ..services.store import DataStore
from .deps import get_store, rate_limit, require_auth

router = APIRouter(prefix="/api/auth", tags=["auth"])

_auth_limit = rate_limit(auth_limiter)


def _code_expiry() -> str:
    return (
        datetime.now(timezone.utc) + timedelta(minutes=settings.verification_code_ttl_minutes)
    ).isoformat()


@router.post("/signup", dependencies=[Depends(_auth_limit)], status_code=201)
async def signup(
    body: SignupBody, response: Response, store: DataStore = Depends(get_store)
):
    existing = await store.find_user_by_email(body.email)
    if existing and existing.verifiedAt:
        raise HttpError(409, "An account with this email already exists.")
    if existing:
        code = generate_verification_code()
        await store.update_user(
            existing.id,
            {
                "verificationCodeHash": hash_verification_code(code),
                "verificationExpiresAt": _code_expiry(),
            },
        )
        mail = await send_verification_email(to=existing.email, name=existing.name, code=code)
        payload = {
            "user": to_safe_user(existing).model_dump(),
            "message": "Verification code sent.",
        }
        if mail.devCode:
            payload["devCode"] = mail.devCode
        response.status_code = 200
        return payload

    user_id = str(uuid.uuid4())
    code = generate_verification_code()
    user = await store.create_user(
        {
            "id": user_id,
            "email": body.email,
            "name": body.name,
            "passwordHash": await hash_password(body.password),
            "verificationCodeHash": hash_verification_code(code),
            "verificationExpiresAt": _code_expiry(),
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
    )
    mail = await send_verification_email(to=user.email, name=user.name, code=code)
    payload = {"user": to_safe_user(user).model_dump()}
    if mail.devCode:
        payload["devCode"] = mail.devCode
    return payload


@router.post("/verify", dependencies=[Depends(_auth_limit)])
async def verify(body: VerifyBody, store: DataStore = Depends(get_store)):
    user = await store.find_user_by_email(body.email)
    if not user:
        raise HttpError(400, "Invalid verification code.")
    if user.verifiedAt:
        return {"user": to_safe_user(user).model_dump()}
    if not user.verificationCodeHash:
        raise HttpError(400, "No verification code is pending. Request a new one.")
    if not safe_equal(user.verificationCodeHash, hash_verification_code(body.code)):
        raise HttpError(400, "Invalid verification code.")
    if not user.verificationExpiresAt or _now_ms() > _parse_ms(user.verificationExpiresAt):
        raise HttpError(400, "Verification code expired. Request a new one.")
    updated = await store.update_user(
        user.id,
        {
            "verifiedAt": datetime.now(timezone.utc).isoformat(),
            "verificationCodeHash": None,
            "verificationExpiresAt": None,
        },
    )
    return {"user": to_safe_user(updated).model_dump()}


@router.post("/resend", dependencies=[Depends(_auth_limit)])
async def resend(body: ResendBody, store: DataStore = Depends(get_store)):
    user = await store.find_user_by_email(body.email)
    if user and not user.verifiedAt:
        code = generate_verification_code()
        await store.update_user(
            user.id,
            {
                "verificationCodeHash": hash_verification_code(code),
                "verificationExpiresAt": _code_expiry(),
            },
        )
        mail = await send_verification_email(to=user.email, name=user.name, code=code)
        payload = {"ok": True}
        if mail.devCode:
            payload["devCode"] = mail.devCode
        return payload
    return {"ok": True}


@router.post("/login", dependencies=[Depends(_auth_limit)])
async def login(body: LoginBody, store: DataStore = Depends(get_store)):
    user = await store.find_user_by_email(body.email)
    generic_error = "Incorrect email or password."
    if not user:
        raise HttpError(401, generic_error)
    password_ok = await verify_password(body.password, user.passwordHash)
    if not password_ok:
        raise HttpError(401, generic_error)
    if not user.verifiedAt:
        raise HttpError(403, "Please verify your email before signing in.")
    token = sign_token(user.id)
    return {"token": token, "user": to_safe_user(user).model_dump()}


@router.get("/me")
async def me(user_id: str = Depends(require_auth), store: DataStore = Depends(get_store)):
    user = await store.get_user_by_id(user_id)
    if not user:
        raise HttpError(401, "Account not found.")
    return {"user": to_safe_user(user).model_dump()}


def _now_ms() -> float:
    return datetime.now(timezone.utc).timestamp() * 1000


def _parse_ms(value: str) -> float:
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.timestamp() * 1000