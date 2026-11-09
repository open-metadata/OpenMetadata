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
A pipeline FQN is a single path segment on every log endpoint, whatever characters the name has.
"""

from unittest.mock import MagicMock
from uuid import UUID

import pytest

from metadata.ingestion.ometa.mixins.logs_mixin import OMetaLogsMixin

RUN_ID = UUID("11111111-2222-4333-8444-555555555555")
FQN = 'Snowflake : Product/Eng NA."a.b"?#%'
ENCODED_FQN = "Snowflake%20%3A%20Product%2FEng%20NA.%22a.b%22%3F%23%25"
BASE = f"/services/ingestionPipelines/logs/{ENCODED_FQN}/{RUN_ID}"


@pytest.fixture
def mixin() -> OMetaLogsMixin:
    instance = OMetaLogsMixin()
    instance.client = MagicMock()
    return instance


@pytest.mark.parametrize(
    ("call", "client_method", "expected_url"),
    [
        (lambda m: m.send_logs_to_s3(FQN, RUN_ID, "line"), "post", BASE),
        (lambda m: m.send_logs_batch_best_effort(FQN, RUN_ID, "line"), "post_best_effort", BASE),
        (lambda m: m.send_close_best_effort(FQN, RUN_ID), "post_best_effort", f"{BASE}/close"),
        (lambda m: m.create_log_stream(FQN, RUN_ID), "post", BASE),
        (lambda m: m.close_log_stream(FQN, RUN_ID), "post", f"{BASE}/close"),
        (lambda m: m.get_logs_from_s3(FQN, RUN_ID), "get", BASE),
    ],
)
def test_pipeline_fqn_is_encoded_in_the_log_url(mixin, call, client_method, expected_url):
    call(mixin)

    assert getattr(mixin.client, client_method).call_args.args[0] == expected_url


def test_plain_fqn_keeps_its_url(mixin):
    mixin.send_logs_batch_best_effort("svc.my_pipeline", RUN_ID, "line")

    assert mixin.client.post_best_effort.call_args.args[0] == (
        f"/services/ingestionPipelines/logs/svc.my_pipeline/{RUN_ID}"
    )
