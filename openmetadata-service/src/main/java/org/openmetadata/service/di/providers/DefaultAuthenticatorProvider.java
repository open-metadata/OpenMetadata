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

package org.openmetadata.service.di.providers;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.service.security.auth.AuthenticatorHandler;
import org.openmetadata.service.security.auth.BasicAuthenticator;
import org.openmetadata.service.security.auth.LdapAuthenticator;
import org.openmetadata.service.security.auth.NoopAuthenticator;

/**
 * Default OpenMetadata implementation of AuthenticatorProvider.
 *
 * <p>This implementation creates the appropriate AuthenticatorHandler based on the configured
 * authentication provider type:
 *
 * <ul>
 *   <li>BASIC - BasicAuthenticator for username/password authentication
 *   <li>LDAP - LdapAuthenticator for LDAP/Active Directory authentication
 *   <li>All others (Google, Okta, Azure, etc.) - NoopAuthenticator as auth is handled externally
 * </ul>
 *
 * <p>Collate can override this by providing its own implementation that returns custom
 * authenticators.
 */
@Slf4j
public class DefaultAuthenticatorProvider implements AuthenticatorProvider {

  @Override
  public AuthenticatorHandler getAuthenticator(AuthenticationConfiguration authConfig) {
    if (authConfig == null) {
      LOG.info("No authentication configuration provided, using NoopAuthenticator");
      return new NoopAuthenticator();
    }

    AuthenticatorHandler handler =
        switch (authConfig.getProvider()) {
          case BASIC -> {
            LOG.info("Creating BasicAuthenticator for BASIC auth provider");
            yield new BasicAuthenticator();
          }
          case LDAP -> {
            LOG.info("Creating LdapAuthenticator for LDAP auth provider");
            yield new LdapAuthenticator();
          }
          default -> {
            LOG.info(
                "Creating NoopAuthenticator for {} auth provider (handled externally)",
                authConfig.getProvider());
            yield new NoopAuthenticator();
          }
        };

    return handler;
  }
}
