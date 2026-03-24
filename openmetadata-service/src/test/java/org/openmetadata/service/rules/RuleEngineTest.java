package org.openmetadata.service.rules;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.configuration.EntityRulesSettings;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.SemanticsRule;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.DataContractRepository;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.resources.settings.SettingsCache;

class RuleEngineTest {

  @Test
  void evaluateAndReturnSkipsPlatformRulesWhenSettingsAreUnavailable() {
    Table table = new Table().withId(UUID.randomUUID());
    SystemRepository systemRepository = mock(SystemRepository.class);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class);
        MockedStatic<SettingsCache> settingsCache = mockStatic(SettingsCache.class)) {
      entity.when(Entity::getSystemRepository).thenReturn(systemRepository);
      settingsCache
          .when(
              () ->
                  SettingsCache.getSetting(
                      SettingsType.ENTITY_RULES_SETTINGS, EntityRulesSettings.class))
          .thenThrow(EntityNotFoundException.byMessage("missing settings"));

      assertEquals(List.of(), RuleEngine.getInstance().evaluateAndReturn(table, null, true, false));
    }
  }

  @Test
  void evaluateAndReturnPropagatesUnexpectedSettingsFailures() {
    Table table = new Table().withId(UUID.randomUUID());
    SystemRepository systemRepository = mock(SystemRepository.class);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class);
        MockedStatic<SettingsCache> settingsCache = mockStatic(SettingsCache.class)) {
      entity.when(Entity::getSystemRepository).thenReturn(systemRepository);
      settingsCache
          .when(
              () ->
                  SettingsCache.getSetting(
                      SettingsType.ENTITY_RULES_SETTINGS, EntityRulesSettings.class))
          .thenThrow(new IllegalStateException("cache corrupted"));

      IllegalStateException exception =
          assertThrows(
              IllegalStateException.class,
              () -> RuleEngine.getInstance().evaluateAndReturn(table, null, true, false));
      assertEquals("cache corrupted", exception.getMessage());
    }
  }

  @Test
  void evaluateAndReturnReturnsEmptyWhenPlatformSettingsAreNull() {
    Table table = new Table().withId(UUID.randomUUID());
    SystemRepository systemRepository = mock(SystemRepository.class);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class);
        MockedStatic<SettingsCache> settingsCache = mockStatic(SettingsCache.class)) {
      entity.when(Entity::getSystemRepository).thenReturn(systemRepository);
      settingsCache
          .when(
              () ->
                  SettingsCache.getSetting(
                      SettingsType.ENTITY_RULES_SETTINGS, EntityRulesSettings.class))
          .thenReturn(null);

      assertEquals(List.of(), RuleEngine.getInstance().evaluateAndReturn(table, null, true, false));
    }
  }

  @Test
  void evaluateAndReturnUsesOnlyEnabledPlatformSemantics() {
    Table table = new Table().withId(UUID.randomUUID());
    SystemRepository systemRepository = mock(SystemRepository.class);
    SemanticsRule enabledRule =
        new SemanticsRule().withName("enabled").withEnabled(true).withRule("{\"==\":[1,2]}");
    SemanticsRule disabledRule =
        new SemanticsRule().withName("disabled").withEnabled(false).withRule("{\"==\":[1,2]}");
    EntityRulesSettings settings =
        new EntityRulesSettings().withEntitySemantics(List.of(enabledRule, disabledRule));

    try (MockedStatic<Entity> entity = mockStatic(Entity.class);
        MockedStatic<SettingsCache> settingsCache = mockStatic(SettingsCache.class)) {
      entity.when(Entity::getSystemRepository).thenReturn(systemRepository);
      settingsCache
          .when(
              () ->
                  SettingsCache.getSetting(
                      SettingsType.ENTITY_RULES_SETTINGS, EntityRulesSettings.class))
          .thenReturn(settings);

      List<SemanticsRule> errors =
          RuleEngine.getInstance().evaluateAndReturn(table, null, true, false);

      assertEquals(List.of(enabledRule), errors);
    }
  }

  @Test
  void evaluateAndReturnIncludesApprovedContractSemantics() {
    Table table = new Table().withId(UUID.randomUUID());
    DataContractRepository repository = mock(DataContractRepository.class);
    SemanticsRule contractRule =
        new SemanticsRule().withName("contract").withEnabled(true).withRule("{\"==\":[1,2]}");
    DataContract contract =
        new DataContract()
            .withEntityStatus(EntityStatus.APPROVED)
            .withSemantics(List.of(contractRule));

    when(repository.getEffectiveDataContract(table)).thenReturn(contract);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.DATA_CONTRACT)).thenReturn(repository);

      List<SemanticsRule> errors =
          RuleEngine.getInstance().evaluateAndReturn(table, null, false, true);

      assertEquals(List.of(contractRule), errors);
    }
  }

  @Test
  void evaluateAndReturnIgnoresContractLookupFailures() {
    Table table = new Table().withId(UUID.randomUUID());
    DataContractRepository repository = mock(DataContractRepository.class);

    when(repository.getEffectiveDataContract(table)).thenThrow(new IllegalStateException("boom"));

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.DATA_CONTRACT)).thenReturn(repository);

      List<SemanticsRule> errors =
          RuleEngine.getInstance().evaluateAndReturn(table, null, false, true);

      assertTrue(errors.isEmpty());
    }
  }
}
