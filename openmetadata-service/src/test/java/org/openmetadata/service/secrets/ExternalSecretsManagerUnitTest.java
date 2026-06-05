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
package org.openmetadata.service.secrets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.service.exception.SecretsManagerException;

/**
 * Provider-agnostic tests for the orchestration in {@link ExternalSecretsManager}: the existence
 * check / store-vs-update routing, read-failure surfacing, store-failure labelling, and rate-limit
 * gating. A recording fake backend stands in for a real cloud SDK so behaviour is asserted directly
 * and deterministically — no {@code Thread.sleep}, no Docker, and no mocking of our own classes.
 */
class ExternalSecretsManagerUnitTest {

  private static final String SECRET_NAME = "/prefix/database/myservice/password";

  private static final SecretsManager.SecretsConfig CONFIG =
      new SecretsManager.SecretsConfig("openmetadata", "prefix", new ArrayList<>(), null);

  private final AtomicInteger throttleCalls = new AtomicInteger();
  private final SecretsManagerRateLimiter recordingLimiter = throttleCalls::incrementAndGet;

  @Test
  void upsertCreatesWhenSecretIsAbsentAndGatesReadThenWrite() {
    RecordingExternalSecretsManager manager = new RecordingExternalSecretsManager(recordingLimiter);

    manager.upsertSecret(SECRET_NAME, "first-value");

    assertEquals(List.of(SECRET_NAME), manager.stored, "an absent secret must be created");
    assertTrue(manager.updated.isEmpty(), "the create path must not call update");
    assertEquals("first-value", manager.store.get(SECRET_NAME));
    assertEquals(2, throttleCalls.get(), "upsert must gate the existence read and the write");
  }

  @Test
  void upsertUpdatesWhenSecretAlreadyExists() {
    RecordingExternalSecretsManager manager = new RecordingExternalSecretsManager(recordingLimiter);
    manager.upsertSecret(SECRET_NAME, "first-value");
    throttleCalls.set(0);

    manager.upsertSecret(SECRET_NAME, "rotated-value");

    assertEquals(List.of(SECRET_NAME), manager.updated, "an existing secret must be updated");
    assertEquals(1, manager.stored.size(), "update must not create a second secret");
    assertEquals("rotated-value", manager.store.get(SECRET_NAME));
    assertEquals(2, throttleCalls.get(), "upsert must gate the existence read and the write");
  }

  @Test
  void existSecretReturnsFalseOnGenuineNotFound() {
    RecordingExternalSecretsManager manager = new RecordingExternalSecretsManager(recordingLimiter);

    assertFalse(manager.existSecret("/prefix/missing"));
    assertEquals(1, throttleCalls.get(), "an existence check gates exactly one read");
  }

  @Test
  void existSecretSurfacesReadFailuresThatAreNotNotFound() {
    RecordingExternalSecretsManager manager = new RecordingExternalSecretsManager(recordingLimiter);
    manager.readFailure = new RuntimeException("AccessDenied: cannot decrypt the KMS key");

    SecretsManagerException thrown =
        assertThrows(SecretsManagerException.class, () -> manager.existSecret(SECRET_NAME));

    assertTrue(thrown.getMessage().contains("read failure"), "must be labelled as a read failure");
    assertTrue(thrown.getMessage().contains("AccessDenied"), "must carry the underlying cause");
  }

  @Test
  void upsertDoesNotCreateWhenTheExistenceCheckFailsForAReasonOtherThanNotFound() {
    RecordingExternalSecretsManager manager = new RecordingExternalSecretsManager(recordingLimiter);
    manager.readFailure = new RuntimeException("throttled by the backend");

    assertThrows(SecretsManagerException.class, () -> manager.upsertSecret(SECRET_NAME, "value"));

    assertTrue(manager.stored.isEmpty(), "a read failure must not be routed to the create path");
    assertTrue(manager.updated.isEmpty(), "a read failure must not be routed to the update path");
  }

  @Test
  void storeFailureNamesTheSecretBeingWritten() {
    RecordingExternalSecretsManager manager =
        new RecordingExternalSecretsManager(recordingLimiter) {
          @Override
          void storeSecret(String secretName, String secretValue) {
            throw new IllegalStateException("backend rejected the write");
          }
        };

    SecretsManagerException thrown =
        assertThrows(SecretsManagerException.class, () -> manager.upsertSecret(SECRET_NAME, "v"));

    assertTrue(
        thrown.getMessage().contains(SECRET_NAME), "must name the exact secret being stored");
    assertTrue(
        thrown.getMessage().contains("Failed to store secret"),
        "must be labelled as a store operation");
  }

  @Test
  void cleanNullOrEmptyMapsNullAndEmptyToTheNullSentinel() {
    RecordingExternalSecretsManager manager = new RecordingExternalSecretsManager(recordingLimiter);

    assertEquals(ExternalSecretsManager.NULL_SECRET_STRING, manager.cleanNullOrEmpty(null));
    assertEquals(ExternalSecretsManager.NULL_SECRET_STRING, manager.cleanNullOrEmpty(""));
    assertEquals("keep-me", manager.cleanNullOrEmpty("keep-me"));
  }

  @Test
  void theInjectedLimiterIsTheOneConsulted() {
    RecordingExternalSecretsManager manager =
        new RecordingExternalSecretsManager(SecretsManagerRateLimiter.noOp());

    manager.upsertSecret(SECRET_NAME, "value");

    assertEquals(List.of(SECRET_NAME), manager.stored, "the backend write must still happen");
    assertEquals(
        0, throttleCalls.get(), "a manager built with noOp must not touch the recording limiter");
  }

  private static class RecordingExternalSecretsManager extends ExternalSecretsManager {
    private final Map<String, String> store = new HashMap<>();
    private final List<String> stored = new ArrayList<>();
    private final List<String> updated = new ArrayList<>();
    private RuntimeException readFailure;

    RecordingExternalSecretsManager(SecretsManagerRateLimiter rateLimiter) {
      super(SecretsManagerProvider.IN_MEMORY, CONFIG, rateLimiter);
    }

    @Override
    void storeSecret(String secretName, String secretValue) {
      stored.add(secretName);
      store.put(secretName, secretValue);
    }

    @Override
    void updateSecret(String secretName, String secretValue) {
      updated.add(secretName);
      store.put(secretName, secretValue);
    }

    @Override
    String getSecret(String secretName) {
      if (readFailure != null) {
        throw readFailure;
      }
      String value = store.get(secretName);
      if (value == null) {
        throw new SecretNotFoundException(secretName);
      }
      return value;
    }

    @Override
    protected void deleteSecretInternal(String secretName) {
      store.remove(secretName);
    }

    @Override
    protected boolean isNotFoundException(Exception exception) {
      return exception instanceof SecretNotFoundException;
    }
  }

  private static class SecretNotFoundException extends RuntimeException {
    SecretNotFoundException(String secretName) {
      super("secret not found: " + secretName);
    }
  }
}
