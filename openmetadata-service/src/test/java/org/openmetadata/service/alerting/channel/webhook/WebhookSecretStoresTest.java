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

package org.openmetadata.service.alerting.channel.webhook;

import static java.util.Objects.requireNonNull;
import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

/**
 * A webhook carries secrets wherever it is stored, and each schema that embeds the webhook type
 * has a class that keeps them encrypted, masked and restorable. A new schema embedding it needs one
 * too.
 */
class WebhookSecretStoresTest {
  private static final String SPEC_MODULE = "openmetadata-spec";
  private static final Path SCHEMAS = Path.of(SPEC_MODULE, "src/main/resources/json/schema");
  private static final Pattern WEBHOOK_REF =
      Pattern.compile("\"\\$ref\"\\s*:\\s*\"[^\"]*/webhook\\.json(#[^\"]*)?\"");

  // The schema that embeds the webhook type, and the class that keeps its secrets there.
  private static final Set<String> KEPT_STORES =
      Set.of(
          "events/eventSubscription.json", // destinations: DestinationSecrets
          "type/profile.json"); // user and team profiles: ProfileWebhookSecrets

  @Test
  void everySchemaThatStoresAWebhookKeepsItsSecrets() {
    Path schemas = repoRoot().resolve(SCHEMAS);
    try (Stream<Path> files = Files.walk(schemas)) {
      Set<String> stores =
          files
              .filter(file -> file.toString().endsWith(".json"))
              .filter(WebhookSecretStoresTest::embedsAWebhook)
              .map(file -> schemas.relativize(file).toString().replace('\\', '/'))
              .collect(Collectors.toSet());
      assertEquals(
          KEPT_STORES,
          stores,
          "A schema embeds webhook.json without a class that encrypts, masks and restores its "
              + "secrets; give it one as DestinationSecrets and ProfileWebhookSecrets do");
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }

  private static boolean embedsAWebhook(Path file) {
    try {
      return WEBHOOK_REF.matcher(Files.readString(file)).find();
    } catch (IOException e) {
      throw new UncheckedIOException("Cannot read " + file, e);
    }
  }

  private static Path repoRoot() {
    Path current = Path.of("").toAbsolutePath();
    while (current != null && !Files.isDirectory(current.resolve(SPEC_MODULE))) {
      current = current.getParent();
    }
    return requireNonNull(
        current, "Cannot locate the repository root from " + Path.of("").toAbsolutePath());
  }
}
