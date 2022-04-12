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
Build and document all supported Engines
"""
import logging

from sqlalchemy import create_engine
from sqlalchemy.engine.base import Engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm.session import Session

from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.utils.source_connections import get_connection_args, get_connection_url

logger = logging.getLogger("Utils")


def get_engine(workflow_source: WorkflowSource, verbose: bool = False) -> Engine:
    """
    Given an SQL configuration, build the SQLAlchemy Engine
    """
    logger.info(f"Building Engine for {workflow_source.serviceName}...")
    service_connection_config = workflow_source.serviceConnection.__root__.config
    options = service_connection_config.connectionOptions
    if not options:
        options = {}
    engine = create_engine(
        get_connection_url(service_connection_config),
        **options.dict(),
        connect_args=get_connection_args(service_connection_config),
        echo=verbose,
    )

    return engine


def create_and_bind_session(engine: Engine) -> Session:
    """
    Given an engine, create a session bound
    to it to make our operations.
    """
    session = sessionmaker()
    session.configure(bind=engine)
    return session()
