/*
 *  Copyright 2021 Collate
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
import org.openmetadata.schema.security.client.Auth0SSOClientConfig;
import org.openmetadata.schema.security.client.AzureSSOClientConfig;
import org.openmetadata.schema.security.client.CustomOIDCSSOClientConfig;
import org.openmetadata.schema.security.client.GoogleSSOClientConfig;
import org.openmetadata.schema.security.client.OktaSSOClientConfig;
import org.openmetadata.schema.security.client.OpenMetadataJWTClientConfig;
import org.openmetadata.schema.security.credentials.AWSCredentials;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.service.util.JsonUtils;

/** Converter class to get an `OpenMetadataConnection` object. */
public class OpenMetadataConnectionClassConverter extends ClassConverter {

  private static final List<Class<?>> SECURITY_CONFIG_CLASSES =
      List.of(
          OpenMetadataJWTClientConfig.class,
          GoogleSSOClientConfig.class,
          OktaSSOClientConfig.class,
          Auth0SSOClientConfig.class,
          AzureSSOClientConfig.class,
          CustomOIDCSSOClientConfig.class);

  private static final List<Class<?>> SECRET_MANAGER_CREDENTIALS_CLASSES = List.of(AWSCredentials.class);

  public OpenMetadataConnectionClassConverter() {
    super(OpenMetadataConnection.class);
  }

  @Override
  public Object convert(Object connectionConfig) {
    OpenMetadataConnection openMetadataConnection =
        (OpenMetadataConnection) JsonUtils.convertValue(connectionConfig, this.clazz);

    tryToConvertOrFail(openMetadataConnection.getSecurityConfig(), SECURITY_CONFIG_CLASSES)
        .ifPresent(openMetadataConnection::setSecurityConfig);
    tryToConvertOrFail(openMetadataConnection.getSecretsManagerCredentials(), SECRET_MANAGER_CREDENTIALS_CLASSES)
        .ifPresent(openMetadataConnection::setSecretsManagerCredentials);

    return openMetadataConnection;
  }
}
