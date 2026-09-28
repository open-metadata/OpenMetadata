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

package org.openmetadata.service.config;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.dropwizard.configuration.EnvironmentVariableSubstitutor;
import io.dropwizard.configuration.FileConfigurationSourceProvider;
import io.dropwizard.configuration.SubstitutingSourceProvider;
import io.dropwizard.configuration.YamlConfigurationFactory;
import io.dropwizard.jackson.Jackson;
import io.dropwizard.logging.common.ConsoleAppenderFactory;
import io.dropwizard.logging.common.DefaultLoggingFactory;
import jakarta.validation.Validation;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.events.AuditExcludeFilterFactory;
import org.openmetadata.service.events.AuditOnlyFilterFactory;
import org.openmetadata.service.logging.SwitchableAccessLayoutFactory;
import org.openmetadata.service.logging.SwitchableEventLayoutFactory;

class LoggingConfigurationYamlTest {
  private static final String SHIPPED_CONFIG = "../conf/openmetadata.yaml";
  private static final String LOG_FORMAT_PLACEHOLDER = "${LOG_FORMAT:-text}";
  private static final String CONSOLE_LEVEL_PLACEHOLDER = "${CONSOLE_LOG_LEVEL:-TRACE}";
  private static final List<String> CONFIG_PATHS =
      List.of(
          SHIPPED_CONFIG,
          "../docker/development/distributed-test/local/server1.yaml",
          "../docker/development/distributed-test/local/server2.yaml",
          "../docker/development/distributed-test/local/server3.yaml",
          "../openmetadata-integration-tests/src/test/resources/openmetadata-secure-test.yaml");

  @Test
  void parsesTextLoggingConfigurations() {
    for (String path : CONFIG_PATHS) {
      assertDoesNotThrow(() -> parse(path), path);
    }
  }

  @Test
  void parsesJsonLoggingConfigurations() {
    for (String path : CONFIG_PATHS) {
      assertDoesNotThrow(() -> parse(path, "json"), path);
    }
  }

  /**
   * On bare metal {@code bin/openmetadata.sh start} appends stdout to {@code logs/catalog.log},
   * which nothing rotates. The console appender emits the same lines logback already writes to the
   * rotated {@code logs/openmetadata.log}, so leaving the console on makes that file an unbounded
   * duplicate — one reported install reached 20M lines going back two years.
   *
   * <p>The fix is a pair: the yaml reads its console threshold from {@code CONSOLE_LOG_LEVEL} and
   * the start script exports it. Either half alone is a silent no-op, so assert both. {@code
   * DefaultLoggingFactory.toLevel} degrades an unrecognised value to INFO without complaint, which
   * is why the parsed level is asserted rather than the yaml text.
   */
  @Test
  void bareMetalStartScriptSilencesTheConsoleAppender() throws Exception {
    assumeTrue(
        System.getenv("CONSOLE_LOG_LEVEL") == null,
        "CONSOLE_LOG_LEVEL overrides the shipped value");

    assertEquals("TRACE", consoleThreshold(parse(SHIPPED_CONFIG)));
    assertEquals("OFF", consoleThreshold(parse(SHIPPED_CONFIG, CONSOLE_LEVEL_PLACEHOLDER, "OFF")));
    assertTrue(
        Pattern.compile("export\\s+CONSOLE_LOG_LEVEL=.*:-OFF")
            .matcher(Files.readString(Path.of("../bin/openmetadata.sh")))
            .find(),
        "bin/openmetadata.sh must silence the console appender it redirects into catalog.log");
  }

  private String consoleThreshold(OpenMetadataApplicationConfig config) {
    return ((DefaultLoggingFactory) config.getLoggingFactory())
        .getAppenders().stream()
            .filter(ConsoleAppenderFactory.class::isInstance)
            .map(appender -> ((ConsoleAppenderFactory<?>) appender).getThreshold())
            .findFirst()
            .orElseThrow();
  }

  private OpenMetadataApplicationConfig parse(String path) throws Exception {
    return parse(path, LOG_FORMAT_PLACEHOLDER, null);
  }

  private OpenMetadataApplicationConfig parse(String path, String formatOverride) throws Exception {
    return parse(path, LOG_FORMAT_PLACEHOLDER, formatOverride);
  }

  private OpenMetadataApplicationConfig parse(String path, String placeholder, String replacement)
      throws Exception {
    ObjectMapper objectMapper = Jackson.newObjectMapper();
    objectMapper.registerSubtypes(
        AuditExcludeFilterFactory.class,
        AuditOnlyFilterFactory.class,
        SwitchableEventLayoutFactory.class,
        SwitchableAccessLayoutFactory.class);
    YamlConfigurationFactory<OpenMetadataApplicationConfig> factory =
        new YamlConfigurationFactory<>(
            OpenMetadataApplicationConfig.class,
            Validation.buildDefaultValidatorFactory().getValidator(),
            objectMapper,
            "dw");

    if (replacement == null) {
      return factory.build(
          new SubstitutingSourceProvider(
              new FileConfigurationSourceProvider(),
              new EnvironmentVariableSubstitutor(false, true)),
          path);
    }

    Path tempFile = Files.createTempFile("logging-config-", ".yaml");
    try {
      Files.writeString(
          tempFile, Files.readString(Path.of(path)).replace(placeholder, replacement));
      return factory.build(
          new SubstitutingSourceProvider(
              new FileConfigurationSourceProvider(),
              new EnvironmentVariableSubstitutor(false, true)),
          tempFile.toString());
    } finally {
      Files.deleteIfExists(tempFile);
    }
  }
}
