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
"""Failure contract for unavailable auto-classification language models."""


class ClassificationModelLoadError(Exception):
    """A model operation failed; classification cannot continue for this run."""

    def __init__(
        self,
        model_name: str,
        requested_language: str | None,
        effective_language: str | None,
        phase: str,
    ):
        self.model_name = model_name
        self.requested_language = requested_language
        self.effective_language = effective_language
        self.phase = phase
        language = requested_language or effective_language
        guidance = (
            f"Run `metadata install-classification-models --languages {language}` in the ingestion runner's "
            "Python environment, then rerun the workflow."
            if language
            else "Repair this model in the ingestion runner's Python environment, then rerun the workflow. "
            "See `metadata install-classification-models --help`."
        )
        super().__init__(
            f"Classification model '{model_name}' is unavailable during {phase} "
            f"(requested language: {requested_language or 'default'}, "
            f"effective language: {effective_language or 'unknown'}). {guidance}"
        )

    def __str__(self) -> str:
        message = super().__str__()
        if self.__cause__ is not None:
            return f"{message} Cause type: {type(self.__cause__).__name__}."
        return message
