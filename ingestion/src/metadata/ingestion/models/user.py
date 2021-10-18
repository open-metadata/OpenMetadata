#  Licensed to the Apache Software Foundation (ASF) under one or more
#  contributor license agreements. See the NOTICE file distributed with
#  this work for additional information regarding copyright ownership.
#  The ASF licenses this file to You under the Apache License, Version 2.0
#  (the "License"); you may not use this file except in compliance with
#  the License. You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

import copy
import json
from typing import Any, Dict, List, Optional

from metadata.ingestion.models.json_serializable import JsonSerializable

UNQUOTED_SUFFIX = ":UNQUOTED"


class User(JsonSerializable):
    """
    User model. This model doesn't define any relationship.
    """

    USER_NODE_LABEL = "User"
    USER_NODE_KEY_FORMAT = "{email}"
    USER_NODE_EMAIL = "email"
    USER_NODE_FIRST_NAME = "first_name"
    USER_NODE_LAST_NAME = "last_name"
    USER_NODE_FULL_NAME = "full_name"
    USER_NODE_GITHUB_NAME = "github_username"
    USER_NODE_TEAM = "team_name"
    USER_NODE_EMPLOYEE_TYPE = "employee_type"
    USER_NODE_MANAGER_EMAIL = "manager_email"
    USER_NODE_SLACK_ID = "slack_id"
    USER_NODE_IS_ACTIVE = "is_active{}".format(
        UNQUOTED_SUFFIX
    )  # bool value needs to be unquoted when publish to neo4j
    USER_NODE_UPDATED_AT = "updated_at"
    USER_NODE_ROLE_NAME = "role_name"

    USER_MANAGER_RELATION_TYPE = "MANAGE_BY"
    MANAGER_USER_RELATION_TYPE = "MANAGE"

    def __init__(
        self,
        email: str,
        first_name: str = "",
        last_name: str = "",
        name: str = "",
        github_username: str = "",
        team_name: str = "",
        employee_type: str = "",
        manager_email: str = "",
        slack_id: str = "",
        is_active: bool = True,
        updated_at: int = 0,
        role_name: str = "",
        do_not_update_empty_attribute: bool = False,
        **kwargs: Any
    ) -> None:
        """
        This class models user node for Amundsen people.

        :param first_name:
        :param last_name:
        :param name:
        :param email:
        :param github_username:
        :param team_name:
        :param employee_type:
        :param manager_email:
        :param is_active:
        :param updated_at: everytime we update the node, we will push the timestamp.
                           then we will have a cron job to update the ex-employee nodes based on
                           the case if this timestamp hasn't been updated for two weeks.
        :param role_name: the role_name of the user (e.g swe)
        :param do_not_update_empty_attribute: If False, all empty or not defined params will be overwritten with
        empty string.
        :param kwargs: Any K/V attributes we want to update the
        """
        self.first_name = first_name
        self.last_name = last_name
        self.name = name

        self.email = email
        self.github_username = github_username
        # todo: team will be a separate node once Amundsen People supports team
        self.team_name = team_name
        self.manager_email = manager_email
        self.employee_type = employee_type
        # this attr not available in team service, either update team service, update with FE
        self.slack_id = slack_id
        self.is_active = is_active
        self.updated_at = updated_at
        self.role_name = role_name
        self.do_not_update_empty_attribute = do_not_update_empty_attribute
        self.attrs = None
        if kwargs:
            self.attrs = copy.deepcopy(kwargs)


class MetadataUser(JsonSerializable):
    """
    Catalog User model. This model doesn't define any relationship.
    """

    def __init__(
        self,
        name: str,
        display_name: str,
        email: str,
        timezone: str = "PST",
        isBot: bool = False,
        teams: [] = None,
        **kwargs: Any
    ) -> None:
        """ """
        self.name = name
        self.display_name = display_name
        self.email = email
        self.timezone = timezone
        self.isBot = isBot
        self.teams = teams
        if kwargs:
            self.attrs = copy.deepcopy(kwargs)


class MetadataOrg(JsonSerializable):
    """
    Catalog Org Model
    """

    def __init__(self, name: str, documentation: str = "") -> None:
        """ """
        self.name = name
        self.documentation = documentation


class MetadataTeam(JsonSerializable):
    """
    Catalog Team Model
    """

    def __init__(self, name: str, display_name: str, description: str = "") -> None:
        """ """
        self.name = name.replace(" ", "_")
        self.display_name = name
        self.description = description


class MetadataRole(JsonSerializable):
    """
    Catalog Role
    """

    def __init__(self, name: str, documentation: str = ""):
        """ """
        self.name = name
        self.documentation = documentation
