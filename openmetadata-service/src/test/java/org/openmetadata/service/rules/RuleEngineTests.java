package org.openmetadata.service.rules;

import static org.junit.Assert.assertThrows;
import static org.openmetadata.service.resources.EntityResourceTest.TEAM11_REF;
import static org.openmetadata.service.resources.EntityResourceTest.USER1_REF;
import static org.openmetadata.service.resources.EntityResourceTest.USER2_REF;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.net.URISyntaxException;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.configuration.EntityRulesSettings;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldDataType;
import org.openmetadata.schema.type.SemanticsRule;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.data.DataContractResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.settings.SettingsCache;

public class RuleEngineTests extends OpenMetadataApplicationTest {

  private static TableResourceTest tableResourceTest;
  private static DataContractResourceTest dataContractResourceTest;

  private static final String C1 = "id";
  private static final String C2 = "name";
  private static final String C3 = "description";
  private static final String EMAIL_COL = "email";

  private static final String GLOSSARY_TERM_RULE = "Tables can only have a single Glossary Term";
  private static final String OWNERSHIP_RULE_EXC =
      "Rule [Multiple Users or Single Team Ownership] validation failed: Entity does not satisfy the rule. "
          + "Rule context: Validates that an entity has either multiple owners or a single team as the owner.";

  @BeforeAll
  static void setup(TestInfo test) throws IOException, URISyntaxException {
    tableResourceTest = new TableResourceTest();
    tableResourceTest.setup(test);
    dataContractResourceTest = new DataContractResourceTest();
  }

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

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void engineBlocksWrongTableCreation(TestInfo test) throws IOException {

    // FIRST: Validate platform-wide settings
    // We can't create a table with multiple owners or a team and a user as owners
    CreateTable tableReq =
        tableResourceTest
            .createRequest(test)
            .withName(test.getDisplayName())
            .withOwners(List.of(USER1_REF, USER2_REF, TEAM11_REF))
            .withColumns(
                List.of(
                    new Column()
                        .withName(C1)
                        .withDisplayName("c1")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(10)));
    assertResponse(
        () -> tableResourceTest.createEntity(tableReq, ADMIN_AUTH_HEADERS),
        Response.Status.BAD_REQUEST,
        OWNERSHIP_RULE_EXC);

    // We can't PATCH a table breaking the ownership rule
    CreateTable create = tableResourceTest.createRequest(test).withOwners(List.of(USER1_REF));
    Table table = tableResourceTest.createEntity(create, ADMIN_AUTH_HEADERS);
    String tableJson = JsonUtils.pojoToJson(table);
    table.withOwners(List.of(USER1_REF, TEAM11_REF));

    assertResponse(
        () -> tableResourceTest.patchEntity(table.getId(), tableJson, table, ADMIN_AUTH_HEADERS),
        Response.Status.BAD_REQUEST,
        OWNERSHIP_RULE_EXC);

    // SECOND: Validate entity data contract rules
    CreateTable createWithContract =
        tableResourceTest
            .createRequest(test)
            .withDescription(null)
            .withOwners(List.of(USER1_REF))
            .withName(test.getDisplayName() + "_dataContract");
    Table tableWithContract =
        tableResourceTest.createEntity(createWithContract, ADMIN_AUTH_HEADERS);

    dataContractResourceTest
        .createDataContractRequest(test + "_dataContract", tableWithContract)
        .withEntity(new EntityReference().withId(tableWithContract.getId()).withType(Entity.TABLE))
        .withSemantics(
            List.of(
                new SemanticsRule()
                    .withName("Description can't be empty")
                    .withDescription("Validates that the table has a description")
                    .withRule("{ \"!!\": { \"var\": \"description\" } }")))
        .withSchema(
            List.of(
                new org.openmetadata.schema.type.Field()
                    .withName(C1)
                    .withDataType(FieldDataType.INT),
                new org.openmetadata.schema.type.Field()
                    .withName(C2)
                    .withDataType(FieldDataType.STRING),
                new org.openmetadata.schema.type.Field()
                    .withName(C3)
                    .withDataType(FieldDataType.STRING)))
        .withOwners(List.of(USER1_REF));

    // The table has null description. If we try to update any other field instead of fixing the
    // description, it should fail
    String tableJsonWithContract = JsonUtils.pojoToJson(tableWithContract);
    tableWithContract.withOwners(List.of(TEAM11_REF));

    assertResponse(
        () ->
            tableResourceTest.patchEntity(
                tableWithContract.getId(),
                tableJsonWithContract,
                tableWithContract,
                ADMIN_AUTH_HEADERS),
        Response.Status.BAD_REQUEST,
        "Rule [Description can't be empty] validation failed: Entity does not satisfy the rule. Rule context: Validates that the table has a description.");
  }
}
