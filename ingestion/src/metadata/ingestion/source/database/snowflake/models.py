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
Snowflake models
"""
from typing import Optional

from pydantic import BaseModel, Field, validator
from requests.utils import quote

from metadata.generated.schema.entity.data.storedProcedure import Language
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

STORED_PROC_LANGUAGE_MAP = {
    "PYTHON": Language.Python,
    "SQL": Language.SQL,
    "JAVA": Language.Java,
    "JAVASCRIPT": Language.JavaScript,
}


class SnowflakeStoredProcedure(BaseModel):
    """Snowflake stored procedure list query results"""

    name: str = Field(..., alias="NAME")
    owner: Optional[str] = Field(..., alias="OWNER")
    language: str = Field(..., alias="LANGUAGE")
    definition: str = Field(None, alias="DEFINITION")
    signature: Optional[str] = Field(
        ..., alias="SIGNATURE", description="Used to build the source URL"
    )
    comment: Optional[str] = Field(..., alias="COMMENT")

    # Update the signature to clean it up on read
    @validator("signature")
    def clean_signature(  # pylint: disable=no-self-argument
        cls, signature
    ) -> Optional[str]:
        """
        pylint: keeping the approach from pydantic docs

        A signature may look like `(TABLE_NAME VARCHAR, NAME VARCHAR)`
        We want it to keep only `(VARCHAR, VARCHAR).

        This is needed to build the source URL of the procedure, so we'll
        directly parse the quoted signature
        """
        try:
            clean_signature = signature.replace("(", "").replace(")", "")
            if not clean_signature:
                return None

            signature_list = clean_signature.split(",")
            clean_signature_list = [elem.split(" ")[-1] for elem in signature_list]

            return f"({quote(', '.join(clean_signature_list))})"
        except Exception as exc:
            logger.warning(f"Error cleaning up Stored Procedure signature - [{exc}]")
            return signature
