package org.openmetadata.service.rules;

import static org.junit.Assert.assertThrows;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.schema.configuration.EntityRulesSettings;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.SemanticsRule;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.settings.SettingsCache;

public class RuleEngineTests extends OpenMetadataApplicationTest {
  private static final String C1 = "id";
  private static final String C2 = "name";
  private static final String C3 = "description";
  private static final String EMAIL_COL = "email";

  private static final String GLOSSARY_TERM_RULE = "Tables can only have a single Glossary Term";

  Table getMockTable(TestInfo test) {
    return new Table()
        .withId(UUID.randomUUID())
        .withName(test.getDisplayName())
        .withColumns(
            List.of(
                new org.openmetadata.schema.type.Column()
                    .withName(C1)
                    .withDisplayName("ID")
                    .withDataType(org.openmetadata.schema.type.ColumnDataType.INT),
                new org.openmetadata.schema.type.Column()
                    .withName(C2)
                    .withDisplayName("Name")
                    .withDataType(org.openmetadata.schema.type.ColumnDataType.STRING),
                new org.openmetadata.schema.type.Column()
                    .withName(C3)
                    .withDisplayName("Description")
                    .withDataType(org.openmetadata.schema.type.ColumnDataType.TEXT),
                new org.openmetadata.schema.type.Column()
                    .withName(EMAIL_COL)
                    .withDisplayName("Email")
                    .withDataType(org.openmetadata.schema.type.ColumnDataType.STRING)));
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testMultipleUsersOrSingleTeamOwnership(TestInfo test) {
    Table table = getMockTable(test);

    // No owners, should pass
    RuleEngine.getInstance().evaluate(table);

    // Single user ownership, should pass
    table.withOwners(
        List.of(
            new org.openmetadata.schema.type.EntityReference()
                .withId(UUID.randomUUID())
                .withType(Entity.USER)
                .withName("user1")));
    RuleEngine.getInstance().evaluate(table);

    // Multiple users ownership, should pass
    table.withOwners(
        List.of(
            new org.openmetadata.schema.type.EntityReference()
                .withId(UUID.randomUUID())
                .withType(Entity.USER)
                .withName("user1"),
            new org.openmetadata.schema.type.EntityReference()
                .withId(UUID.randomUUID())
                .withType(Entity.USER)
                .withName("user2")));
    RuleEngine.getInstance().evaluate(table);

    // Single team ownership, should pass
    table.withOwners(
        List.of(
            new org.openmetadata.schema.type.EntityReference()
                .withId(UUID.randomUUID())
                .withName("team1")
                .withType(Entity.TEAM)));
    RuleEngine.getInstance().evaluate(table);

    // Multiple teams ownership, should fail
    table.withOwners(
        List.of(
            new org.openmetadata.schema.type.EntityReference()
                .withId(UUID.randomUUID())
                .withName("team1")
                .withType(Entity.TEAM),
            new org.openmetadata.schema.type.EntityReference()
                .withId(UUID.randomUUID())
                .withName("team2")
                .withType(Entity.TEAM)));
    assertThrows(RuleValidationException.class, () -> RuleEngine.getInstance().evaluate(table));

    // Mixed ownership (team and user), should fail
    table.withOwners(
        List.of(
            new org.openmetadata.schema.type.EntityReference()
                .withId(UUID.randomUUID())
                .withName("team1")
                .withType(Entity.TEAM),
            new org.openmetadata.schema.type.EntityReference()
                .withId(UUID.randomUUID())
                .withType(Entity.USER)
                .withName("user1")));
    assertThrows(RuleValidationException.class, () -> RuleEngine.getInstance().evaluate(table));
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testSingleGlossaryTermForTable(TestInfo test) {
    Table table = getMockTable(test);

    // Get all semantic rules
    List<SemanticsRule> rules =
        SettingsCache.getSetting(SettingsType.ENTITY_RULES_SETTINGS, EntityRulesSettings.class)
            .getEntitySemantics();

    // Pick up the glossary validation for tables to test it
    SemanticsRule glossaryRule =
        rules.stream()
            .filter(rule -> GLOSSARY_TERM_RULE.equals(rule.getName()))
            .findFirst()
            .orElseThrow(
                () ->
                    new IllegalStateException(
                        "No glossary validation rule found for tables. Review the entityRulesSettings.json file."));

    // No glossary terms, should pass
    RuleEngine.getInstance().evaluate(table, List.of(glossaryRule), true);

    // Single glossary term, should pass
    table.withTags(
        List.of(
            new org.openmetadata.schema.type.TagLabel()
                .withTagFQN("Glossary.Term1")
                .withSource(TagLabel.TagSource.GLOSSARY)));

    RuleEngine.getInstance().evaluate(table, List.of(glossaryRule), true);

    // Multiple glossary terms, should fail
    table.withTags(
        List.of(
            new org.openmetadata.schema.type.TagLabel()
                .withTagFQN("Glossary.Term1")
                .withSource(TagLabel.TagSource.GLOSSARY),
            new org.openmetadata.schema.type.TagLabel()
                .withTagFQN("Glossary.Term2")
                .withSource(TagLabel.TagSource.GLOSSARY)));
    assertThrows(
        RuleValidationException.class,
        () -> RuleEngine.getInstance().evaluate(table, List.of(glossaryRule), true));
  }
}
