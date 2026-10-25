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
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import io.dropwizard.configuration.ConfigurationException;
import io.dropwizard.configuration.EnvironmentVariableSubstitutor;
import io.dropwizard.configuration.SubstitutingSourceProvider;
import io.dropwizard.configuration.YamlConfigurationFactory;
import io.dropwizard.jackson.Jackson;
import io.dropwizard.util.Duration;
import jakarta.validation.Validation;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.events.AuditExcludeFilterFactory;
import org.openmetadata.service.events.AuditOnlyFilterFactory;
import org.openmetadata.service.logging.SwitchableAccessLayoutFactory;
import org.openmetadata.service.logging.SwitchableEventLayoutFactory;

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

  @Test
  void shippedYamlBlockWithNoEnvVarsEqualsDefaults() throws Exception {
    assertEquals(
        CredentialVerificationConfig.defaults(),
        parseShipped(shippedWithBlock(null)).getCredentialVerification());
  }

  @Test
  void overrideBlockParsesToTheOverriddenValues() throws Exception {
    CredentialVerificationConfig config =
        parseShipped(
                shippedWithBlock(
                    "credentialVerification:\n  maxStaleness: 1s\n  sweepInterval: 100ms\n  loadTimeout: 500ms\n"))
            .getCredentialVerification();

    assertEquals(Duration.seconds(1), config.maxStaleness());
    assertEquals(Duration.milliseconds(100), config.sweepInterval());
    assertEquals(Duration.milliseconds(500), config.missRefreshMinAge());
  }

  @Test
  void invalidBlockFailsNamingTheBlock() {
    ConfigurationException failure =
        assertThrows(
            ConfigurationException.class,
            () ->
                parseShipped(
                    shippedWithBlock(
                        "credentialVerification:\n  maxStaleness: 3s\n  sweepInterval: 2s\n")));

    assertTrue(failure.getMessage().contains("credentialVerification:"), failure.getMessage());
  }

  @Test
  void absentBlockGivesDefaults() throws Exception {
    assertEquals(
        CredentialVerificationConfig.defaults(),
        parseShipped(shippedWithBlock("")).getCredentialVerification());
  }

  @Test
  void forPoolLowersReadsToHalfASmallPool() {
    assertEquals(
        5, CredentialVerificationConfig.defaults().forPool(10).maxConcurrentRequestReads());
  }

  @Test
  void forPoolKeepsReadsWhenThePoolIsLarge() {
    CredentialVerificationConfig defaults = CredentialVerificationConfig.defaults();

    assertSame(defaults, defaults.forPool(100));
    assertEquals(16, defaults.forPool(100).maxConcurrentRequestReads());
  }

  @Test
  void forPoolNeverGoesBelowOne() {
    assertEquals(1, CredentialVerificationConfig.defaults().forPool(1).maxConcurrentRequestReads());
    assertEquals(1, CredentialVerificationConfig.defaults().forPool(0).maxConcurrentRequestReads());
  }

  @Test
  void forPoolKeepsEveryOtherKnob() {
    CredentialVerificationConfig lowered = CredentialVerificationConfig.defaults().forPool(10);

    assertEquals(
        new CredentialVerificationConfig(null, null, null, null, 5, null, null, null, null),
        lowered);
  }

  private static final Path SHIPPED_CONFIG = Path.of("../conf/openmetadata.yaml");
  private static final String BLOCK_START = "\ncredentialVerification:";

  private static String shippedWithBlock(String replacement) throws IOException {
    String yaml = Files.readString(SHIPPED_CONFIG);
    int start = yaml.indexOf(BLOCK_START);
    assertTrue(start >= 0, "conf/openmetadata.yaml has no credentialVerification block");
    String tail = replacement == null ? yaml.substring(start) : "\n" + replacement;
    return yaml.substring(0, start) + tail;
  }

  private static OpenMetadataApplicationConfig parseShipped(String yaml)
      throws IOException, ConfigurationException {
    var mapper = Jackson.newObjectMapper();
    mapper.registerSubtypes(
        AuditExcludeFilterFactory.class,
        AuditOnlyFilterFactory.class,
        SwitchableEventLayoutFactory.class,
        SwitchableAccessLayoutFactory.class);
    var factory =
        new YamlConfigurationFactory<>(
            OpenMetadataApplicationConfig.class,
            Validation.buildDefaultValidatorFactory().getValidator(),
            mapper,
            "dw");
    return factory.build(
        new SubstitutingSourceProvider(
            path -> new ByteArrayInputStream(yaml.getBytes(StandardCharsets.UTF_8)),
            new EnvironmentVariableSubstitutor(false, true)),
        "inline.yaml");
  }
}
