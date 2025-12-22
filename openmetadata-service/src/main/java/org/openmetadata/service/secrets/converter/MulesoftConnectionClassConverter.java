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
import org.openmetadata.schema.security.credentials.BasicAuth;
import org.openmetadata.schema.services.connections.pipeline.MulesoftConnection;
import org.openmetadata.schema.services.connections.pipeline.airbyte.OAuthClientAuth;
import org.openmetadata.schema.utils.JsonUtils;

/** Converter class to get a `MulesoftConnection` object. */
public class MulesoftConnectionClassConverter extends ClassConverter {

  public MulesoftConnectionClassConverter() {
    super(MulesoftConnection.class);
  }

  @Override
  public Object convert(Object object) {
    MulesoftConnection mulesoftConnection =
        (MulesoftConnection) JsonUtils.convertValue(object, this.clazz);

    tryToConvertOrFail(mulesoftConnection.getAuthentication(), List.of(BasicAuth.class, OAuthClientAuth.class))
        .ifPresent(mulesoftConnection::setAuthentication);

    return mulesoftConnection;
  }
}
