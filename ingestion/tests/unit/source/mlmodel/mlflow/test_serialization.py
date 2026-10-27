#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""Check the serialization dependencies used by the MLflow integration fixtures."""

from pathlib import Path

import mlflow.sklearn
import pytest
from sklearn.linear_model import LinearRegression


def test_default_serialization_round_trip(tmp_path: Path) -> None:
    model = LinearRegression().fit([[0], [1], [2]], [0, 2, 4])
    path = tmp_path / "model"

    mlflow.sklearn.save_model(model, str(path), pip_requirements=[])
    loaded = mlflow.sklearn.load_model(str(path))

    assert loaded.predict([[3]])[0] == pytest.approx(6)
