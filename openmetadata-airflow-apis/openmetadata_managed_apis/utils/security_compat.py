#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Compatibility layer for Airflow security decorators across versions
"""

import hmac
import inspect
import logging
from collections.abc import Callable, Sequence
from functools import wraps
from typing import Any

from flask import Response, current_app, has_request_context, jsonify, request

from openmetadata_managed_apis.utils.airflow_version import is_airflow_3_or_higher

logger = logging.getLogger(__name__)


_STATUS_UNAUTHORIZED = 401
_STATUS_FORBIDDEN = 403

# The FAB permission actions carried by the routes, expressed as the methods the
# Airflow 3 auth manager API authorizes. An action outside this map is denied.
_METHOD_BY_ACTION = {
    "can_read": "GET",
    "can_create": "POST",
    "can_edit": "PUT",
    "can_delete": "DELETE",
}
_DAG_RESOURCE = "DAGs"


def get_security_module():
    """
    Get the appropriate security module based on Airflow version.

    Returns:
        module: The security module appropriate for the current Airflow version
    """
    try:
        if is_airflow_3_or_higher():
            # Airflow 3 removed `airflow.api_connexion`. Airflow's web layer mounts
            # plugin Flask blueprints (e.g. /pluginsv2) through a plain WSGI pass-through
            # and does not enforce login for them, so on this path the decorator below
            # performs the authentication and authorization checks itself.
            return None
        else:  # noqa: RET505
            # Airflow 2.x uses api_connexion
            from airflow.api_connexion import security

            return security
    except ImportError:
        return None


def requires_access_decorator(permissions_list):
    """
    Create a compatibility decorator for requires_access.

    In Airflow 2.x, this uses airflow.api_connexion.security.requires_access.

    In Airflow 3.x, the surrounding web layer does not authenticate requests that hit
    plugin Flask blueprints, so the decorator enforces both checks itself
    (ADR:2026-10-26-airflow3-plugin-routes-authenticate-through-the-configured-auth-manager):

    - authentication, through the API auth backends Airflow registered on the app
      (`[fab] auth_backends`), then through `Authorization: Basic` credentials checked
      against the configured auth manager's own credential store;
    - authorization, by requiring the configured auth manager to grant every
      (action, resource) permission in the list to the authenticated user.

    Both checks fail closed: if either mechanism cannot be resolved at request time,
    the request is rejected rather than dispatched.

    Args:
        permissions_list: List of (action, resource) tuples for access control

    Returns:
        Callable: Decorator function
    """
    security_module = get_security_module()

    if security_module is not None:
        # Airflow 2.x path
        return security_module.requires_access(permissions_list)

    # Airflow 3.x path
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            try:
                user = _authenticate()
            except Exception as exc:
                logger.warning(
                    "Unauthenticated request rejected for %s (%s)",
                    _request_path(),
                    type(exc).__name__,
                )
                return _error_response(
                    _STATUS_UNAUTHORIZED,
                    "Authentication required to access this resource",
                )

            try:
                authorized = _is_authorized(user, permissions_list)
            except Exception as exc:
                logger.warning(
                    "Access check could not be resolved for %s (%s)",
                    _request_path(),
                    type(exc).__name__,
                )
                return _error_response(_STATUS_FORBIDDEN, "Access to this resource is not authorized")

            if not authorized:
                logger.warning("Access denied for %s", _request_path())
                return _error_response(_STATUS_FORBIDDEN, "Access to this resource is not authorized")

            return func(*args, **kwargs)

        return wrapper

    return decorator


def _request_path() -> str:
    return request.path if has_request_context() else "<no request context>"


def _error_response(status: int, message: str) -> Response:
    response = jsonify({"detail": message})
    response.status_code = status
    return response


def _authenticate() -> Any:
    """
    Resolve the caller behind the incoming request, raising when nothing vouches for it.

    The API auth backends Airflow registered on the app are tried first. When none
    accepts the request, `Authorization: Basic` credentials are checked against the
    configured auth manager: SimpleAuthManager's user list and password file, or the
    FAB security manager's user store (DB or LDAP). That second step is what lets the
    OpenMetadata server, whose pipeline client only speaks basic auth, reach these
    routes on the stock deployment, where the FAB provider serves the plugin while
    SimpleAuthManager owns the credentials.
    """
    user = _authenticate_with_api_backends()
    if user is None:
        user = _authenticate_with_auth_manager()
    if user is None:
        raise RuntimeError("No authentication mechanism accepted the request")
    return user


def _authenticate_with_api_backends() -> Any | None:
    for backend in getattr(current_app, "api_auth", None) or []:
        try:
            response = backend.requires_authentication(Response)()
        except Exception:
            continue
        if response.status_code == 200:
            user = _backend_user()
            if user is not None:
                return user
    return None


def _backend_user() -> Any | None:
    """The identity a backend established: the auth manager's view of it, else Flask-Login's."""
    get_user = getattr(_auth_manager(), "get_user", None)
    if callable(get_user):
        return get_user()

    from flask_login import current_user

    if getattr(current_user, "is_authenticated", False):
        return current_user
    return None


def _authenticate_with_auth_manager() -> Any | None:
    auth_manager = _auth_manager()
    if auth_manager is None:
        return None

    simple_auth_manager_cls = _simple_auth_manager_cls()
    if simple_auth_manager_cls is not None and isinstance(auth_manager, simple_auth_manager_cls):
        return _simple_auth_manager_user(auth_manager)

    security_manager = getattr(auth_manager, "security_manager", None)
    if security_manager is not None:
        return _fab_user(security_manager)

    return None


def _simple_auth_manager_user(auth_manager) -> Any | None:
    """Mirror SimpleAuthManager's own login: its configured users and password file."""
    from airflow.api_fastapi.auth.managers.simple.user import SimpleAuthManagerUser
    from airflow.configuration import conf

    if conf.getboolean("core", "simple_auth_manager_all_admins"):
        return SimpleAuthManagerUser(username="Anonymous", role="ADMIN")

    credentials = _basic_credentials()
    if credentials is None:
        return None
    username, password = credentials

    users = auth_manager.get_users()
    expected = _simple_auth_manager_passwords(auth_manager, users).get(username, "")
    for user in users:
        if _simple_auth_manager_username(user) == username and hmac.compare_digest(
            expected.encode("utf-8"), password.encode("utf-8")
        ):
            return _as_simple_auth_manager_user(user)
    return None


