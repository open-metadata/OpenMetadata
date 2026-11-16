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
plugin Flask blueprints, so the decorator must establish the caller itself (through
the app's registered API auth backends, then through basic credentials checked by
the configured auth manager), ask that auth manager to grant the route's
permissions, and fail closed when either mechanism cannot be resolved.

The self-enforced path is pure Flask, so every test below runs on whichever Airflow
the environment has; only the tests that drive the real SimpleAuthManager need
Airflow 3.
"""

import base64
import json
import os
from pathlib import Path

import pytest
from flask import Flask
from flask_login import LoginManager, UserMixin, login_user

from openmetadata_managed_apis.utils import security_compat
from openmetadata_managed_apis.utils.airflow_version import is_airflow_3_or_higher

READ_DAGS = [("can_read", "DAGs")]
EDIT_DAGS = [("can_edit", "DAGs")]
READ_AND_DELETE_DAGS = [("can_read", "DAGs"), ("can_delete", "DAGs")]


class AuthenticatedUser(UserMixin):
    """A logged-in user, as Flask-Login would resolve one on a real deployment."""

    def __init__(self, user_id: str = "session-user"):
        self.user_id = user_id

    def get_id(self) -> str:
        return self.user_id


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


class FabSecurityManager:
    """The FAB security manager boundary: a user store answering basic credentials."""

    auth_type = None

    def __init__(self, accounts: dict[str, str]):
        self.accounts = accounts

    def auth_user_db(self, username, password):
        if self.accounts.get(username) == password:
            return AuthenticatedUser(username)
        return None


class AuthManager:
    """
    The Airflow 3 auth manager API the decorator authorizes against.

    `grants` maps a method ("GET", "PUT", ...) to the user ids allowed to perform it,
    so a test can tell a permitted user from an authenticated-but-unpermitted one.
    """

    def __init__(self, grants: dict[str, set[str]], security_manager=None):
        self.grants = grants
        if security_manager is not None:
            self.security_manager = security_manager

    def is_authorized_dag(self, *, method, user, access_entity=None, details=None):
        return user is not None and user.get_id() in self.grants.get(method, set())


def _basic(username: str, password: str) -> dict[str, str]:
    token = base64.b64encode(f"{username}:{password}".encode()).decode()
    return {"Authorization": f"Basic {token}"}


def _install_login(app: Flask) -> None:
    login_manager = LoginManager(app)

    @login_manager.user_loader
    def load_user(user_id):
        return AuthenticatedUser(user_id)

    @app.route("/login")
    def login():
        login_user(AuthenticatedUser())
        return "ok"


def _login(client) -> None:
    assert client.get("/login").status_code == 200


@pytest.fixture
def app(monkeypatch):
    # Exercise the self-enforced path whatever Airflow the environment has; the
    # delegation contract for Airflow 2 is asserted separately below.
    monkeypatch.setattr(security_compat, "get_security_module", lambda: None)

    application = Flask(__name__)
    application.secret_key = "test"
    application.probe_calls = []
    _install_login(application)

    def add_route(path: str, permissions):
        @application.route(path, methods=["GET"], endpoint=path)
        @security_compat.requires_access_decorator(permissions)
        def probe():
            application.probe_calls.append(path)
            return {"handler": path}

    add_route("/read", READ_DAGS)
    add_route("/edit", EDIT_DAGS)
    add_route("/read-and-delete", READ_AND_DELETE_DAGS)
    return application


@pytest.fixture
def use_auth_manager(monkeypatch):
    def _use(manager):
        monkeypatch.setattr(security_compat, "_auth_manager", lambda: manager)
        return manager

    return _use


def test_airflow2_security_module_receives_permissions(monkeypatch):
    received = {}

    class FakeSecurityModule:
        @staticmethod
        def requires_access(permissions_list):
            received["permissions"] = permissions_list
            return lambda func: func

    monkeypatch.setattr(security_compat, "get_security_module", lambda: FakeSecurityModule)

    @security_compat.requires_access_decorator(READ_DAGS)
    def probe():
        return "ok"

    assert received["permissions"] == READ_DAGS
    assert probe() == "ok"


def test_runtime_security_module_matches_airflow_version():
    if is_airflow_3_or_higher():
        assert security_compat.get_security_module() is None
    else:
        from airflow.api_connexion import security

        assert security_compat.get_security_module() is security


def test_unauthenticated_request_is_rejected_and_handler_not_run(app, use_auth_manager):
    app.api_auth = [SessionAuthBackend()]
    use_auth_manager(AuthManager(grants={"GET": {"session-user"}}))

    response = app.test_client().get("/read")

    assert response.status_code == 401
    assert app.probe_calls == []


def test_no_backend_and_no_credentials_is_rejected(app, use_auth_manager):
    use_auth_manager(AuthManager(grants={"GET": {"session-user"}}))

    response = app.test_client().get("/read")

    assert response.status_code == 401
    assert app.probe_calls == []


def test_session_backend_user_with_permission_dispatches(app, use_auth_manager):
    app.api_auth = [SessionAuthBackend()]
    use_auth_manager(AuthManager(grants={"GET": {"session-user"}}))
    client = app.test_client()
    _login(client)

    response = client.get("/read")

    assert response.status_code == 200
    assert response.get_json() == {"handler": "/read"}
    assert app.probe_calls == ["/read"]


def test_session_backend_user_without_permission_is_forbidden(app, use_auth_manager):
    app.api_auth = [SessionAuthBackend()]
    use_auth_manager(AuthManager(grants={"GET": {"someone-else"}}))
    client = app.test_client()
    _login(client)

    response = client.get("/read")

    assert response.status_code == 403
    assert app.probe_calls == []


def test_every_listed_permission_is_required(app, use_auth_manager):
    app.api_auth = [SessionAuthBackend()]
    use_auth_manager(AuthManager(grants={"GET": {"session-user"}}))
    client = app.test_client()
    _login(client)

    response = client.get("/read-and-delete")

    assert response.status_code == 403
    assert app.probe_calls == []


def test_all_backends_rejecting_without_credentials_fails_closed(app, use_auth_manager):
    app.api_auth = [RejectingAuthBackend()]
    use_auth_manager(AuthManager(grants={"GET": {"session-user"}}))
    client = app.test_client()
    _login(client)

    response = client.get("/read")

    assert response.status_code == 401
    assert app.probe_calls == []


def test_unresolvable_auth_manager_fails_closed(app, use_auth_manager):
    app.api_auth = [SessionAuthBackend()]
    use_auth_manager(None)
    client = app.test_client()
    _login(client)

    response = client.get("/read")

    assert response.status_code == 403
    assert app.probe_calls == []


def test_unknown_action_is_denied(app, use_auth_manager):
    app.api_auth = [SessionAuthBackend()]
    use_auth_manager(AuthManager(grants={"GET": {"session-user"}}))

    @app.route("/custom", endpoint="/custom")
    @security_compat.requires_access_decorator([("can_fly", "DAGs")])
    def custom():
        return {"handler": "/custom"}

    client = app.test_client()
    _login(client)

    assert client.get("/custom").status_code == 403


class TestBasicCredentialsAgainstFabUserStore:
    """Basic credentials resolved through the FAB security manager's user store."""

    @pytest.fixture
    def manager(self, use_auth_manager):
        return use_auth_manager(
            AuthManager(
                grants={"GET": {"admin", "viewer"}, "PUT": {"admin"}},
                security_manager=FabSecurityManager({"admin": "adminpass", "viewer": "viewerpass"}),
            )
        )

    def test_valid_credentials_with_permission_dispatch(self, app, manager):
        response = app.test_client().get("/edit", headers=_basic("admin", "adminpass"))

        assert response.status_code == 200
        assert app.probe_calls == ["/edit"]

    def test_wrong_password_is_rejected(self, app, manager):
        response = app.test_client().get("/read", headers=_basic("admin", "nope"))

        assert response.status_code == 401
        assert app.probe_calls == []

    def test_unknown_user_is_rejected(self, app, manager):
        response = app.test_client().get("/read", headers=_basic("ghost", "adminpass"))

        assert response.status_code == 401
        assert app.probe_calls == []

    def test_valid_credentials_without_permission_are_forbidden(self, app, manager):
        response = app.test_client().get("/edit", headers=_basic("viewer", "viewerpass"))

        assert response.status_code == 403
        assert app.probe_calls == []

    def test_registered_backend_rejection_still_allows_credentials(self, app, manager):
        app.api_auth = [SessionAuthBackend()]

        response = app.test_client().get("/read", headers=_basic("viewer", "viewerpass"))

        assert response.status_code == 200
        assert app.probe_calls == ["/read"]

    def test_non_basic_authorization_scheme_is_rejected(self, app, manager):
        response = app.test_client().get("/read", headers={"Authorization": "Bearer not-a-basic-token"})

        assert response.status_code == 401
        assert app.probe_calls == []


