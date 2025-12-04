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
from functools import wraps
from typing import Callable

from openmetadata_managed_apis.utils.airflow_version import is_airflow_3_or_higher


def get_security_module():
    """
    Get the appropriate security module based on Airflow version.

    Returns:
        module: The security module appropriate for the current Airflow version
    """
    try:
        if is_airflow_3_or_higher():
            # For Airflow 3.x, we need to provide a compatibility layer
            # since Flask blueprints still work but api_connexion is gone
            return None  # Will use no-op decorator
        else:
            # Airflow 2.x uses api_connexion
            from airflow.api_connexion import security

            return security
    except ImportError:
        return None


def requires_access_decorator(permissions_list):
    """
    Create a compatibility decorator for requires_access.

    In Airflow 2.x, this uses airflow.api_connexion.security.requires_access.
    In Airflow 3.x, since we're running as a Flask plugin (not FastAPI),
    we provide a pass-through decorator. Authentication is handled by
    Airflow's web authentication layer.

    Args:
        permissions_list: List of (action, resource) tuples for access control

    Returns:
        Callable: Decorator function
    """
    security_module = get_security_module()

    if security_module is not None:
        # Airflow 2.x path
        return security_module.requires_access(permissions_list)

    # Airflow 3.x path: No-op decorator since Flask plugins
    # inherit authentication from the Airflow web layer
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            return func(*args, **kwargs)

        return wrapper

    return decorator
