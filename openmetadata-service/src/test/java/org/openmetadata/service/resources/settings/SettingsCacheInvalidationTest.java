package org.openmetadata.service.resources.settings;

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
import org.openmetadata.schema.configuration.EntityRulesSettings;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.SemanticsRule;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.SystemRepository;

class SettingsCacheInvalidationTest {
  private static final String RULES_KEY = SettingsType.ENTITY_RULES_SETTINGS.toString();
  private static final String MULTI_DOMAIN_RULE = "Multiple Domains are not allowed";

  private final AtomicReference<Settings> storedRules = new AtomicReference<>(rules(true));
  private final AtomicBoolean updateCommitted = new AtomicBoolean();
  private SystemRepository systemRepository;
  private MockedStatic<Entity> entity;

  @BeforeEach
  void serveTheRulesFromAMockedRepository() {
    systemRepository = mock(SystemRepository.class);
    entity = mockStatic(Entity.class);
    entity.when(Entity::getSystemRepository).thenReturn(systemRepository);
    SettingsCache.invalidateSettings(RULES_KEY);
  }

  @AfterEach
  void forgetTheCachedRules() {
    SettingsCache.invalidateSettings(RULES_KEY);
    entity.close();
  }

  @Test
  void anUpdateCommittedWhileTheRulesAreLoadingIsServedByTheNextRead() {
    when(systemRepository.getConfigWithKey(RULES_KEY))
        .thenAnswer(invocation -> readWhileTheUpdateCommits());

    // This read loads the rules while the update commits, so it may return either version.
    SettingsCache.getSetting(SettingsType.ENTITY_RULES_SETTINGS, EntityRulesSettings.class);

    assertFalse(isMultiDomainRuleEnabled(), "a read after the update must see it");
  }

  @Test
  void aSettingReadWithADefaultAlsoSeesTheCommittedUpdate() {
    when(systemRepository.getConfigWithKey(RULES_KEY))
        .thenAnswer(invocation -> readWhileTheUpdateCommits());

    SettingsCache.getSetting(SettingsType.ENTITY_RULES_SETTINGS, EntityRulesSettings.class);
    EntityRulesSettings rules =
        SettingsCache.getSettingOrDefault(
            SettingsType.ENTITY_RULES_SETTINGS,
            new EntityRulesSettings(),
            EntityRulesSettings.class);

    assertFalse(isMultiDomainRuleEnabled(rules), "a read after the update must see it");
  }

  @Test
  void rulesLoadedAfterTheLastUpdateAreServedFromTheCache() {
    when(systemRepository.getConfigWithKey(RULES_KEY)).thenReturn(rules(true));

    assertTrue(isMultiDomainRuleEnabled());
    assertTrue(isMultiDomainRuleEnabled());

    verify(systemRepository, times(1)).getConfigWithKey(RULES_KEY);
  }

  /** Reads the stored rules, then commits the update and invalidates before the load returns. */
  private Settings readWhileTheUpdateCommits() {
    Settings read = storedRules.get();
    if (updateCommitted.compareAndSet(false, true)) {
      storedRules.set(rules(false));
      SettingsCache.invalidateSettings(RULES_KEY);
    }
    return read;
  }

  private static boolean isMultiDomainRuleEnabled() {
    return isMultiDomainRuleEnabled(
        SettingsCache.getSetting(SettingsType.ENTITY_RULES_SETTINGS, EntityRulesSettings.class));
  }

  private static boolean isMultiDomainRuleEnabled(EntityRulesSettings rules) {
    return rules.getEntitySemantics().stream()
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
}
