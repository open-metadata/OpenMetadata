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
Looker-specific Liquid template tag extensions.
Handles condition and incrementcondition tags for SQL generation.
"""
from functools import lru_cache

from liquid import Environment, Template


class TemplateTagError(Exception):
    """Raised when template tag processing fails"""


@lru_cache(maxsize=1)
def _build_template_environment() -> Environment:
    """
    Build Liquid environment with Looker-specific extensions.
    Cached for performance.

    Note: Custom tags (condition, incrementcondition) are handled via
    template preprocessing rather than custom tag classes due to
    liquid library version compatibility.
    """
    env: Environment = Environment(strict_filters=False)
    return env


def _preprocess_looker_tags(text: str) -> str:
    """
    Preprocess Looker-specific tags before template rendering.

    Converts:
    - {% condition filter %} field {% endcondition %} -> field='placeholder_value'
    - {% incrementcondition key %} field {% endincrementcondition %} -> field > '2023-01-01'
    """
    import re

    # Handle condition tags
    condition_pattern = r"\{%\s*condition\s+\w+\s*%\}(.*?)\{%\s*endcondition\s*%\}"
    text = re.sub(
        condition_pattern,
        lambda m: f"{m.group(1).strip()}='placeholder_value'",
        text,
        flags=re.DOTALL,
    )

    # Handle incrementcondition tags
    increment_pattern = (
        r"\{%\s*incrementcondition\s+\w+\s*%\}(.*?)\{%\s*endincrementcondition\s*%\}"
    )
    text = re.sub(
        increment_pattern,
        lambda m: f"{m.group(1).strip()} > '2023-01-01'",
        text,
        flags=re.DOTALL,
    )

    return text


def build_liquid_template(source: str) -> Template:
    """
    Create executable Liquid template with Looker extensions.

    Preprocesses Looker-specific tags before creating template.
    """
    env: Environment = _build_template_environment()
    preprocessed = _preprocess_looker_tags(source)
    return env.from_string(preprocessed)


def apply_sql_quotes(value: str) -> str:
    """Wraps values in SQL single quotes"""
    return f"'{value}'"
