package org.openmetadata.service.rules;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.configuration.EntityRulesSettings;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.SemanticsRule;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.DataContractRepository;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.resources.settings.SettingsCache;

class RuleEngineTest {

  @Test
  void applyRegistersIsReviewerForWorkflowJsonLogicRules() {
    String rule = "{\"and\":[{\"isReviewer\":{\"var\":\"updatedBy\"}}]}";
    Map<String, Object> context =
        Map.of(
            "updatedBy",
            "alice",
            "reviewers",
            List.of(new EntityReference().withType(Entity.USER).withName("alice")));

    assertEquals(true, RuleEngine.getInstance().apply(rule, context));
  }

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
  void isOperationEnabledMatchesRuleLogicNotItsName() {
    String domainMatch = "{\"validateDataProductDomainMatch\":[{\"var\":\"dataProducts\"}]}";
    SemanticsRule renamed =
        new SemanticsRule().withName("Renamed by admin").withRule(domainMatch).withEnabled(true);
    SemanticsRule other =
        new SemanticsRule()
            .withName("Data Product Domain Validation")
            .withRule("{\"<=\":[{\"length\":{\"var\":\"domains\"}},1]}")
            .withEnabled(true);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class);
        MockedStatic<SettingsCache> settingsCache = mockStatic(SettingsCache.class)) {
      entity.when(Entity::getSystemRepository).thenReturn(mock(SystemRepository.class));
      settingsCache
          .when(
              () ->
                  SettingsCache.getSetting(
                      SettingsType.ENTITY_RULES_SETTINGS, EntityRulesSettings.class))
          .thenReturn(new EntityRulesSettings().withEntitySemantics(List.of(renamed, other)));
      assertTrue(RuleEngine.getInstance().isOperationEnabled("validateDataProductDomainMatch"));

      renamed.setEnabled(false);
      assertFalse(RuleEngine.getInstance().isOperationEnabled("validateDataProductDomainMatch"));
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

  @Test
  void validateRuleWithEmptyStringRuleTreatsAsFailure() {
    Table table = new Table().withId(UUID.randomUUID());
    SemanticsRule emptyRule =
        new SemanticsRule().withName("empty_rule").withEnabled(true).withRule("\"\"");

    List<SemanticsRule> failed =
        RuleEngine.getInstance().evaluateAndReturn(table, List.of(emptyRule), false, false);

    assertEquals(List.of(emptyRule), failed, "Empty string rule should be treated as a failure");
  }

  @Test
  void validateRuleWithNonBooleanResultTreatsAsFailure() {
    Table table = new Table().withId(UUID.randomUUID());
    SemanticsRule numericRule =
        new SemanticsRule().withName("numeric_rule").withEnabled(true).withRule("42");

    List<SemanticsRule> failed =
        RuleEngine.getInstance().evaluateAndReturn(table, List.of(numericRule), false, false);

    assertEquals(
        List.of(numericRule), failed, "Non-boolean rule result should be treated as a failure");
  }

  @Test
  void validateRuleWithNullResultTreatsAsFailure() {
    Table table = new Table().withId(UUID.randomUUID());
    SemanticsRule nullRule =
        new SemanticsRule().withName("null_rule").withEnabled(true).withRule("null");

    List<SemanticsRule> failed =
        RuleEngine.getInstance().evaluateAndReturn(table, List.of(nullRule), false, false);

    assertEquals(List.of(nullRule), failed, "Null rule result should be treated as a failure");
  }

  @Test
  void validateRuleWithValidBooleanTruePassesThrough() {
    Table table = new Table().withId(UUID.randomUUID());
    SemanticsRule trueRule =
        new SemanticsRule().withName("true_rule").withEnabled(true).withRule("true");

    List<SemanticsRule> failed =
        RuleEngine.getInstance().evaluateAndReturn(table, List.of(trueRule), false, false);

    assertTrue(failed.isEmpty(), "Rule evaluating to true should pass");
  }

  // The shapes the workflow builder saves for a Column Tags rule (jsonLogicColumnTags.ts), mapped
  // to the expected result for a table whose column is tagged PII.Sensitive, Other.Tag, then
  // nothing.
  // Every rule expects true once, so a rule that throws (apply returns false) cannot pass.
  private static final Map<String, List<Boolean>> COLUMN_TAG_RULES = columnTagRules();

  private static Map<String, List<Boolean>> columnTagRules() {
    String equalsPii = "{\"==\":[{\"var\":\"tagFQN\"},\"PII.Sensitive\"]}";
    String inPii = "{\"in\":[{\"var\":\"tagFQN\"},[\"PII.Sensitive\"]]}";
    String notNull = "{\"!=\":[{\"var\":\"tagFQN\"},null]}";
    Map<String, List<Boolean>> rules = new LinkedHashMap<>();
    rules.put(perColumnTag(equalsPii), List.of(true, false, false));
    rules.put("{\"!\":" + perColumnTag(equalsPii) + "}", List.of(false, true, true));
    rules.put(perColumnTag(inPii), List.of(true, false, false));
    rules.put("{\"!\":" + perColumnTag(inPii) + "}", List.of(false, true, true));
    rules.put(perColumnTag(notNull), List.of(true, true, false));
    rules.put("{\"!\":" + perColumnTag(notNull) + "}", List.of(false, false, true));
    return rules;
  }

  private static String perColumnTag(String condition) {
    return "{\"some\":[{\"var\":\"columns\"},{\"some\":[{\"var\":\"tags\"}," + condition + "]}]}";
  }

  private static Map<String, Object> tableWithColumnTag(String tagFqn) {
    List<TagLabel> tags = tagFqn == null ? List.of() : List.of(new TagLabel().withTagFQN(tagFqn));
    Column tagged =
        new Column().withName("email").withDataType(ColumnDataType.STRING).withTags(tags);
    Column untagged = new Column().withName("id").withDataType(ColumnDataType.INT);
    return JsonUtils.getMap(
        new Table().withId(UUID.randomUUID()).withName("t").withColumns(List.of(tagged, untagged)));
  }

  @Test
  void columnTagRulesEvaluateAgainstEachColumnsTags() {
    Map<String, Object> piiTable = tableWithColumnTag("PII.Sensitive");
    Map<String, Object> otherTable = tableWithColumnTag("Other.Tag");
    Map<String, Object> untaggedTable = tableWithColumnTag(null);

    COLUMN_TAG_RULES.forEach(
        (rule, expected) -> {
          assertEquals(expected.get(0), RuleEngine.getInstance().apply(rule, piiTable), rule);
          assertEquals(expected.get(1), RuleEngine.getInstance().apply(rule, otherTable), rule);
          assertEquals(expected.get(2), RuleEngine.getInstance().apply(rule, untaggedTable), rule);
        });
  }

  @Test
  void dottedColumnTagsVarCannotReachTagsThroughTheColumnsList() {
    String rule =
        "{\"some\":[{\"var\":\"columns.tags\"},{\"==\":[{\"var\":\"tagFQN\"},\"PII.Sensitive\"]}]}";

    assertEquals(false, RuleEngine.getInstance().apply(rule, tableWithColumnTag("PII.Sensitive")));
  }
}
