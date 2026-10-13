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
import java.util.Optional;
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
  private static final String AMBIGUOUS_AUTH_TYPE_MESSAGE =
      "Microsoft Fabric authType must match exactly one authentication option: a client secret,"
          + " or a certificate with its private key.";

  public MicrosoftFabricConnectionClassConverter() {
    super(MicrosoftFabricConnection.class);
  }

  @Override
  public Object convert(Object object) {
    MicrosoftFabricConnection microsoftFabricConnection =
        (MicrosoftFabricConnection) JsonUtils.convertValue(object, this.clazz);

    typedAuthType(microsoftFabricConnection.getAuthType())
        .ifPresent(microsoftFabricConnection::setAuthType);

    return microsoftFabricConnection;
  }

  private Optional<Object> typedAuthType(Object authType) {
    try {
      return tryToConvertOrFail(authType, AUTH_TYPE_CLASSES);
    } catch (IllegalArgumentException e) {
      throw new IllegalArgumentException(AMBIGUOUS_AUTH_TYPE_MESSAGE, e);
    }
  }
}
