package org.openmetadata.service.rules;

import static org.junit.Assert.assertThrows;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.openmetadata.service.resources.EntityResourceTest.PII_SENSITIVE_TAG_LABEL;
import static org.openmetadata.service.resources.EntityResourceTest.TEAM11_REF;
import static org.openmetadata.service.resources.EntityResourceTest.TIER1_TAG_LABEL;
import static org.openmetadata.service.resources.EntityResourceTest.USER1_REF;
import static org.openmetadata.service.resources.EntityResourceTest.USER2_REF;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.net.URISyntaxException;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.schema.api.data.CreateDataContract;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.configuration.EntityRulesSettings;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ContractStatus;
import org.openmetadata.schema.type.SemanticsRule;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.data.DataContractResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.domains.DomainResourceTest;
import org.openmetadata.service.resources.settings.SettingsCache;

public class RuleEngineTests extends OpenMetadataApplicationTest {

  private static TableResourceTest tableResourceTest;
  private static DataContractResourceTest dataContractResourceTest;
  private static DomainResourceTest domainResourceTest;

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
    domainResourceTest = new DomainResourceTest();
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
  void testFilterByType(TestInfo test) {
    Table table = getMockTable(test);

    // No owners, should pass
    RuleEngine.getInstance().evaluate(table);

    SemanticsRule rule =
        new SemanticsRule()
            .withName("Owner should be a team")
            .withDescription("Validates owners is a single team.")
            .withRule(
                "{\"==\":[{\"length\":[{\"filterReferenceByType\":[{\"var\":\"owners\"},\"team\"]}]},1]}");

    // Single user ownership should fail the rule
    table.withOwners(List.of(USER1_REF));
    assertThrows(
        RuleValidationException.class,
        () -> RuleEngine.getInstance().evaluate(table, List.of(rule), false, false));

    // Single team ownership should pass the Semantics Rule
    table.withOwners(List.of(TEAM11_REF));
    RuleEngine.getInstance().evaluate(table, List.of(rule), false, false);
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
    RuleEngine.getInstance().evaluate(table, List.of(glossaryRule), false, false);

    // Single glossary term, should pass
    table.withTags(
        List.of(
            new org.openmetadata.schema.type.TagLabel()
                .withTagFQN("Glossary.Term1")
                .withSource(TagLabel.TagSource.GLOSSARY)));

    RuleEngine.getInstance().evaluate(table, List.of(glossaryRule), false, false);

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
        () -> RuleEngine.getInstance().evaluate(table, List.of(glossaryRule), false, false));
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void engineBlocksWrongTableCreation(TestInfo test) throws IOException {

    // FIRST: Validate platform-wide settings
    // We can't create a table with multiple owners or a team and a user as owners
    CreateTable tableReq =
        tableResourceTest
            .createRequest(test)
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
    CreateTable create =
        tableResourceTest
            .createRequest(test.getDisplayName() + "_PATCH")
            .withOwners(List.of(USER1_REF));
    Table table = tableResourceTest.createEntity(create, ADMIN_AUTH_HEADERS);
    String tableJson = JsonUtils.pojoToJson(table);
    table.withOwners(List.of(USER1_REF, TEAM11_REF));

    assertResponse(
        () -> tableResourceTest.patchEntity(table.getId(), tableJson, table, ADMIN_AUTH_HEADERS),
        Response.Status.BAD_REQUEST,
        OWNERSHIP_RULE_EXC);

    // SECOND: Validate entity data contract rules
    CreateDataContract createContractForTable =
        dataContractResourceTest
            .createDataContractRequest(test.getDisplayName() + "_validate", table)
            .withStatus(ContractStatus.Active)
            .withSemantics(
                List.of(
                    new SemanticsRule()
                        .withName("Description can't be empty")
                        .withDescription("Validates that the table has a description.")
                        .withRule("{ \"!!\": { \"var\": \"description\" } }")));

    // Create and validate the contract
    DataContract dataContract = dataContractResourceTest.createDataContract(createContractForTable);
    assertNotNull(dataContract);
    assertNotNull(dataContract.getId());
    assertEquals(table.getId(), dataContract.getEntity().getId());
    assertEquals("table", dataContract.getEntity().getType());

    // The table has null description. If we try to update any other field instead of fixing the
    // description, it should fail
    String tableJsonWithContract = JsonUtils.pojoToJson(table);
    table.withOwners(List.of(TEAM11_REF));

    // I can still PATCH the table to change the owners, even if the contract is broken.
    // We don't have hard contract enforcement yet, so this is allowed.
    Table patched =
        tableResourceTest.patchEntity(
            table.getId(), tableJsonWithContract, table, ADMIN_AUTH_HEADERS);
    assertNotNull(patched);
    assertEquals(table.getOwners().getFirst().getId(), TEAM11_REF.getId());

    // I can PATCH the table to add a proper description as well
    tableJsonWithContract = JsonUtils.pojoToJson(patched);
    table.withDescription("This is a valid description");
    patched =
        tableResourceTest.patchEntity(
            table.getId(), tableJsonWithContract, table, ADMIN_AUTH_HEADERS);
    assertNotNull(patched);
    assertEquals("This is a valid description", patched.getDescription());
    assertEquals(table.getOwners().getFirst().getId(), TEAM11_REF.getId());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void engineBlocksWrongTableCreationWithComplexSemantics(TestInfo test) throws IOException {

    CreateDomain createDomain =
        domainResourceTest
            .createRequest(test)
            .withName("Data")
            .withDescription("Data domain")
            .withOwners(List.of(USER1_REF));
    Domain dataDomain = domainResourceTest.createEntity(createDomain, ADMIN_AUTH_HEADERS);

    CreateTable createWithContract =
        tableResourceTest.createRequest(test).withDescription(null).withName(test.getDisplayName());
    Table tableWithContract =
        tableResourceTest.createEntity(createWithContract, ADMIN_AUTH_HEADERS);

    CreateDataContract createContractForTable =
        dataContractResourceTest
            .createDataContractRequest(test.getDisplayName(), tableWithContract)
            .withStatus(ContractStatus.Active)
            .withSemantics(
                List.of(
                    new SemanticsRule()
                        .withName("Description can't be empty")
                        .withDescription("Validates that the table has a description.")
                        .withRule("{ \"!!\": { \"var\": \"description\" } }"),
                    new SemanticsRule()
                        .withName("Owner should not be empty")
                        .withDescription("Validates that the table has at least one owner.")
                        .withRule("{ \"!!\": { \"var\": \"owners\" } }"),
                    new SemanticsRule()
                        .withName("Owner should be a team")
                        .withDescription("Validates owners is a single team.")
                        .withRule(
                            "{\"==\":[{\"length\":[{\"filterReferenceByType\":[{\"var\":\"owners\"},\"team\"]}]},1]}"),
                    new SemanticsRule()
                        .withName("Domain should be Data")
                        .withDescription("Validates that the table belongs to the 'Data' domain.")
                        .withRule(
                            "{\"and\":[{\"!!\":{\"var\":\"domains\"}},{\"some\":[{\"var\":\"domains\"},{\"==\":[{\"var\":\"name\"},\"Data\"]}]}]}")));

    dataContractResourceTest.createDataContract(createContractForTable);

    // Table does indeed blow up
    assertThrows(
        RuleValidationException.class,
        () -> RuleEngine.getInstance().evaluate(tableWithContract, false, true));

    String tableJsonWithContract = JsonUtils.pojoToJson(tableWithContract);
    tableWithContract.withDescription("This is a valid description");

    // Even if some rules failed, we should be able to patch the table since we're fixing one rule
    Table patched =
        tableResourceTest.patchEntity(
            tableWithContract.getId(),
            tableJsonWithContract,
            tableWithContract,
            ADMIN_AUTH_HEADERS);

    // The patched table still blows up, since we've only fixed one rule
    assertThrows(
        RuleValidationException.class,
        () -> RuleEngine.getInstance().evaluate(patched, true, true));

    String patchedJson = JsonUtils.pojoToJson(patched);
    patched.withOwners(List.of(TEAM11_REF));
    patched.withDomains(List.of(dataDomain.getEntityReference()));

    // Now we're fixing everything in one go
    Table fixedTable =
        tableResourceTest.patchEntity(patched.getId(), patchedJson, patched, ADMIN_AUTH_HEADERS);

    // Table is patched properly and is not blowing up anymore
    assertNotNull(fixedTable);
    RuleEngine.getInstance().evaluate(fixedTable, true, true);
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void validateRuleApplicationLogic(TestInfo test) {
    Table table = getMockTable(test);

    SemanticsRule ruleWithoutFilters =
        new SemanticsRule()
            .withName("Rule without filters")
            .withDescription("This rule has no filters applied.")
            .withRule("");

    Assertions.assertTrue(RuleEngine.getInstance().shouldApplyRule(table, ruleWithoutFilters));

    SemanticsRule ruleWithIgnoredEntities =
        new SemanticsRule()
            .withName("Rule without filters")
            .withDescription("This rule has no filters applied.")
            .withRule("")
            .withIgnoredEntities(List.of(Entity.DOMAIN, Entity.GLOSSARY_TERM));
    // Not ignored the table, should pass
    Assertions.assertTrue(RuleEngine.getInstance().shouldApplyRule(table, ruleWithIgnoredEntities));

    SemanticsRule ruleWithTableEntity =
        new SemanticsRule()
            .withName("Rule without filters")
            .withDescription("This rule has no filters applied.")
            .withRule("")
            .withEntityType(Entity.TABLE);
    // Not ignored the table, should pass
    Assertions.assertTrue(RuleEngine.getInstance().shouldApplyRule(table, ruleWithTableEntity));

    SemanticsRule ruleWithDomainEntity =
        new SemanticsRule()
            .withName("Rule without filters")
            .withDescription("This rule has no filters applied.")
            .withRule("")
            .withEntityType(Entity.DOMAIN);
    // Ignored the table, should not pass
    Assertions.assertFalse(RuleEngine.getInstance().shouldApplyRule(table, ruleWithDomainEntity));

    SemanticsRule ruleWithIgnoredTable =
        new SemanticsRule()
            .withName("Rule without filters")
            .withDescription("This rule has no filters applied.")
            .withRule("")
            .withIgnoredEntities(List.of(Entity.TABLE));
    // Ignored the table, should not pass
    Assertions.assertFalse(RuleEngine.getInstance().shouldApplyRule(table, ruleWithIgnoredTable));
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testPIISensitiveTagRule(TestInfo test) {
    Table table = getMockTable(test).withTags(List.of());

    SemanticsRule piiRule =
        new SemanticsRule()
            .withName("Table has non-PII.Sensitive tags")
            .withDescription("Table is not allowed to have PII.Sensitive tags")
            .withRule("{\"!\":{\"some\":[{\"var\":\"tags\"},{\"==\":[{\"var\":\"tagFQN\"},\"PII.Sensitive\"]}]}}");

    RuleEngine.getInstance().evaluate(table, List.of(piiRule), false, false);

    table.withTags(List.of(PII_SENSITIVE_TAG_LABEL));
    assertThrows(
        RuleValidationException.class,
        () -> RuleEngine.getInstance().evaluate(table, List.of(piiRule), false, false));

    table.withTags(List.of(PII_SENSITIVE_TAG_LABEL, TIER1_TAG_LABEL));
    assertThrows(
        RuleValidationException.class,
        () -> RuleEngine.getInstance().evaluate(table, List.of(piiRule), false, false));

    table.withTags(List.of(TIER1_TAG_LABEL));
    RuleEngine.getInstance().evaluate(table, List.of(piiRule), false, false);
  }
}
