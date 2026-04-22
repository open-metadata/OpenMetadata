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
Client to interact with the Odoo XML-RPC API.

Odoo exposes two XML-RPC endpoints:
  - /xmlrpc/2/common  → unauthenticated calls (version, authenticate)
  - /xmlrpc/2/object  → authenticated model calls (execute_kw)

Authentication returns a numeric uid which is passed alongside the
password to every subsequent call.
"""
import traceback
import xmlrpc.client
from typing import Any, Dict, List, Optional

from metadata.generated.schema.entity.services.connections.database.odooConnection import (
    OdooConnection,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# Maximum number of records to fetch per page during metadata extraction.
ODOO_DEFAULT_LIMIT = 100


class OdooApiException(Exception):
    """
    Raised when the Odoo XML-RPC API returns an error or authentication fails.
    """


class OdooClient:
    """
    Thin wrapper around Odoo's XML-RPC API.

    The class authenticates once in __init__ and stores the resulting uid.
    All subsequent calls to execute_kw reuse that uid together with the
    password retrieved from the SecretStr config field.
    """

    def __init__(self, config: OdooConnection) -> None:
        self.config = config
        self._password = config.password.get_secret_value()

        base_url = str(config.hostPort).rstrip("/")
        common_url = f"{base_url}/xmlrpc/2/common"
        object_url = f"{base_url}/xmlrpc/2/object"

        try:
            self._common = xmlrpc.client.ServerProxy(common_url)
            self._object = xmlrpc.client.ServerProxy(object_url)
            self.uid = self._authenticate()
        except Exception as exc:
            logger.debug(traceback.format_exc())
            raise OdooApiException(
                f"Failed to connect to Odoo at [{base_url}]: {exc}"
            ) from exc

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _authenticate(self) -> int:
        """
        Authenticate against the Odoo common endpoint.

        Returns the integer uid on success, raises OdooApiException on failure.
        """
        uid = self._common.authenticate(
            self.config.databaseName,
            self.config.username,
            self._password,
            {},
        )
        if not uid:
            raise OdooApiException(
                "Authentication failed: Odoo returned uid=False. "
                "Verify your username, password, and database name."
            )
        logger.debug(
            f"Authenticated to Odoo database '{self.config.databaseName}' as uid={uid}"
        )
        return uid

    def _execute_kw(
        self,
        model: str,
        method: str,
        args: List[Any],
        kwargs: Optional[Dict[str, Any]] = None,
    ) -> Any:
        """
        Wrapper around execute_kw that injects auth credentials automatically.
        """
        return self._object.execute_kw(
            self.config.databaseName,
            self.uid,
            self._password,
            model,
            method,
            args,
            kwargs or {},
        )

    # ------------------------------------------------------------------
    # Connection-test methods (consumed by connection.py test_fn map)
    # ------------------------------------------------------------------

    def test_api(self) -> bool:
        """
        Verify end-to-end API access by confirming the uid is valid and the
        object endpoint is reachable.

        Executes check_access_rights on 'res.users' — a safe, read-only call
        that succeeds for any authenticated user.

        Raises OdooApiException on failure so test_connection_steps can
        surface the error in the UI.
        """
        try:
            result = self._execute_kw(
                "res.users",
                "check_access_rights",
                ["read"],
                {"raise_exception": False},
            )
            if result is False:
                raise OdooApiException(
                    "check_access_rights returned False — user may lack read permissions."
                )
            return True
        except OdooApiException:
            raise
        except Exception as exc:
            logger.debug(traceback.format_exc())
            raise OdooApiException(
                f"Unable to verify API access via res.users: {exc}"
            ) from exc

    def list_models(self) -> Optional[List[str]]:
        """
        Fetch a small batch of Odoo model names from ir.model.

        Used both as a connection test and as the entry point for the
        metadata ingestion topology.

        Returns a list of technical model names (e.g. ['res.partner',
        'sale.order', ...]) or raises OdooApiException on failure.
        """
        try:
            records = self._execute_kw(
                "ir.model",
                "search_read",
                [[]],
                {"fields": ["name", "model", "info"], "limit": ODOO_DEFAULT_LIMIT},
            )
            if records is None:
                raise OdooApiException("ir.model search_read returned None.")
            return [r["model"] for r in records]
        except OdooApiException:
            raise
        except Exception as exc:
            logger.debug(traceback.format_exc())
            raise OdooApiException(
                f"Failed to fetch model list from ir.model: {exc}"
            ) from exc

    def get_model_fields(self, model_name: str) -> List[Dict[str, Any]]:
        """
        Fetch field metadata for a given Odoo model.

        Calls ir.model.fields to retrieve name, field_description, ttype,
        relation, and required flag for every field on the model.

        Args:
            model_name: Technical model name, e.g. 'res.partner'.

        Returns:
            A list of field dicts, each with keys: name, field_description,
            ttype, relation, required.  Returns an empty list on error so callers can
            continue processing other models.
        """
        try:
            domain = [["model", "=", model_name]]
            records = self._execute_kw(
                "ir.model.fields",
                "search_read",
                [domain],
                {
                    "fields": [
                        "name",
                        "field_description",
                        "ttype",
                        "relation",
                        "required",
                    ]
                },
            )
            return records or []
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Failed to fetch fields for model '{model_name}': {exc}"
            )
            return []

    def get_all_models(self) -> List[Dict[str, Any]]:
        """
        Fetch all Odoo models from ir.model with their name, technical model
        string, and description.

        Returns a list of dicts with keys: id, name, model, info.
        """
        try:
            records = self._execute_kw(
                "ir.model",
                "search_read",
                [[]],
                {"fields": ["name", "model", "info"]},
            )
            return records or []
        except Exception as exc:
            logger.debug(traceback.format_exc())
            raise OdooApiException(
                f"Failed to fetch all models from ir.model: {exc}"
            ) from exc
