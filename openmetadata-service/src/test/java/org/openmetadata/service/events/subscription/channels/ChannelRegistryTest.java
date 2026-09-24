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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType;
import org.openmetadata.service.events.subscription.channels.builtin.BuiltInChannels;

class ChannelRegistryTest {
  private static final Path MAIN_SOURCES = Path.of("src/main/java/org/openmetadata/service");
  // A switch over the type never names the enum, only its constants.
  private static final Pattern NAMES_A_DESTINATION_TYPE =
      Pattern.compile(
          "SubscriptionType\\b|case (SLACK|MS_TEAMS|G_CHAT|WEBHOOK|EMAIL|ACTIVITY_FEED"
              + "|GOVERNANCE_WORKFLOW_CHANGE_EVENT)\\b");
  private static final List<String> ALLOWED =
      List.of(
          "events/subscription/channels/builtin/",
          "migration/",
          "exception/CatalogExceptionMessage.java");

  @Test
  void everyDestinationTypeHasAChannel() {
    List<String> missing =
        Arrays.stream(SubscriptionType.values())
            .map(SubscriptionType::value)
            .filter(type -> Channels.of(type).isEmpty())
            .toList();

    assertEquals(List.of(), missing);
  }

  @Test
  void channelFromAnotherProviderIsRegistered() {
    assertTrue(Channels.of(RecordingChannels.ID).isPresent());
  }

  @Test
  void twoChannelsUnderOneIdAreRefused() {
    List<ChannelProvider> twice = List.of(new BuiltInChannels(), new BuiltInChannels());

    assertThrows(IllegalStateException.class, () -> Channels.index(twice));
  }

  @Test
  void noSubscriptionTypeReferenceOutsideBuiltInChannels() throws IOException {
    try (Stream<Path> sources = Files.walk(MAIN_SOURCES)) {
      List<String> offenders =
          sources
              .filter(path -> path.toString().endsWith(".java"))
              .filter(path -> !isAllowed(path))
              .filter(ChannelRegistryTest::namesADestinationType)
              .map(path -> MAIN_SOURCES.relativize(path).toString())
              .sorted()
              .toList();

      assertEquals(List.of(), offenders, "Ask the channel registry instead of naming a type");
    }
  }

  private static boolean isAllowed(Path source) {
    String relative = MAIN_SOURCES.relativize(source).toString().replace('\\', '/');
    return ALLOWED.stream().anyMatch(relative::startsWith);
  }

  private static boolean namesADestinationType(Path source) {
    try {
      return NAMES_A_DESTINATION_TYPE.matcher(Files.readString(source)).find();
    } catch (IOException e) {
      throw new IllegalStateException(e);
    }
  }
}
