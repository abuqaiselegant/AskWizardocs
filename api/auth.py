"""
auth.py — Supabase JWT verification for FastAPI.
Supabase signs tokens with ES256 (ECDSA P-256); keys are fetched from JWKS.
"""

import os
import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

_security = HTTPBearer()

_SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
_JWKS_URL = f"{_SUPABASE_URL}/auth/v1/.well-known/jwks.json"
_jwks_client = PyJWKClient(_JWKS_URL)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_security),
) -> str:
    token = credentials.credentials
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key,
            algorithms=["ES256"],
            audience="authenticated",
        )
        return payload["sub"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail="Invalid token")
