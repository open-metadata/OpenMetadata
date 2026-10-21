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

package org.openmetadata.service.alerting.channel;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType;
import org.openmetadata.service.alerting.channel.builtin.BuiltInChannels;
import org.openmetadata.service.alerting.content.render.ChannelRenderer;

class ChannelRegistryTest {
  private static final Path MAIN_SOURCES = Path.of("src/main/java/org/openmetadata/service");
  // A switch over the type never names the enum, only its constants.
  private static final Pattern NAMES_A_DESTINATION_TYPE =
      Pattern.compile(
          "SubscriptionType\\b|case (SLACK|MS_TEAMS|G_CHAT|WEBHOOK|EMAIL|ACTIVITY_FEED"
              + "|GOVERNANCE_WORKFLOW_CHANGE_EVENT)\\b");
  private static final List<String> ALLOWED =
      List.of(
          // Each channel names the destination type it serves, in its own package.
          "alerting/channel/email/",
          "alerting/channel/slack/",
          "alerting/channel/teams/",
          "alerting/channel/gchat/",
          "alerting/channel/webhook/",
          "alerting/channel/feed/",
          "governance/workflows/GovernanceChannels.java",
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

  // One renderer per channel, shared by every caller at once, as the notification engine is.
  @Test
  void everyCallerSharesTheChannelsOneRenderer() throws Exception {
    for (SubscriptionType type : SubscriptionType.values()) {
      Channel channel = Channels.of(type.value()).orElseThrow();
      Set<ChannelRenderer> seen = ConcurrentHashMap.newKeySet();
      try (ExecutorService callers = Executors.newFixedThreadPool(8)) {
        CountDownLatch start = new CountDownLatch(1);
        List<Future<?>> asked = new ArrayList<>();
        for (int caller = 0; caller < 8; caller++) {
          asked.add(
              callers.submit(
                  () -> {
                    start.await();
                    channel.renderer().ifPresent(seen::add);
                    return null;
                  }));
        }
        start.countDown();
        for (Future<?> answer : asked) {
          answer.get(30, TimeUnit.SECONDS);
        }
      }
      assertTrue(seen.size() <= 1, type.value() + " built " + seen.size() + " renderers");
    }
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
  void onlyAChannelsOwnPackageNamesItsDestinationType() throws IOException {
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
