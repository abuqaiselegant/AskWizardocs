"""
auth.py — Supabase JWT verification for FastAPI.

Usage:
    from api.auth import get_current_user

    @app.post("/ask")
    def ask_endpoint(request: AskRequest, user_id: str = Depends(get_current_user)):
        ...
"""

import os
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

_security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_security),
) -> str:
    """
    Verify Supabase JWT and return the user_id (sub claim).
    Raises 401 if the token is missing, expired, or invalid.
    """
    secret = os.getenv("SUPABASE_JWT_SECRET")
    if not secret:
        raise HTTPException(status_code=500, detail="SUPABASE_JWT_SECRET not configured")

    try:
        payload = jwt.decode(
            credentials.credentials,
            secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload["sub"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
