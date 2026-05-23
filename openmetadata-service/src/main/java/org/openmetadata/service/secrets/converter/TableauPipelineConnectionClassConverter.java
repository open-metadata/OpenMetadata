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
import org.openmetadata.schema.security.credentials.AccessTokenAuth;
import org.openmetadata.schema.security.credentials.BasicAuth;
import org.openmetadata.schema.services.connections.pipeline.TableauPipelineConnection;
import org.openmetadata.schema.utils.JsonUtils;

public class TableauPipelineConnectionClassConverter extends ClassConverter {
  private static final List<Class<?>> CONNECTION_CLASSES =
      List.of(BasicAuth.class, AccessTokenAuth.class);

  public TableauPipelineConnectionClassConverter() {
    super(TableauPipelineConnection.class);
  }

  @Override
  public Object convert(Object object) {
    TableauPipelineConnection tableauPipelineConnection =
        (TableauPipelineConnection) JsonUtils.convertValue(object, this.clazz);

    tryToConvertOrFail(tableauPipelineConnection.getAuthType(), CONNECTION_CLASSES)
        .ifPresent(tableauPipelineConnection::setAuthType);

    return tableauPipelineConnection;
  }
}
