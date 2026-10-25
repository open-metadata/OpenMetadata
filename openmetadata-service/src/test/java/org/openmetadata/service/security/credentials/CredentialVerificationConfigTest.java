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

package org.openmetadata.service.security.credentials;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import io.dropwizard.jackson.Jackson;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;

class CredentialVerificationConfigTest {
  private static final ObjectMapper YAML = Jackson.newObjectMapper(new YAMLFactory());

  private static CredentialVerificationConfig parse(String yaml) throws Exception {
    return YAML.readValue(yaml, CredentialVerificationConfig.class);
  }

  private static String message(String yaml) {
    return assertThrows(Exception.class, () -> parse(yaml)).getMessage();
  }

  private static long nanos(long value, TimeUnit unit) {
    return unit.toNanos(value);
  }

  @Test
  void emptyBlockTakesEveryDefault() throws Exception {
    CredentialVerificationConfig config = parse("{}");

    assertEquals(CredentialVerificationConfig.defaults(), config);
    assertEquals(nanos(5, TimeUnit.SECONDS), config.maxStalenessNanos());
    assertEquals(nanos(2, TimeUnit.SECONDS), config.sweepIntervalNanos());
    assertEquals(nanos(500, TimeUnit.MILLISECONDS), config.missRefreshMinAgeNanos());
    assertEquals(nanos(2, TimeUnit.SECONDS), config.loadTimeoutNanos());
    assertEquals(nanos(15, TimeUnit.MINUTES), config.idleExpiryNanos());
    assertEquals(nanos(10, TimeUnit.MINUTES), config.deepVerifyIntervalNanos());
    assertEquals(16, config.maxConcurrentRequestReads());
    assertEquals(4000, config.maxSubjects());
    assertEquals(500, config.batchSize());
  }

  @Test
  void partialBlockOverridesOnlyWhatItNames() throws Exception {
    CredentialVerificationConfig config = parse("maxStaleness: 10s\nbatchSize: 100\n");

    assertEquals(nanos(10, TimeUnit.SECONDS), config.maxStalenessNanos());
    assertEquals(100, config.batchSize());
    assertEquals(nanos(2, TimeUnit.SECONDS), config.sweepIntervalNanos());
    assertEquals(4000, config.maxSubjects());
  }

  @Test
  void fullBlockParsesEveryField() throws Exception {
    CredentialVerificationConfig config =
        parse(
            "maxStaleness: 8s\nsweepInterval: 3s\nmissRefreshMinAge: 250ms\nloadTimeout: 4s\n"
                + "maxConcurrentRequestReads: 8\nidleExpiry: 30m\nmaxSubjects: 900\n"
                + "batchSize: 300\ndeepVerifyInterval: 1h\n");

    assertEquals(nanos(8, TimeUnit.SECONDS), config.maxStalenessNanos());
    assertEquals(nanos(3, TimeUnit.SECONDS), config.sweepIntervalNanos());
    assertEquals(nanos(250, TimeUnit.MILLISECONDS), config.missRefreshMinAgeNanos());
    assertEquals(nanos(4, TimeUnit.SECONDS), config.loadTimeoutNanos());
    assertEquals(8, config.maxConcurrentRequestReads());
    assertEquals(nanos(30, TimeUnit.MINUTES), config.idleExpiryNanos());
    assertEquals(900, config.maxSubjects());
    assertEquals(300, config.batchSize());
    assertEquals(nanos(1, TimeUnit.HOURS), config.deepVerifyIntervalNanos());
  }

  @Test
  void sweepIntervalMayBeExactlyHalfOfMaxStalenessButNotMore() {
    assertDoesNotThrow(() -> parse("maxStaleness: 4s\nsweepInterval: 2s\nloadTimeout: 1s\n"));
    assertTrue(
        message("maxStaleness: 4s\nsweepInterval: 2001ms\nloadTimeout: 1s\n")
            .contains("sweepInterval"));
  }

  @Test
  void missRefreshMinAgeMustBePositiveAndBelowMaxStaleness() {
    assertDoesNotThrow(() -> parse("missRefreshMinAge: 4999ms"));
    assertTrue(message("missRefreshMinAge: 5s").contains("missRefreshMinAge"));
    assertTrue(message("missRefreshMinAge: 0s").contains("missRefreshMinAge"));
  }

  @Test
  void loadTimeoutMustBeBelowMaxStaleness() {
    assertDoesNotThrow(() -> parse("loadTimeout: 4999ms"));
    assertTrue(message("loadTimeout: 5s").contains("loadTimeout"));
  }

  @Test
  void maxConcurrentRequestReadsMustBeAtLeastOne() {
    assertDoesNotThrow(() -> parse("maxConcurrentRequestReads: 1"));
    assertTrue(message("maxConcurrentRequestReads: 0").contains("maxConcurrentRequestReads"));
  }

  @Test
  void batchSizeMustBeWithinTheInListLimit() {
    assertDoesNotThrow(() -> parse("batchSize: 1"));
    assertDoesNotThrow(() -> parse("batchSize: 30000\nmaxSubjects: 30000\n"));
    assertTrue(message("batchSize: 0").contains("batchSize"));
    assertTrue(message("batchSize: 30001\nmaxSubjects: 40000\n").contains("batchSize"));
  }

  @Test
  void maxSubjectsMustNotBeBelowBatchSize() {
    assertDoesNotThrow(() -> parse("batchSize: 500\nmaxSubjects: 500\n"));
    assertTrue(message("batchSize: 500\nmaxSubjects: 499\n").contains("maxSubjects"));
  }

  @Test
  void everyDurationMustBePositive() {
    for (String field :
        new String[] {
          "maxStaleness",
          "sweepInterval",
          "missRefreshMinAge",
          "loadTimeout",
          "idleExpiry",
          "deepVerifyInterval"
        }) {
      assertTrue(message(field + ": 0s").contains(field), field);
    }
  }
}
