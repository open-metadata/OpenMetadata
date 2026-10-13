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

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.Test;
import org.openmetadata.service.security.AuthServeletHandler;
import org.openmetadata.service.security.auth.AuthenticatorHandler;

/** Which auth handlers a security reload closes, whether or not the reload itself succeeded. */
class OpenMetadataApplicationAuthReloadTest {
  private final AuthServeletHandler previousHandler = mock(AuthServeletHandler.class);
  private final AuthServeletHandler currentHandler = mock(AuthServeletHandler.class);
  private final AuthenticatorHandler previousAuthenticator = mock(AuthenticatorHandler.class);
  private final AuthenticatorHandler currentAuthenticator = mock(AuthenticatorHandler.class);

  @Test
  void closesTheHandlersAReloadReplacedEvenIfItFailedAfterTheSwap() {
    OpenMetadataApplication.closeReplacedAuthHandlers(
        previousHandler, currentHandler, previousAuthenticator, currentAuthenticator);

    verify(previousHandler).close();
    verify(previousAuthenticator).close();
    verify(currentHandler, never()).close();
    verify(currentAuthenticator, never()).close();
  }

  @Test
  void leavesOpenTheHandlersAReloadNeverReplaced() {
    // A reload that failed before reaching the swap leaves the old handlers serving logins.
    OpenMetadataApplication.closeReplacedAuthHandlers(
        previousHandler, previousHandler, previousAuthenticator, previousAuthenticator);

    verify(previousHandler, never()).close();
    verify(previousAuthenticator, never()).close();
  }

  @Test
  void aFailingCloseNeitherEscapesNorSkipsTheOtherHandler() {
    doThrow(new IllegalStateException("pool already gone")).when(previousHandler).close();

    assertDoesNotThrow(
        () ->
            OpenMetadataApplication.closeReplacedAuthHandlers(
                previousHandler, currentHandler, previousAuthenticator, currentAuthenticator));

    verify(previousAuthenticator).close();
  }
}
