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
package org.openmetadata.it.tests;

import static java.util.concurrent.TimeUnit.MINUTES;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.util.EntityRulesUtil;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.configuration.EntityRulesSettings;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.SemanticsRule;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.settings.SettingsCache;

/**
 * A settings update must reach the next read even when an entity write that started before the
 * update reloads the setting from inside its transaction. On MySQL that transaction reads from a
 * REPEATABLE READ snapshot taken before the update committed, so its reload sees the old value.
 *
 * <p>Other tests read the entity rules too. One of them can reload the rules after the update and
 * before the transaction does, which lets this test pass without exercising the race, but never
 * makes it fail.
 */
@Execution(ExecutionMode.CONCURRENT)
class SettingsCacheTransactionIT {
  private static final String RULES_KEY = SettingsType.ENTITY_RULES_SETTINGS.toString();

  @Test
  @ResourceLock("MULTI_DOMAIN_RULE")
  void anUpdateIsServedAfterATransactionWithAnOlderSnapshotReloadsTheSetting() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Settings original = EntityRulesUtil.getEntityRulesSettings(client);
    String marker = "settings-cache-snapshot-%s".formatted(UUID.randomUUID());
    CountDownLatch snapshotTaken = new CountDownLatch(1);
    CountDownLatch updateCommitted = new CountDownLatch(1);
    ExecutorService writer = Executors.newSingleThreadExecutor();
    try {
      CompletableFuture<Void> transaction =
          CompletableFuture.runAsync(
              () -> reloadTheRulesFromAnOlderSnapshot(snapshotTaken, updateCommitted), writer);
      assertTrue(snapshotTaken.await(1, MINUTES), "the transaction must take its snapshot");

      EntityRulesUtil.updateSettings(client, withFirstRuleDescription(original, marker));
      updateCommitted.countDown();
      transaction.get(1, MINUTES);

      assertEquals(
          marker, firstRuleDescription(cachedRules()), "the next read must see the update");
    } finally {
      updateCommitted.countDown();
      writer.shutdownNow();
      EntityRulesUtil.updateSettings(client, original);
    }
  }

  private static void reloadTheRulesFromAnOlderSnapshot(
      CountDownLatch snapshotTaken, CountDownLatch updateCommitted) {
    Entity.getEntityRepository(Entity.TABLE)
        .executeInTransaction(
            () -> {
              Entity.getSystemRepository().getConfigWithKey(RULES_KEY);
              snapshotTaken.countDown();
              awaitQuietly(updateCommitted);
              return cachedRules();
            });
  }

  private static void awaitQuietly(CountDownLatch latch) {
    try {
      latch.await(1, MINUTES);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }

  private static EntityRulesSettings cachedRules() {
    return SettingsCache.getSetting(SettingsType.ENTITY_RULES_SETTINGS, EntityRulesSettings.class);
  }

  private static Settings withFirstRuleDescription(Settings settings, String description) {
    EntityRulesSettings rules =
        JsonUtils.convertValue(settings.getConfigValue(), EntityRulesSettings.class);
    rules.getEntitySemantics().getFirst().setDescription(description);
    return new Settings().withConfigType(settings.getConfigType()).withConfigValue(rules);
  }

  private static String firstRuleDescription(EntityRulesSettings rules) {
    SemanticsRule first = rules.getEntitySemantics().getFirst();
    return first.getDescription();
  }
}
