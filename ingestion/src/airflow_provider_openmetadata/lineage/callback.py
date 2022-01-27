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
OpenMetadata Airflow Lineage Backend
"""
import logging
from typing import TYPE_CHECKING, Dict

from airflow_provider_openmetadata.lineage.config import (
    get_lineage_config,
    get_metadata_config,
)
from airflow_provider_openmetadata.lineage.utils import (
    get_xlets,
    parse_lineage_to_openmetadata,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata

if TYPE_CHECKING:
    from airflow.models.baseoperator import BaseOperator


def lineage_callback(context: Dict[str, str]) -> None:
    """
    Add this function to the args of your DAG or Task
    as the value of `on_failure_callback` to track
    task status and lineage on failures.

    :param context: Airflow runtime context
    """
    try:
        config = get_lineage_config()
        metadata_config = get_metadata_config(config)
        client = OpenMetadata(metadata_config)

        operator: "BaseOperator" = context["task"]

        op_inlets = get_xlets(operator, "_inlets")
        op_outlets = get_xlets(operator, "_outlets")

        parse_lineage_to_openmetadata(
            config, context, operator, op_inlets, op_outlets, client
        )

    except Exception as exc:  # pylint: disable=broad-except
        logging.error(f"Lineage Callback exception {exc}")
