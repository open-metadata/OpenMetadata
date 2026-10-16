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
package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.search.GlobalSettings;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.configuration.EntityRulesSettings;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.SemanticsRule;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.settings.SettingsCache;

/**
 * A repository transaction reads settings from a snapshot taken no earlier than its start. Under
 * MySQL's REPEATABLE READ that snapshot can predate an update that commits while the transaction
 * runs, so the rules the transaction loads must not be served to reads that come after it.
 */
class TransactionSettingsSnapshotTest {
  private static final String RULES_KEY = SettingsType.ENTITY_RULES_SETTINGS.toString();
  private static final String SEARCH_KEY = SettingsType.SEARCH_SETTINGS.toString();
  private static final String MULTI_DOMAIN_RULE = "Multiple Domains are not allowed";

  private final AtomicReference<Settings> committedRules = new AtomicReference<>(rules(true));
  private final AtomicReference<Settings> snapshotRules = new AtomicReference<>();
  private final AtomicBoolean readingTheSnapshot = new AtomicBoolean();
  private SystemRepository systemRepository;
  private MockedStatic<Entity> entity;

  @BeforeEach
  void serveTheRulesFromAMockedRepository() {
    systemRepository = mock(SystemRepository.class);
    entity = mockStatic(Entity.class);
    entity.when(Entity::getSystemRepository).thenReturn(systemRepository);
    when(systemRepository.getConfigWithKey(RULES_KEY))
        .thenAnswer(
            invocation -> readingTheSnapshot.get() ? snapshotRules.get() : committedRules.get());
    SettingsCache.invalidateSettings(RULES_KEY);
    SettingsCache.invalidateSettings(SEARCH_KEY);
  }

  @AfterEach
  void forgetTheCachedSettings() {
    SettingsCache.invalidateSettings(RULES_KEY);
    SettingsCache.invalidateSettings(SEARCH_KEY);
    entity.close();
  }

  @Test
  void anUpdateCommittedDuringATransactionIsServedToTheReadsAfterIt() {
    TransactionRollbackTracker.runAttempt(
        () -> {
          commitAnUpdateTheSnapshotCannotSee();
          assertTrue(isMultiDomainRuleEnabled(), "the transaction reads its snapshot");
          assertTrue(isMultiDomainRuleEnabled(), "the transaction reads its snapshot");
          return null;
        });
    readingTheSnapshot.set(false);

    assertFalse(isMultiDomainRuleEnabled(), "a read after the transaction must see the update");
    verify(systemRepository, times(2)).getConfigWithKey(RULES_KEY);
  }

  @Test
  void aNestedAttemptKeepsTheStartOfTheTransactionItJoined() {
    TransactionRollbackTracker.runAttempt(
        () -> {
          // The update lands between the two starts, so a nested attempt that recorded its own
          // start would stamp the snapshot's rules as current.
          commitAnUpdateTheSnapshotCannotSee();
          return TransactionRollbackTracker.runAttempt(
              TransactionSettingsSnapshotTest::isMultiDomainRuleEnabled);
        });
    readingTheSnapshot.set(false);

    assertFalse(isMultiDomainRuleEnabled(), "a read after the transaction must see the update");
  }

  @Test
  void rulesLoadedByATransactionWithoutAnUpdateAreServedFromTheCache() {
    TransactionRollbackTracker.runAttempt(
        () -> {
          assertTrue(isMultiDomainRuleEnabled());
          assertTrue(isMultiDomainRuleEnabled());
          return null;
        });

    assertTrue(isMultiDomainRuleEnabled());
    verify(systemRepository, times(1)).getConfigWithKey(RULES_KEY);
  }

  @Test
  void theColumnIndexingFlagReadByATableWriteIsServedFromTheCache() {
    when(systemRepository.getConfigWithKey(SEARCH_KEY)).thenReturn(columnIndexing(false));

    TransactionRollbackTracker.runAttempt(
        () -> {
          assertFalse(SettingsCache.isColumnIndexingEnabled());
          assertFalse(SettingsCache.isColumnIndexingEnabled());
          return null;
        });

    assertFalse(SettingsCache.isColumnIndexingEnabled());
    verify(systemRepository, times(1)).getConfigWithKey(SEARCH_KEY);
  }

  /** From here on the transaction reads the rules as they were before the update. */
  private void commitAnUpdateTheSnapshotCannotSee() {
    snapshotRules.set(committedRules.get());
    readingTheSnapshot.set(true);
    committedRules.set(rules(false));
    SettingsCache.invalidateSettings(RULES_KEY);
  }

  private static boolean isMultiDomainRuleEnabled() {
    return SettingsCache.getSetting(SettingsType.ENTITY_RULES_SETTINGS, EntityRulesSettings.class)
        .getEntitySemantics()
        .stream()
        .filter(rule -> MULTI_DOMAIN_RULE.equals(rule.getName()))
        .anyMatch(SemanticsRule::getEnabled);
  }

  private static Settings rules(boolean multiDomainRuleEnabled) {
    SemanticsRule multiDomainRule =
        new SemanticsRule()
            .withName(MULTI_DOMAIN_RULE)
            .withDescription("An entity belongs to at most one domain")
            .withRule("{\"<=\":[{\"length\":{\"var\":\"domains\"}},1]}")
            .withEnabled(multiDomainRuleEnabled);
    return new Settings()
        .withConfigType(SettingsType.ENTITY_RULES_SETTINGS)
        .withConfigValue(new EntityRulesSettings().withEntitySemantics(List.of(multiDomainRule)));
  }

  private static Settings columnIndexing(boolean enabled) {
    return new Settings()
        .withConfigType(SettingsType.SEARCH_SETTINGS)
        .withConfigValue(
            new SearchSettings()
                .withGlobalSettings(new GlobalSettings().withEnableColumnIndexing(enabled)));
  }
}
