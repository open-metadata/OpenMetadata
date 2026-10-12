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

from metadata.pii.algorithms.utils import get_top_classes


def test_get_top_classes_breaks_score_ties_deterministically():
    scores = {"NRP": 0.425, "LOCATION": 0.425}

    assert get_top_classes(scores, n=1, threshold=0.0) == ["LOCATION"]
    assert get_top_classes(dict(reversed(scores.items())), n=1, threshold=0.0) == ["LOCATION"]
