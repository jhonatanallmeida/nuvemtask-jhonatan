import base64
import hashlib
import hmac
import secrets

import jwt
from jwt.exceptions import InvalidTokenError

from .config import settings


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _unb64url(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
    return f"scrypt$16384$8$1${_b64url(salt)}${_b64url(digest)}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, n, r, p, salt_text, digest_text = encoded.split("$")
        if algorithm != "scrypt":
            return False
        expected = _unb64url(digest_text)
        actual = hashlib.scrypt(
            password.encode("utf-8"),
            salt=_unb64url(salt_text),
            n=int(n),
            r=int(r),
            p=int(p),
        )
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def create_access_token(user_id: str) -> str:
    import time

    now = int(time.time())
    payload = {
        "sub": user_id,
        "iat": now,
        "exp": now + settings.token_expiration_minutes * 60,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm="HS256")


def decode_access_token(token: str) -> str | None:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=["HS256"],
            options={"require": ["sub", "exp"]},
        )
        subject = payload.get("sub")
        return subject if isinstance(subject, str) else None
    except (InvalidTokenError, TypeError, ValueError):
        return None