def _dict_users_simple_auth_manager(simple):
    """
    The static API as Airflow 3.0 and 3.1 ship it: `get_users()` returns dicts and
    `get_passwords(users)` takes the user list, which the decorator must drive without
    a TypeError on those versions.
    """

    class DictUsersSimpleAuthManager(simple.SimpleAuthManager):
        @staticmethod
        def get_users():
            entries = os.environ["AIRFLOW__CORE__SIMPLE_AUTH_MANAGER_USERS"].split(",")
            return [{"username": username, "role": role} for username, role in (entry.split(":") for entry in entries)]

        @staticmethod
        def get_passwords(users):
            usernames = {user["username"] for user in users}
            passwords_file = Path(os.environ["AIRFLOW__CORE__SIMPLE_AUTH_MANAGER_PASSWORDS_FILE"])
            with passwords_file.open() as f:
                return {k: v for k, v in json.load(f).items() if k in usernames}

    return DictUsersSimpleAuthManager


class TestBasicCredentialsAgainstSimpleAuthManager:
    """
    Basic credentials resolved by the real SimpleAuthManager, the auth manager the
    stock ingestion image runs, from its configured users and password file.
    """

    @pytest.fixture(params=["installed", "airflow-3.0-and-3.1-shape"])
    def manager(self, request, monkeypatch, tmp_path, use_auth_manager):
        simple = pytest.importorskip("airflow.api_fastapi.auth.managers.simple.simple_auth_manager")
        passwords = tmp_path / "simple_auth_manager_passwords.json"
        passwords.write_text(json.dumps({"admin": "adminpass", "viewer": "viewerpass"}))
        monkeypatch.setenv("AIRFLOW__CORE__SIMPLE_AUTH_MANAGER_USERS", "admin:admin,viewer:viewer")
        monkeypatch.setenv("AIRFLOW__CORE__SIMPLE_AUTH_MANAGER_PASSWORDS_FILE", str(passwords))
        monkeypatch.setenv("AIRFLOW__CORE__SIMPLE_AUTH_MANAGER_ALL_ADMINS", "False")
        if request.param == "installed":
            return use_auth_manager(simple.SimpleAuthManager())
        return use_auth_manager(_dict_users_simple_auth_manager(simple)())

    def test_admin_credentials_dispatch_on_edit_route(self, app, manager):
        response = app.test_client().get("/edit", headers=_basic("admin", "adminpass"))

        assert response.status_code == 200
        assert app.probe_calls == ["/edit"]

    def test_viewer_credentials_dispatch_on_read_route(self, app, manager):
        response = app.test_client().get("/read", headers=_basic("viewer", "viewerpass"))

        assert response.status_code == 200
        assert app.probe_calls == ["/read"]

    def test_viewer_credentials_are_forbidden_on_edit_route(self, app, manager):
        response = app.test_client().get("/edit", headers=_basic("viewer", "viewerpass"))

        assert response.status_code == 403
        assert app.probe_calls == []

    def test_wrong_password_is_rejected(self, app, manager):
        response = app.test_client().get("/read", headers=_basic("admin", "nope"))

        assert response.status_code == 401
        assert app.probe_calls == []

    def test_user_missing_from_configuration_is_rejected(self, app, manager):
        response = app.test_client().get("/read", headers=_basic("ghost", "adminpass"))

        assert response.status_code == 401
        assert app.probe_calls == []

    def test_missing_credentials_are_rejected(self, app, manager):
        response = app.test_client().get("/read")

        assert response.status_code == 401
        assert app.probe_calls == []

    def test_all_admins_mode_admits_anonymous_callers(self, app, manager, monkeypatch):
        monkeypatch.setenv("AIRFLOW__CORE__SIMPLE_AUTH_MANAGER_ALL_ADMINS", "True")

        response = app.test_client().get("/edit")

        assert response.status_code == 200
        assert app.probe_calls == ["/edit"]
