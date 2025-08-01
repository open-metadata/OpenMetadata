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
Mixin class containing Suggestions specific methods

To be used by OpenMetadata class
"""
from typing import Union

from metadata.generated.schema.entity.feed.suggestion import Suggestion, SuggestionType
from metadata.generated.schema.type import basic
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.ingestion.ometa.client import REST
from metadata.ingestion.ometa.utils import model_str, quote
from metadata.utils.logger import ometa_logger

logger = ometa_logger()


class OMetaSuggestionsMixin:
    """
    OpenMetadata API methods related to the Suggestion Entity

    To be inherited by OpenMetadata
    """

    client: REST

    def update_suggestion(self, suggestion: Suggestion) -> Suggestion:
        """Update an existing Suggestion with new fields"""
        resp = self.client.put(
            f"{self.get_suffix(Suggestion)}/{str(suggestion.root.id.root)}",
            data=suggestion.model_dump_json(),
        )

        return Suggestion(**resp)

    def accept_suggestion(self, suggestion_id: Union[str, basic.Uuid]) -> None:
        """Accept a given suggestion"""
        self.client.put(
            f"{self.get_suffix(Suggestion)}/{model_str(suggestion_id)}/accept",
        )

    def reject_suggestion(self, suggestion_id: Union[str, basic.Uuid]) -> None:
        """Reject a given suggestion"""
        self.client.put(
            f"{self.get_suffix(Suggestion)}/{model_str(suggestion_id)}/reject",
        )

    def accept_all_suggestions(
        self,
        fqn: Union[str, FullyQualifiedEntityName],
        user_id: Union[str, basic.Uuid],
        suggestion_type: SuggestionType = SuggestionType.SuggestDescription,
    ) -> None:
        """Accept all suggestions"""
        self.client.put(
            f"{self.get_suffix(Suggestion)}/accept-all?"
            f"userId={model_str(user_id)}&"
            f"entityFQN={quote(fqn)}&"
            f"suggestionType={suggestion_type.value}",
        )

    def reject_all_suggestions(
        self,
        fqn: Union[str, FullyQualifiedEntityName],
        user_id: Union[str, basic.Uuid],
        suggestion_type: SuggestionType = SuggestionType.SuggestDescription,
    ) -> None:
        """Accept all suggestions"""
        self.client.put(
            f"{self.get_suffix(Suggestion)}/reject-all?"
            f"userId={model_str(user_id)}&"
            f"entityFQN={quote(fqn)}&"
            f"suggestionType={suggestion_type.value}",
        )
