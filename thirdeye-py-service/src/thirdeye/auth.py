"""JWT authentication middleware for ThirdEye service."""

from typing import Optional, Dict, Any
from fastapi import HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from loguru import logger

from thirdeye.config import settings


security = HTTPBearer(auto_error=False)


async def get_current_user(request: Request) -> Dict[str, Any]:
    """
    Extract and validate JWT token from Authorization header.
    
    Token is issued and validated by OpenMetadata service.
    This service only validates the signature using shared secret.
    
    Args:
        request: FastAPI request object
        
    Returns:
        Decoded JWT payload containing user information
        
    Raises:
        HTTPException: If token is missing, invalid, or expired
    """
    # Extract Authorization header
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        logger.warning("Missing Authorization header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Remove "Bearer " prefix
    token = auth_header.replace("Bearer ", "").strip()
    if not token:
        logger.warning("Empty token in Authorization header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        # Decode and validate JWT
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        
        # Log successful authentication (without sensitive data)
        user_id = payload.get("sub") or payload.get("userId")
        logger.debug(f"Authenticated user: {user_id}")
        
        return payload
        
    except JWTError as e:
        logger.warning(f"JWT validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_optional_user(request: Request) -> Optional[Dict[str, Any]]:
    """
    Extract user from JWT if present, otherwise return None.
    
    Useful for endpoints that work for both authenticated and anonymous users.
    
    Args:
        request: FastAPI request object
        
    Returns:
        Decoded JWT payload if valid token present, None otherwise
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return None
    
    try:
        return await get_current_user(request)
    except HTTPException:
        return None
