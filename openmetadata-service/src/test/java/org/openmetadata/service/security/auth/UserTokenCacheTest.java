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

package org.openmetadata.service.security.auth;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.github.benmanes.caffeine.cache.Ticker;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.security.AuthenticationException;
import org.openmetadata.service.security.credentials.CredentialSubject;
import org.openmetadata.service.security.credentials.CredentialVerificationConfig;
import org.openmetadata.service.security.credentials.CredentialVerifier;
import org.openmetadata.service.security.credentials.CredentialVerifierFixture;
import org.openmetadata.service.security.credentials.Credentials;
import org.openmetadata.service.security.credentials.OmCredential;

/** What other distributions get from {@link UserTokenCache#invalidateToken}. */
class UserTokenCacheTest {
  private static final String USER = "alice";
  private static final String TOKEN = "pat-1";

  private Object installedBefore;
  private CredentialVerifierFixture fixture;

  @BeforeEach
  void installAVerifierOverAnInMemorySource() throws ReflectiveOperationException {
    installedBefore = installedField().get(null);
    fixture =
        new CredentialVerifierFixture(
                new SimpleMeterRegistry(),
                Ticker.systemTicker(),
                CredentialVerificationConfig.defaults())
            .withPats(Map.of(USER, List.of(TOKEN)));
    Credentials.install(fixture.verifier());
  }

  // Credentials offers no uninstall outside its package, and other tests expect none installed.
  @AfterEach
  void restoreTheInstalledVerifier() throws ReflectiveOperationException {
    installedField().set(null, installedBefore);
    fixture.close();
  }

  @Test
  @SuppressWarnings("deprecation")
  void invalidatedUserIsCheckedAgainstTheStoredTokens() {
    CredentialVerifier verifier = fixture.verifier();
    assertDoesNotThrow(() -> require(verifier), "the PAT is current and now cached");
    fixture.removeTokensSilently(USER);
    assertDoesNotThrow(() -> require(verifier), "nothing told the verifier the PAT is gone");

    UserTokenCache.invalidateToken(USER);

    assertThrows(AuthenticationException.class, () -> require(verifier));
  }

  private static void require(CredentialVerifier verifier) {
    verifier.require(new OmCredential.Stored(CredentialSubject.of(USER)), TOKEN, "not current");
  }

  private static Field installedField() throws NoSuchFieldException {
    Field field = Credentials.class.getDeclaredField("installed");
    field.setAccessible(true);
    return field;
  }
}
