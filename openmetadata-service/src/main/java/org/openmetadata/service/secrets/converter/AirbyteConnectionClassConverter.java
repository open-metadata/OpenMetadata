/*
 *  Copyright 2025 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.secrets.converter;

import java.util.List;
import org.openmetadata.schema.services.connections.pipeline.AirbyteConnection;
import org.openmetadata.schema.services.connections.pipeline.airbyte.BasicAuth;
import org.openmetadata.schema.services.connections.pipeline.airbyte.OAuthClientAuth;
import org.openmetadata.schema.utils.JsonUtils;

/** Converter class to get an `AirbyteConnection` object. */
public class AirbyteConnectionClassConverter extends ClassConverter {

  public AirbyteConnectionClassConverter() {
    super(AirbyteConnection.class);
  }

  @Override
  public Object convert(Object object) {
    AirbyteConnection airbyteConnection =
        (AirbyteConnection) JsonUtils.convertValue(object, this.clazz);

    tryToConvertOrFail(airbyteConnection.getAuth(), List.of(BasicAuth.class, OAuthClientAuth.class))
        .ifPresent(airbyteConnection::setAuth);

    return airbyteConnection;
  }
}
