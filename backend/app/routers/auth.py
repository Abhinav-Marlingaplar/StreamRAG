from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from ..auth import create_access_token, hash_password, verify_password
from ..db import SessionLocal
from ..models import User


router = APIRouter(prefix="/auth", tags=["auth"])


class AuthRequest(BaseModel):
	email: str
	password: str


class AccessTokenResponse(BaseModel):
	access_token: str
	token_type: str


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: AuthRequest) -> dict[str, str]:
	session = SessionLocal()
	try:
		existing_user = session.scalar(select(User).where(User.email == payload.email))
		if existing_user is not None:
			raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

		user = User(email=payload.email, password_hash=hash_password(payload.password))
		session.add(user)
		session.commit()
		return {"message": "registered"}
	except IntegrityError:
		session.rollback()
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
	except SQLAlchemyError:
		session.rollback()
		raise HTTPException(
			status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
			detail="Database unavailable during registration. Please retry shortly.",
		)
	finally:
		session.close()


@router.post("/login", response_model=AccessTokenResponse)
def login(payload: AuthRequest) -> AccessTokenResponse:
	session = SessionLocal()
	try:
		user = session.scalar(select(User).where(User.email == payload.email))
		if user is None or not verify_password(payload.password, user.password_hash):
			raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

		token = create_access_token(subject=user.email)
		return AccessTokenResponse(access_token=token, token_type="bearer")
	except SQLAlchemyError:
		session.rollback()
		raise HTTPException(
			status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
			detail="Database unavailable during login. Please retry shortly.",
		)
	finally:
		session.close()
