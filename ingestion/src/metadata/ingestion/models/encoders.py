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
Custom pydantic encoders
"""
from pydantic import SecretStr
from pydantic.json import pydantic_encoder

from metadata.ingestion.models.custom_pydantic import CustomSecretStr


def show_secrets_encoder(obj):
    """
    To be used as a custom encoder during .json()
    :param obj: Pydantic Model
    :return: JSON repr
    """
    if isinstance(obj, CustomSecretStr):
        return obj.get_secret_value(skip_secret_manager=True) if obj else None

    if isinstance(obj, SecretStr):
        return obj.get_secret_value() if obj else None

    return pydantic_encoder(obj)
