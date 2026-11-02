/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;

import org.junit.jupiter.api.Test;
import org.openmetadata.service.security.auth.AuthenticatorHandler;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;

/** When a security reload registers the authenticator it built. */
class OpenMetadataApplicationAuthReloadTest {
  private final AuthenticatorHandler previousAuthenticator = mock(AuthenticatorHandler.class);
  private final AuthenticatorHandler currentAuthenticator = mock(AuthenticatorHandler.class);

  @Test
  void aReloadedAuthenticatorIsRegisteredOnlyOnceItIsInitialized() {
    SecurityConfigurationManager registry = SecurityConfigurationManager.getInstance();
    AuthenticatorHandler registeredBefore = registry.getAuthenticatorHandler();
    registry.setAuthenticatorHandler(previousAuthenticator);
    try {
      doAnswer(
              init -> {
                assertSame(previousAuthenticator, registry.getAuthenticatorHandler());
                return null;
              })
          .when(currentAuthenticator)
          .init(any());

      OpenMetadataApplication.initializeThenPublish(
          currentAuthenticator, mock(OpenMetadataApplicationConfig.class));

      assertSame(currentAuthenticator, registry.getAuthenticatorHandler());
    } finally {
      registry.setAuthenticatorHandler(registeredBefore);
    }
  }

  @Test
  void aReloadedAuthenticatorThatFailsToStartIsNeverRegistered() {
    SecurityConfigurationManager registry = SecurityConfigurationManager.getInstance();
    AuthenticatorHandler registeredBefore = registry.getAuthenticatorHandler();
    registry.setAuthenticatorHandler(previousAuthenticator);
    try {
      doThrow(new IllegalStateException("directory unreachable"))
          .when(currentAuthenticator)
          .init(any());

      assertThrows(
          IllegalStateException.class,
          () ->
              OpenMetadataApplication.initializeThenPublish(
                  currentAuthenticator, mock(OpenMetadataApplicationConfig.class)));

      assertSame(previousAuthenticator, registry.getAuthenticatorHandler());
    } finally {
      registry.setAuthenticatorHandler(registeredBefore);
    }
  }
}
