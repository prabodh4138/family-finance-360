from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.entities import User, Household

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

def current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    try:
        user_id = decode_access_token(token).get("sub")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Account unavailable")
    return user

def current_household(user: User = Depends(current_user), db: Session = Depends(get_db)) -> Household:
    household = db.query(Household).filter(Household.owner_id == user.id).first()
    if not household:
        raise HTTPException(status_code=404, detail="Household not found")
    return household
