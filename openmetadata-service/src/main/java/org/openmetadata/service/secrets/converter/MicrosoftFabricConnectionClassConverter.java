/*
 *  Copyright 2026 Collate
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
import org.openmetadata.schema.services.connections.database.MicrosoftFabricConnection;
import org.openmetadata.schema.services.connections.database.microsoftFabric.CertificateAuthentication;
import org.openmetadata.schema.services.connections.database.microsoftFabric.ClientSecretAuthentication;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Converter class to get a `MicrosoftFabricConnection` object.
 *
 * <p>Strict on `authType`: a payload matching neither option (one that mixes a client secret with
 * a certificate) is rejected rather than kept as a map, which would store its secrets unencrypted
 * and return them unmasked.
 */
public class MicrosoftFabricConnectionClassConverter extends ClassConverter {

  private static final List<Class<?>> AUTH_TYPE_CLASSES =
      List.of(ClientSecretAuthentication.class, CertificateAuthentication.class);

  public MicrosoftFabricConnectionClassConverter() {
    super(MicrosoftFabricConnection.class);
  }

  @Override
  public Object convert(Object object) {
    MicrosoftFabricConnection microsoftFabricConnection =
        (MicrosoftFabricConnection) JsonUtils.convertValue(object, this.clazz);

    tryToConvertOrFail(microsoftFabricConnection.getAuthType(), AUTH_TYPE_CLASSES)
        .ifPresent(microsoftFabricConnection::setAuthType);

    return microsoftFabricConnection;
  }
}
