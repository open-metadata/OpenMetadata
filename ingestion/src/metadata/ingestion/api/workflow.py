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

import importlib
import logging
import uuid
from typing import Optional, Type, TypeVar

import click
from pydantic import Field

from metadata.config.common import (
    ConfigModel,
    DynamicTypedConfig,
    WorkflowExecutionError,
)
from metadata.ingestion.api.bulk_sink import BulkSink
from metadata.ingestion.api.common import WorkflowContext
from metadata.ingestion.api.processor import Processor
from metadata.ingestion.api.sink import Sink
from metadata.ingestion.api.source import Source
from metadata.ingestion.api.stage import Stage

logger = logging.getLogger(__name__)

T = TypeVar("T")


class WorkflowConfig(ConfigModel):
    run_id: str = Field(default_factory=lambda: str(uuid.uuid1()))
    source: DynamicTypedConfig
    metadata_server: DynamicTypedConfig
    processor: Optional[DynamicTypedConfig] = None
    sink: Optional[DynamicTypedConfig] = None
    stage: Optional[DynamicTypedConfig] = None
    bulk_sink: Optional[DynamicTypedConfig] = None


class Workflow:
    config: WorkflowConfig
    ctx: WorkflowContext
    source: Source
    processor: Processor
    stage: Stage
    sink: Sink
    bulk_sink: BulkSink
    report = {}

    def __init__(self, config: WorkflowConfig):
        self.config = config
        self.ctx = WorkflowContext(workflow_id=self.config.run_id)
        source_type = self.config.source.type
        source_class = self.get(
            "metadata.ingestion.source.{}.{}Source".format(
                self.typeClassFetch(source_type, True),
                self.typeClassFetch(source_type, False),
            )
        )
        metadata_config = self.config.metadata_server.dict().get("config", {})
        self.source: Source = source_class.create(
            self.config.source.dict().get("config", {}), metadata_config, self.ctx
        )
        logger.debug(f"Source type:{source_type},{source_class} configured")
        self.source.prepare()
        logger.debug(f"Source type:{source_type},{source_class}  prepared")

        if self.config.processor:
            processor_type = self.config.processor.type
            processor_class = self.get(
                "metadata.ingestion.processor.{}.{}Processor".format(
                    self.typeClassFetch(processor_type, True),
                    self.typeClassFetch(processor_type, False),
                )
            )
            processor_config = self.config.processor.dict().get("config", {})
            self.processor: Processor = processor_class.create(
                processor_config, metadata_config, self.ctx
            )
            logger.debug(
                f"Processor Type: {processor_type}, {processor_class} configured"
            )

        if self.config.stage:
            stage_type = self.config.stage.type
            stage_class = self.get(
                "metadata.ingestion.stage.{}.{}Stage".format(
                    self.typeClassFetch(stage_type, True),
                    self.typeClassFetch(stage_type, False),
                )
            )
            stage_config = self.config.stage.dict().get("config", {})
            self.stage: Stage = stage_class.create(
                stage_config, metadata_config, self.ctx
            )
            logger.debug(f"Stage Type: {stage_type}, {stage_class} configured")

        if self.config.sink:
            sink_type = self.config.sink.type
            sink_class = self.get(
                "metadata.ingestion.sink.{}.{}Sink".format(
                    self.typeClassFetch(sink_type, True),
                    self.typeClassFetch(sink_type, False),
                )
            )
            sink_config = self.config.sink.dict().get("config", {})
            self.sink: Sink = sink_class.create(sink_config, metadata_config, self.ctx)
            logger.debug(f"Sink type:{self.config.sink.type},{sink_class} configured")

        if self.config.bulk_sink:
            bulk_sink_type = self.config.bulk_sink.type
            bulk_sink_class = self.get(
                "metadata.ingestion.bulksink.{}.{}BulkSink".format(
                    self.typeClassFetch(bulk_sink_type, True),
                    self.typeClassFetch(bulk_sink_type, False),
                )
            )
            bulk_sink_config = self.config.bulk_sink.dict().get("config", {})
            self.bulk_sink: BulkSink = bulk_sink_class.create(
                bulk_sink_config, metadata_config, self.ctx
            )
            logger.info(
                f"BulkSink type:{self.config.bulk_sink.type},{bulk_sink_class} configured"
            )

    def typeClassFetch(self, type: str, isFile: bool):
        if isFile:
            return type.replace("-", "_")
        else:
            return "".join([i.title() for i in type.replace("-", "_").split("_")])

    def get(self, key: str) -> Type[T]:
        if key.find(".") >= 0:
            # If the key contains a dot, we treat it as a import path and attempt
            # to load it dynamically.
            module_name, class_name = key.rsplit(".", 1)
            MyClass = getattr(importlib.import_module(module_name), class_name)
            return MyClass

    @classmethod
    def create(cls, config_dict: dict) -> "Workflow":
        config = WorkflowConfig.parse_obj(config_dict)
        return cls(config)

    def execute(self):
        for record in self.source.next_record():
            self.report["Source"] = self.source.get_status().as_obj()
            if hasattr(self, "processor"):
                processed_record = self.processor.process(record)
            else:
                processed_record = record
            if hasattr(self, "stage"):
                self.stage.stage_record(processed_record)
                self.report["Stage"] = self.stage.get_status().as_obj()
            if hasattr(self, "sink"):
                self.sink.write_record(processed_record)
                self.report["sink"] = self.sink.get_status().as_obj()

    def stop(self):
        if hasattr(self, "processor"):
            self.processor.close()
        if hasattr(self, "stage"):
            self.stage.close()
        if hasattr(self, "bulk_sink"):
            self.bulk_sink.write_records()
            self.report["Bulk_Sink"] = self.bulk_sink.get_status().as_obj()
            self.bulk_sink.close()
        if hasattr(self, "sink"):
            self.sink.close()
        self.source.close()

    def raise_from_status(self, raise_warnings=False):
        if self.source.get_status().failures:
            raise WorkflowExecutionError(
                "Source reported errors", self.source.get_status()
            )
        if hasattr(self, "sink") and self.sink.get_status().failures:
            raise WorkflowExecutionError("Sink reported errors", self.sink.get_status())
        if hasattr(self, "stage") and self.stage.get_status().failures:
            raise WorkflowExecutionError(
                "stage reported errors", self.stage.get_status()
            )
        if hasattr(self, "bulk_sink") and self.bulk_sink.get_status().failures:
            raise WorkflowExecutionError(
                "Bulk Sink reported errors", self.bulk_sink.get_status()
            )
        if raise_warnings and (
            self.source.get_status().warnings or self.sink.get_status().warnings
        ):
            raise WorkflowExecutionError(
                "Source reported warnings", self.source.get_status()
            )

    def print_status(self) -> int:
        click.echo()
        click.secho("Source Status:", bold=True)
        click.echo(self.source.get_status().as_string())
        if hasattr(self, "stage"):
            click.secho("Stage Status:", bold=True)
            click.echo(self.stage.get_status().as_string())
            click.echo()
        if hasattr(self, "sink"):
            click.secho("Sink Status:", bold=True)
            click.echo(self.sink.get_status().as_string())
            click.echo()
        if hasattr(self, "bulk_sink"):
            click.secho("Bulk Sink Status:", bold=True)
            click.echo(self.bulk_sink.get_status().as_string())
            click.echo()

        if self.source.get_status().failures or (
            hasattr(self, "sink") and self.sink.get_status().failures
        ):
            click.secho("Workflow finished with failures", fg="bright_red", bold=True)
            return 1
        elif self.source.get_status().warnings or (
            hasattr(self, "sink") and self.sink.get_status().warnings
        ):
            click.secho("Workflow finished with warnings", fg="yellow", bold=True)
            return 0
        else:
            click.secho("Workflow finished successfully", fg="green", bold=True)
            return 0