def _simple_auth_manager_passwords(auth_manager, users) -> dict[str, str]:
    # Airflow 3.0 and 3.1 take the user list to filter the file; 3.2+ take nothing.
    if inspect.signature(auth_manager.get_passwords).parameters:
        return auth_manager.get_passwords(users)
    return auth_manager.get_passwords()


def _simple_auth_manager_username(user) -> str:
    # Airflow 3.0 and 3.1 list users as dicts; 3.2+ as SimpleAuthManagerUser objects.
    return user["username"] if isinstance(user, dict) else user.username


def _as_simple_auth_manager_user(user) -> Any:
    if not isinstance(user, dict):
        return user
    from airflow.api_fastapi.auth.managers.simple.user import SimpleAuthManagerUser

    return SimpleAuthManagerUser(username=user["username"], role=user["role"])


def _fab_user(security_manager) -> Any | None:
    """Mirror the FAB provider's basic auth backend: LDAP when configured, then the DB."""
    credentials = _basic_credentials()
    if credentials is None:
        return None
    username, password = credentials

    user = None
    ldap_auth_type = _fab_ldap_auth_type()
    if ldap_auth_type is not None and getattr(security_manager, "auth_type", None) == ldap_auth_type:
        user = security_manager.auth_user_ldap(username, password)
    if user is None:
        user = security_manager.auth_user_db(username, password)
    return user


def _fab_ldap_auth_type() -> Any:
    try:
        from flask_appbuilder.const import AUTH_LDAP
    except ImportError:
        return None
    return AUTH_LDAP


def _basic_credentials() -> tuple[str, str] | None:
    auth = request.authorization
    if auth is None or (auth.type or "").lower() != "basic" or not auth.username or not auth.password:
        return None
    return auth.username, auth.password


def _is_authorized(user: Any, permissions_list: Sequence[tuple[str, str]]) -> bool:
    """
    Require the configured auth manager to grant every (action, resource) to the user.

    The DAG resource goes through `is_authorized_dag`; anything else through
    `is_authorized_custom_view`, the hook auth managers expose for FAB-style
    permissions. A missing auth manager denies the request.
    """
    auth_manager = _auth_manager()
    if auth_manager is None:
        raise RuntimeError("Auth manager is not available")
    return all(_is_authorized_for(auth_manager, user, action, resource) for action, resource in permissions_list)


def _is_authorized_for(auth_manager, user: Any, action: str, resource: str) -> bool:
    method = _METHOD_BY_ACTION.get(action)
    if method is None:
        return False
    if resource == _DAG_RESOURCE:
        return bool(auth_manager.is_authorized_dag(method=method, user=user))
    return bool(auth_manager.is_authorized_custom_view(method=method, resource_name=resource, user=user))


def _auth_manager() -> Any | None:
    try:
        from airflow.api_fastapi.app import get_auth_manager
    except ImportError:
        return None
    try:
        return get_auth_manager()
    except Exception:
        return None


def _simple_auth_manager_cls() -> Any | None:
    try:
        from airflow.api_fastapi.auth.managers.simple.simple_auth_manager import (
            SimpleAuthManager,
        )
    except ImportError:
        return None
    return SimpleAuthManager
