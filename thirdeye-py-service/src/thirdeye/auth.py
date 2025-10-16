"""
Authentication and authorization using JWT tokens shared with OpenMetadata.
Validates JWT tokens issued by openmetadata-service.
"""

from typing import Dict, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from loguru import logger

from thirdeye.config import get_settings

# HTTP Bearer token extractor
security = HTTPBearer()


class JWTValidationError(Exception):
    """Raised when JWT validation fails."""
    pass


def decode_jwt(token: str) -> Dict:
    """
    Decode and validate JWT token issued by OpenMetadata.
    
    Args:
        token: JWT token string
        
    Returns:
        Decoded token payload
        
    Raises:
        JWTValidationError: If token is invalid or expired
    """
    settings = get_settings()
    
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            audience=settings.jwt_audience,
            issuer=settings.jwt_issuer,
        )
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("JWT token has expired")
        raise JWTValidationError("Token has expired")
    except jwt.InvalidAudienceError:
        logger.warning("JWT token has invalid audience")
        raise JWTValidationError("Invalid token audience")
    except jwt.InvalidIssuerError:
        logger.warning("JWT token has invalid issuer")
        raise JWTValidationError("Invalid token issuer")
    except jwt.InvalidTokenError as e:
        logger.warning(f"JWT token validation failed: {e}")
        raise JWTValidationError(f"Invalid token: {str(e)}")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict:
    """
    FastAPI dependency to extract and validate current user from JWT.
    
    Returns user information from the JWT token payload.
    
    Usage:
        @router.get("/protected")
        async def protected_route(user: Dict = Depends(get_current_user)):
            return {"user_id": user["sub"], "email": user.get("email")}
    
    Raises:
        HTTPException: 401 if token is missing or invalid
    """
    try:
        token = credentials.credentials
        payload = decode_jwt(token)
        
        # Log successful authentication
        user_id = payload.get("sub")
        logger.debug(f"Authenticated user: {user_id}")
        
        return payload
        
    except JWTValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        logger.error(f"Unexpected error during authentication: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        HTTPBearer(auto_error=False)
    )
) -> Optional[Dict]:
    """
    Optional authentication - returns user if token provided, None otherwise.
    
    Usage:
        @router.get("/optional-auth")
        async def route(user: Optional[Dict] = Depends(get_optional_user)):
            if user:
                return {"message": f"Hello {user['sub']}"}
            return {"message": "Hello anonymous"}
    """
    if not credentials:
        return None
    
    try:
        return decode_jwt(credentials.credentials)
    except JWTValidationError:
        return None


def require_role(required_roles: list[str]):
    """
    Dependency factory for role-based authorization.
    
    Usage:
        @router.get("/admin-only", dependencies=[Depends(require_role(["admin"]))])
        async def admin_route():
            return {"message": "Admin access granted"}
    
    Args:
        required_roles: List of roles that are allowed
        
    Returns:
        Dependency function
    """
    async def check_role(user: Dict = Depends(get_current_user)) -> Dict:
        user_roles = user.get("roles", [])
        
        if not any(role in user_roles for role in required_roles):
            logger.warning(
                f"User {user.get('sub')} attempted to access resource requiring roles {required_roles}, "
                f"but has roles {user_roles}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of roles: {', '.join(required_roles)}"
            )
        
        return user
    
    return check_role

