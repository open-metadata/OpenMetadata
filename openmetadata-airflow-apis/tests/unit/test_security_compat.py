#  Copyright 2026 Collate
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
Tests for the cross-version requires_access decorator.

On Airflow 3 the surrounding web layer does not authenticate requests that hit
plugin Flask blueprints, so the decorator must enforce authentication through the
app's registered API auth backends and the per-route permission list itself, and
fail closed when either mechanism cannot be resolved.
"""

from types import SimpleNamespace

import pytest
from flask import Flask
from flask_login import LoginManager, UserMixin, login_user

from openmetadata_managed_apis.utils import security_compat
from openmetadata_managed_apis.utils.airflow_version import is_airflow_3_or_higher

PERMISSIONS = [("can_read", "DAGs")]


class AuthenticatedUser(UserMixin):
    """A logged-in user, as Flask-Login would resolve one on a real deployment."""

    def get_id(self) -> str:
        return "user-1"


class SessionAuthBackend:
    """Stands in for the FAB session backend registered on `app.api_auth`."""

    def requires_authentication(self, function):
        from flask_login import current_user

        def wrapper(fileobj=None, *args, **kwargs):
            if not current_user or not current_user.is_authenticated:
                raise RuntimeError("unauthenticated")
            return function(fileobj, *args, **kwargs)

        return wrapper


class RejectingAuthBackend:
    def requires_authentication(self, function):
        def wrapper(fileobj=None, *args, **kwargs):
            raise RuntimeError("rejected")

        return wrapper


def _security_manager_that(allows: bool):
    return SimpleNamespace(
        sm=SimpleNamespace(has_access=lambda action, resource, user=None: allows)
    )


def _decorate_view(app: Flask):
    calls = []

    @app.route("/probe", methods=["GET"])
    @security_compat.requires_access_decorator(PERMISSIONS)
    def probe():
        calls.append(True)
        return {"handler": "reached"}

    return calls


def _install_logged_in_user(app: Flask) -> None:
    login_manager = LoginManager(app)

    @login_manager.user_loader
    def load_user(user_id):
        return AuthenticatedUser()

    @app.route("/login")
    def login():
        login_user(AuthenticatedUser())
        return "ok"


requires_self_enforced_path = pytest.mark.skipif(
    security_compat.get_security_module() is not None,
    reason="this runtime delegates to the framework security module (Airflow 2 path)",
)


@pytest.fixture
def app():
    application = Flask(__name__)
    application.secret_key = "test"
    _install_logged_in_user(application)
    _decorate_view(application)
    return application


def _login(client) -> None:
    assert client.get("/login").status_code == 200


def test_airflow2_security_module_receives_permissions(monkeypatch):
    received = {}

    class FakeSecurityModule:
        @staticmethod
        def requires_access(permissions_list):
            received["permissions"] = permissions_list
            return lambda func: func

    monkeypatch.setattr(
        security_compat, "get_security_module", lambda: FakeSecurityModule
    )

    @security_compat.requires_access_decorator(PERMISSIONS)
    def probe():
        return "ok"

    assert received["permissions"] == PERMISSIONS
    assert probe() == "ok"


def test_security_module_is_resolved_on_importable_airflow2():
    if is_airflow_3_or_higher():
        pytest.skip("requires airflow.api_connexion")
    from airflow.api_connexion import security

    assert security_compat.get_security_module() is security


@requires_self_enforced_path
def test_unauthenticated_request_is_rejected_and_handler_not_run(app):
    client = app.test_client()
    response = client.get("/probe")
    assert response.status_code == 401


@requires_self_enforced_path
def test_permitted_authenticated_request_dispatches(app):
    app.api_auth = [SessionAuthBackend()]
    app.appbuilder = _security_manager_that(allows=True)
    client = app.test_client()
    _login(client)

    response = client.get("/probe")

    assert response.status_code == 200
    assert response.get_json() == {"handler": "reached"}


@requires_self_enforced_path
def test_denied_permission_returns_forbidden(app):
    app.api_auth = [SessionAuthBackend()]
    app.appbuilder = _security_manager_that(allows=False)
    client = app.test_client()
    _login(client)

    response = client.get("/probe")

    assert response.status_code == 403


@requires_self_enforced_path
def test_unresolvable_security_manager_fails_closed(app):
    app.api_auth = [SessionAuthBackend()]
    client = app.test_client()
    _login(client)

    response = client.get("/probe")

    assert response.status_code == 403


@requires_self_enforced_path
def test_all_backends_rejecting_fails_closed(app):
    app.api_auth = [RejectingAuthBackend()]
    app.appbuilder = _security_manager_that(allows=True)
    client = app.test_client()
    _login(client)

    response = client.get("/probe")

    assert response.status_code == 401
