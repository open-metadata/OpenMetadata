#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Source connection handler
"""
import traceback
from functools import partial

from tableau_api_lib import TableauServerConnection
from tableau_api_lib.utils import extract_pages

from metadata.generated.schema.entity.services.connections.dashboard.tableauConnection import (
    TableauConnection,
)
from metadata.ingestion.connections.test_connections import (
    SourceConnectionException,
    TestConnectionStep,
    test_connection_steps,
)
from metadata.ingestion.source.dashboard.tableau import (
    TABLEAU_GET_VIEWS_PARAM_DICT,
    TABLEAU_GET_WORKBOOKS_PARAM_DICT,
)
from metadata.utils.logger import ingestion_logger
from metadata.utils.ssl_registry import get_verify_ssl_fn

logger = ingestion_logger()


def get_connection(connection: TableauConnection) -> TableauServerConnection:
    """
    Create connection
    """
    tableau_server_config = {
        f"{connection.env}": {
            "server": connection.hostPort,
            "api_version": connection.apiVersion,
            "site_name": connection.siteName if connection.siteName else "",
            "site_url": connection.siteUrl if connection.siteUrl else "",
        }
    }
    if connection.username and connection.password:
        tableau_server_config[connection.env]["username"] = connection.username
        tableau_server_config[connection.env][
            "password"
        ] = connection.password.get_secret_value()
    elif (
        connection.personalAccessTokenName
        and connection.personalAccessTokenSecret.get_secret_value()
    ):
        tableau_server_config[connection.env][
            "personal_access_token_name"
        ] = connection.personalAccessTokenName
        tableau_server_config[connection.env][
            "personal_access_token_secret"
        ] = connection.personalAccessTokenSecret.get_secret_value()
    try:

        get_verify_ssl = get_verify_ssl_fn(connection.verifySSL)
        # ssl_verify is typed as a `bool` in TableauServerConnection
        # However, it is passed as `verify=self.ssl_verify` in each `requests` call.
        # In requests (https://requests.readthedocs.io/en/latest/user/advanced/#ssl-cert-verification)
        # the param can be None, False to ignore HTTPS certs or a string with the path to the cert.
        conn = TableauServerConnection(
            config_json=tableau_server_config,
            env=connection.env,
            ssl_verify=get_verify_ssl(connection.sslConfig),
        )
        conn.sign_in().json()
        return conn
    except Exception as exc:
        logger.debug(traceback.format_exc())
        raise SourceConnectionException(
            f"Unknown error connecting with {connection}: {exc}."
        )


def test_connection(client: TableauServerConnection) -> None:
    """
    Test connection
    """
    steps = [
        TestConnectionStep(
            function=client.server_info,
            name="Server Info",
        ),
        TestConnectionStep(
            function=partial(
                extract_pages,
                query_func=client.query_workbooks_for_site,
                parameter_dict=TABLEAU_GET_WORKBOOKS_PARAM_DICT,
            ),
            name="Get Workbooks",
        ),
        TestConnectionStep(
            function=partial(
                extract_pages,
                query_func=client.query_views_for_site,
                content_id=client.site_id,
                parameter_dict=TABLEAU_GET_VIEWS_PARAM_DICT,
            ),
            name="Get Views",
        ),
    ]

    test_connection_steps(steps)
