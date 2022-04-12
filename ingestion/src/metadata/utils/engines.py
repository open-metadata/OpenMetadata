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
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm.session import Session

from metadata.generated.schema.entity.services.connections.connectionBasicType import (
    ConnectionOptions,
)
from metadata.generated.schema.entity.services.connections.serviceConnection import (
    ServiceConnection,
)
from metadata.utils.source_connections import get_connection_args, get_connection_url

logger = logging.getLogger("Utils")


class SourceConnectionException(Exception):
    """
    Raised when we cannot connect to the source
    """


def get_engine(service_connection: ServiceConnection, verbose: bool = False) -> Engine:
    """
    Given an SQL configuration, build the SQLAlchemy Engine
    """
    service_connection_config = service_connection.__root__.config

    options = service_connection_config.connectionOptions
    if not options:
        options = ConnectionOptions()

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


def test_connection(engine: Engine) -> None:
    """
    Test that we can connect to the source using the given engine
    :param engine: Engine to test
    :return: None or raise an exception if we cannot connect
    """
    try:
        with engine.connect() as _:
            pass
    except OperationalError as err:
        raise SourceConnectionException(
            f"Connection error for {engine} - {err}. Check the connection details."
        )
    except Exception as err:
        raise SourceConnectionException(
            f"Unknown error connecting with {engine} - {err}."
        )
