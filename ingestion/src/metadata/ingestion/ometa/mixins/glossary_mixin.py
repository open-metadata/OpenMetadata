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
Mixin class containing Glossaries specific methods

To be used be OpenMetadata
"""
from typing import TypeVar

from pydantic import BaseModel

from metadata.generated.schema.entity.data.glossary import Glossary
from metadata.generated.schema.entity.data.glossaryTerm import GlossaryTerm
from metadata.utils.logger import ometa_logger

T = TypeVar("T", bound=BaseModel)
logger = ometa_logger()


class GlossaryMixin:
    """
    OpenMetadata API methods related to Glossaries.

    To be inherited by OpenMetadata
    """

    def create_glossary(self, glossaries_body):
        """Method to create new Glossary
        Args:
            entity: Type to create
            glossaries_body (Glossary): body of the request
        """
        resp = self.client.put(
            path=self.get_suffix(Glossary), data=glossaries_body.json()
        )
        logger.info(f"Created a Glossary: {resp}")

    def create_glossary_term(self, glossary_term_body):
        """Method to create new Glossary Term
        Args:
            glossary_term_body (Glossary): body of the request
        """
        resp = self.client.put(
            path=self.get_suffix(GlossaryTerm), data=glossary_term_body.json()
        )
        logger.info(f"Created a Glossary Term: {resp}")
