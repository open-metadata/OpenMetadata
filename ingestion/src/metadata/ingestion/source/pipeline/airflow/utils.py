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
Airflow metadata utils
"""

import traceback
from datetime import timedelta
from typing import Any, Dict, Optional

from metadata.utils.constants import TIMEDELTA
from metadata.utils.importer import import_from_module
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


def get_schedule_interval(pipeline_data: Dict[str, Any]) -> Optional[str]:
    """
    Fetch Schedule Intervals from Airflow Dags
    """
    try:
        timetable, schedule = pipeline_data.get("timetable", {}), pipeline_data.get(
            "schedule_interval", {}
        )

        if timetable:
            # Fetch Cron as String
            expression = timetable.get("__var", {}).get("expression")
            if expression:
                return expression

            expression_class = timetable.get("__type")
            if expression_class:
                try:
                    # Try to instantiate the timetable class safely
                    timetable_class = import_from_module(expression_class)
                    
                    # Handle special cases for classes that require arguments
                    if "DatasetTriggeredTimetable" in expression_class:
                        # DatasetTriggeredTimetable requires datasets argument
                        # For now, return a descriptive string since we can't instantiate it properly
                        return "Dataset Triggered"
                    elif "CronDataIntervalTimetable" in expression_class:
                        # Handle cron-based timetables
                        try:
                            return timetable_class().summary
                        except (TypeError, AttributeError):
                            return "Cron Based"
                    else:
                        # Try to instantiate with no arguments
                        try:
                            return timetable_class().summary
                        except (TypeError, AttributeError):
                            # If summary attribute doesn't exist, try to get a string representation
                            try:
                                instance = timetable_class()
                                return str(instance)
                            except TypeError:
                                # If instantiation fails, return the class name
                                return f"Custom Timetable ({expression_class.split('.')[-1]})"
                except ImportError as import_error:
                    logger.debug(f"Could not import timetable class {expression_class}: {import_error}")
                    return f"Custom Timetable ({expression_class.split('.')[-1]})"
                except TypeError as type_error:
                    # If instantiation fails due to missing arguments, log and continue
                    logger.debug(f"Could not instantiate timetable class {expression_class}: {type_error}")
                    return f"Custom Timetable ({expression_class.split('.')[-1]})"
                except Exception as inst_error:
                    logger.debug(f"Error instantiating timetable class {expression_class}: {inst_error}")
                    return f"Custom Timetable ({expression_class.split('.')[-1]})"

        if schedule:
            if isinstance(schedule, str):
                return schedule
            type_value = schedule.get("__type")
            if type_value == TIMEDELTA:
                var_value = schedule.get("__var", {})
                # types of schedule interval with timedelta
                # timedelta(days=1) = `1 day, 0:00:00`
                return str(timedelta(seconds=var_value))

        # If no timetable nor schedule, the DAG has no interval set
        return None

    except Exception as exc:
        logger.debug(traceback.format_exc())
        dag_id = pipeline_data.get('_dag_id', 'unknown')
        logger.warning(
            f"Couldn't fetch schedule interval for dag {dag_id}: {exc}"
        )
    return None
