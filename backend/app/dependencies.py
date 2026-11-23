from __future__ import annotations

import jwt
from fastapi import Header, HTTPException, status

from .auth import verify_access_token


def require_auth(authorization: str | None = Header(default=None)) -> str:
	if not authorization:
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing authorization header")

	scheme, _, token = authorization.partition(" ")
	if scheme.lower() != "bearer" or not token:
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authorization scheme")

	try:
		payload = verify_access_token(token)
	except (jwt.InvalidTokenError, RuntimeError):
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

	subject = payload.get("sub")
	if not isinstance(subject, str) or not subject:
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

	return subject
