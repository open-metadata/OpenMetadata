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

package org.openmetadata.client.security.factory;

import org.openmetadata.client.security.Auth0AuthenticationProvider;
import org.openmetadata.client.security.AzureAuthenticationProvider;
import org.openmetadata.client.security.CustomOIDCAuthenticationProvider;
import org.openmetadata.client.security.GoogleAuthenticationProvider;
import org.openmetadata.client.security.NoOpAuthenticationProvider;
import org.openmetadata.client.security.OktaAuthenticationProvider;
import org.openmetadata.client.security.OpenMetadataAuthenticationProvider;
import org.openmetadata.client.security.interfaces.AuthenticationProvider;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;

public class AuthenticationProviderFactory {
  public AuthenticationProvider getAuthProvider(OpenMetadataConnection serverConfig) {
    switch (serverConfig.getAuthProvider()) {
      case NO_AUTH:
        return new NoOpAuthenticationProvider();
      case GOOGLE:
        return new GoogleAuthenticationProvider(serverConfig);
      case OKTA:
        return new OktaAuthenticationProvider(serverConfig);
      case AUTH_0:
        return new Auth0AuthenticationProvider(serverConfig);
      case CUSTOM_OIDC:
        return new CustomOIDCAuthenticationProvider(serverConfig);
      case AZURE:
        return new AzureAuthenticationProvider(serverConfig);
      case OPENMETADATA:
        return new OpenMetadataAuthenticationProvider(serverConfig);
    }
    return null;
  }
}
