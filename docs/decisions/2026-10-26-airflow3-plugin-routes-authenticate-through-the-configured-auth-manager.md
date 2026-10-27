# On Airflow 3, the managed-API plugin routes authenticate and authorize through the configured auth manager

- **Status:** Accepted
- **Revisions:** v1 2026-10-26 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `openmetadata-airflow-apis/tests/unit/test_security_compat.py` (request-level tests through a Flask client, including the real `SimpleAuthManager`)
- **Related:** PR #36145

## Context

Airflow 2 wrapped every REST plugin route in `airflow.api_connexion.security.requires_access`,
which authenticated the caller through the deployment's API auth backends and checked the
route's `(action, resource)` permission list before dispatching.

Airflow 3 removed `airflow.api_connexion`. Its API server mounts Airflow 2 plugin Flask
blueprints under `/pluginsv2` through a plain WSGI pass-through built by the FAB provider,
and applies no per-route checks to them. The FAB provider registers the API auth backends
named by `[fab] auth_backends` on that Flask app (session by default); the `[api] auth_backends`
setting Airflow 2 used is not read on Airflow 3. The stock ingestion image runs
`SimpleAuthManager`, where the FAB provider only serves the plugin and holds no users, while the
OpenMetadata server's pipeline client authenticates with `Authorization: Basic` on every call.
A decorator that only consults the registered FAB backends therefore rejects the server on the
stock deployment.

## Decision

On Airflow 3, `openmetadata_managed_apis.utils.security_compat.requires_access_decorator`
enforces both checks itself, before the handler runs:

1. **Authentication**, in order:
   - the API auth backends Airflow registered on the Flask app (`app.api_auth`, from
     `[fab] auth_backends`); the identity is the auth manager's `get_user()` when it has one,
     else Flask-Login's current user;
   - otherwise, `Authorization: Basic` credentials checked against the configured auth
     manager's own credential store: `SimpleAuthManager`'s configured users and password file
     (honouring `simple_auth_manager_all_admins`, as its login does), or the FAB security
     manager's user store (LDAP when configured, then the DB), as the FAB basic auth backend does.
2. **Authorization**: the configured auth manager (`get_auth_manager()`) must grant every
   `(action, resource)` on the route to the authenticated user. `can_read`, `can_create`,
   `can_edit` and `can_delete` map to the `GET`, `POST`, `PUT` and `DELETE` methods of the
   auth manager API; the `DAGs` resource goes through `is_authorized_dag`, any other resource
   through `is_authorized_custom_view`. Any other action is denied.

Both checks fail closed: when no mechanism establishes the caller the route answers `401`;
when the auth manager cannot be resolved, raises, or denies any listed permission, it answers
`403`. The handler never runs on either outcome. The Airflow 2 path keeps delegating to
`airflow.api_connexion`.

## Consequences

- The stock deployment needs no new configuration: the server's basic credentials are the
  SimpleAuthManager users the ingestion entrypoint already provisions, and a FAB auth manager
  deployment keeps working through `[fab] auth_backends` or its basic credentials.
- Authorization follows the auth manager's model, so on `SimpleAuthManager` a `viewer` role can
  only reach the `can_read` routes while `user` and above reach the mutating ones; on FAB the
  user's DAG permissions decide, as on Airflow 2.
- Basic credentials can only be verified by an auth manager that owns a credential store.
  Under another auth manager (Keycloak, AWS, ...), only the registered API auth backends can
  admit a request, so the OpenMetadata server, which only speaks basic auth, is not supported
  there until its client can present that auth manager's token.
- Bearer tokens issued by the auth manager are not honoured on these routes; a caller that
  needs them is the trigger to revisit this record.
