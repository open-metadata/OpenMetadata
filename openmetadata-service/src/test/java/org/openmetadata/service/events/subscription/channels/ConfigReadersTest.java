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

package org.openmetadata.service.events.subscription.channels;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

/**
 * A destination's configuration is read into its channel's type in one place, so a configuration
 * being saved is judged one way and a stored one is read one way, whichever part of a channel
 * reads it. A released data migration is the exception: it keeps a frozen copy of the read its
 * release made, so that a change here never changes it.
 */
class ConfigReadersTest {
  private static final Path MAIN_SOURCES = Path.of("src/main/java/org/openmetadata/service");
  private static final Pattern PARSES_A_CONFIGURATION =
      Pattern.compile(
          "JsonUtils\\.(convertValue|convertValueLenient|readValue)\\([^;]*getConfig\\(\\)");
  private static final String THE_READER = "events/subscription/channels/DestinationConfig.java";
  private static final String RELEASED_MIGRATIONS = "migration/utils/v";

  @Test
  void noConfigurationIsParsedOutsideItsChannel() throws IOException {
    try (Stream<Path> sources = Files.walk(MAIN_SOURCES)) {
      List<String> offenders =
          sources
              .filter(path -> path.toString().endsWith(".java"))
              .filter(ConfigReadersTest::parsesADestinationConfiguration)
              .map(path -> MAIN_SOURCES.relativize(path).toString().replace('\\', '/'))
              .filter(path -> !THE_READER.equals(path))
              .filter(path -> !path.startsWith(RELEASED_MIGRATIONS))
              .sorted()
              .toList();

      assertEquals(List.of(), offenders, "Read it through DestinationConfig");
    }
  }

  private static boolean parsesADestinationConfiguration(Path source) {
    try {
      String code = Files.readString(source);
      return code.contains("SubscriptionDestination")
          && PARSES_A_CONFIGURATION.matcher(code).find();
    } catch (IOException e) {
      throw new IllegalStateException(e);
    }
  }
}
