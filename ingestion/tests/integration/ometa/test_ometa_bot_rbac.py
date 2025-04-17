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
OMeta Bot RBAC tests
"""
from _openmetadata_testutils.ometa import int_admin_ometa
from metadata.generated.schema.configuration.searchSettings import (
    GlobalSettings,
    SearchSettings,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.teams.user import AuthenticationMechanism, User
from metadata.generated.schema.settings.settings import Settings, SettingType
from metadata.ingestion.ometa.ometa_api import OpenMetadata

BOTS = ["ingestion-bot", "profiler-bot"]


def get_bot_ometa(metadata, bot: str) -> OpenMetadata:
    """Get the bot ometa"""
    automator_bot: User = metadata.get_by_name(entity=User, fqn=bot)
    automator_bot_auth: AuthenticationMechanism = metadata.get_by_id(
        entity=AuthenticationMechanism, entity_id=automator_bot.id
    )

    return int_admin_ometa(jwt=automator_bot_auth.config.JWTToken.get_secret_value())


def test_bots_rbac_pagination(metadata, service, tables):
    """Bots can paginate properly"""
    query_filter = (
        '{"query":{"bool":{"must":[{"bool":{"should":[{"term":'
        f'{{"service.displayName.keyword":"{service.name.root}"}}}}]}}}}]}}}}}}'
    )

    settings = Settings(
        config_type=SettingType.searchSettings,
        config_value=SearchSettings(
            globalSettings=GlobalSettings(enableAccessControl=True)
        ),
    )
    # Ensure search is enabled
    metadata.client.put("/system/settings", data=settings.model_dump_json())

    for bot in BOTS:
        bot_ometa = get_bot_ometa(metadata, bot)
        # First, check the bot can indeed see that data
        for table in tables:
            allowed_table = bot_ometa.get_by_name(
                entity=Table, fqn=table.fullyQualifiedName
            )
            assert allowed_table
            assert (
                allowed_table.fullyQualifiedName.root == table.fullyQualifiedName.root
            )

        # Then, make sure that the admin can search those tables
        admin_assets = list(
            metadata.paginate_es(entity=Table, query_filter=query_filter, size=2)
        )
        assert len(admin_assets) == 10

        # Finally, the bot should also be able to paginate these assets
        assets = list(
            bot_ometa.paginate_es(entity=Table, query_filter=query_filter, size=2)
        )
        assert len(assets) == 10, f"Pagination validation for bot [{bot}]"
