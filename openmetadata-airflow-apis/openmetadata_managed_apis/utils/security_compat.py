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

import logging
from collections.abc import Callable, Sequence
from functools import wraps
from typing import Any

from flask import Response, current_app, jsonify

from openmetadata_managed_apis.utils.airflow_version import is_airflow_3_or_higher

logger = logging.getLogger(__name__)


_STATUS_UNAUTHORIZED = 401
_STATUS_FORBIDDEN = 403


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
    plugin Flask blueprints, so the decorator enforces both checks itself:

    - authentication, via the API auth backends Airflow registered on the app
      (mirroring airflow.providers.fab.www.api_connexion.security.check_authentication);
    - authorization, by requiring the security manager to grant every
      (action, resource) permission in the list.

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
                _check_authentication()
            except Exception as exc:  # noqa: BLE001 - any backend failure denies access
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
                authorized = _check_permissions(permissions_list)
            except Exception as exc:  # noqa: BLE001 - an unresolved security manager denies access
                logger.warning(
                    "Access check could not be resolved for %s (%s)",
                    _request_path(),
                    type(exc).__name__,
                )
                return _error_response(
                    _STATUS_FORBIDDEN, "Access to this resource is not authorized"
                )

            if not authorized:
                logger.warning("Access denied for %s", _request_path())
                return _error_response(
                    _STATUS_FORBIDDEN, "Access to this resource is not authorized"
                )

            return func(*args, **kwargs)

        return wrapper

    return decorator


def _request_path() -> str:
    try:
        from flask import request

        return request.path
    except RuntimeError:
        return "<no request context>"


def _error_response(status: int, message: str) -> Response:
    response = jsonify({"detail": message})
    response.status_code = status
    return response


def _check_authentication() -> None:
    """
    Validate the incoming request through Airflow's registered API auth backends.

    Raises if no backend authenticates the request. The backends come from Airflow's
    `[fab] auth_backends` configuration (defaults to the FAB session backend; the
    basic auth backend covers `Authorization: Basic` credentials).
    """
    backends = getattr(current_app, "api_auth", None)
    if not backends:
        # No auth backend is available to establish who the caller is.
        raise RuntimeError("No API authentication backend is registered")

    for backend in backends:
        try:
            response = backend.requires_authentication(Response)()
            if response.status_code == 200:
                return
        except Exception:
            continue

    raise RuntimeError("All API authentication backends rejected the request")


def _check_permissions(permissions_list: Sequence[tuple[str, str]]) -> bool:
    """
    Require the current user to be authorized for every requested (action, resource).

    Reads the security manager from the Flask app builder, the same object Airflow's
    own views check against. A missing security manager denies the request.
    """
    user = _resolve_user()

    try:
        security_manager = _resolve_security_manager()
    except Exception:  # noqa: BLE001
        logger.debug("Security manager unavailable while checking %s", permissions_list)
        return False

    for action, resource in permissions_list:
        if not security_manager.has_access(action, resource, user=user):
            return False
    return True


def _resolve_security_manager():
    appbuilder = getattr(current_app, "appbuilder", None)
    security_manager = getattr(appbuilder, "sm", None)
    if security_manager is None or not hasattr(security_manager, "has_access"):
        raise RuntimeError("Security manager is not available")
    return security_manager


def _resolve_user() -> Any | None:
    try:
        from airflow.api_fastapi.app import get_auth_manager

        return get_auth_manager().get_user()
    except Exception:  # noqa: BLE001
        pass

    try:
        from flask_login import current_user

        if getattr(current_user, "is_authenticated", False):
            return current_user
    except Exception:  # noqa: BLE001
        pass

    return None
