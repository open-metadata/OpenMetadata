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
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.configuration.EntityRulesSettings;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.SemanticsRule;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.data.DataContractResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.domains.DataProductResourceTest;
import org.openmetadata.service.resources.domains.DomainResourceTest;
import org.openmetadata.service.resources.settings.SettingsCache;

public class RuleEngineTests extends OpenMetadataApplicationTest {

  private static TableResourceTest tableResourceTest;
  private static DataContractResourceTest dataContractResourceTest;
  private static DomainResourceTest domainResourceTest;
  private static DataProductResourceTest dataProductResourceTest;

  private static final String C1 = "id";
  private static final String C2 = "name";
  private static final String C3 = "description";
  private static final String EMAIL_COL = "email";

  private static final String GLOSSARY_TERM_RULE = "Tables can only have a single Glossary Term";
  private static final String OWNERSHIP_RULE_EXC =
      "Rule [Multiple Users or Single Team Ownership] validation failed: Entity does not satisfy the rule. "
          + "Rule context: Validates that an entity has either multiple owners or a single team as the owner.";
  private static final String DATA_PRODUCT_DOMAIN_RULE_EXC =
      "Rule [Data Product Domain Validation] validation failed: Entity does not satisfy the rule. "
          + "Rule context: Validates that Data Products assigned to an entity match the entity's domains.";
  private static final String DATA_PRODUCT_DOMAIN_RULE = "Data Product Domain Validation";

  @BeforeAll
  static void setup(TestInfo test) throws IOException, URISyntaxException {
    tableResourceTest = new TableResourceTest();
    tableResourceTest.setup(test);
    dataContractResourceTest = new DataContractResourceTest();
    domainResourceTest = new DomainResourceTest();
    dataProductResourceTest = new DataProductResourceTest();
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
    // Enable it for the test
    glossaryRule.setEnabled(true);

    // Enable the rule for testing
    glossaryRule.withEnabled(true);

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
            .withEntityStatus(EntityStatus.APPROVED)
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
            .createRequest(test.getDisplayName() + "_Data")
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
            .withEntityStatus(EntityStatus.APPROVED)
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

    // Table does indeed blow up when evaluated against data contract rules
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
            .withRule(
                "{\"!\":{\"some\":[{\"var\":\"tags\"},{\"==\":[{\"var\":\"tagFQN\"},\"PII.Sensitive\"]}]}}");

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

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testContainsOperator(TestInfo test) {
    Table table = getMockTable(test);

    // Test case 1: Empty tags - rule should fail (no tags to check)
    table.withTags(List.of());
    SemanticsRule containsRule =
        new SemanticsRule()
            .withName("Tag FQN must be in allowed list")
            .withDescription("Validates that tagFQN is contained in the allowed list")
            .withRule(
                "{\"and\":[{\"some\":[{\"var\":\"tags\"},{\"contains\":[{\"var\":\"tagFQN\"},[\"Tier.Tier3\",\"Tier.Tier2\"]]}]}]}");

    assertThrows(
        RuleValidationException.class,
        () -> RuleEngine.getInstance().evaluate(table, List.of(containsRule), false, false));

    // Test case 2: Tags with matching FQN - rule should pass
    TagLabel allowedTag =
        new TagLabel().withTagFQN("Tier.Tier2").withSource(TagLabel.TagSource.CLASSIFICATION);
    table.withTags(List.of(allowedTag));
    RuleEngine.getInstance().evaluate(table, List.of(containsRule), false, false);

    // Test case 3: Tags with non-matching FQN - rule should fail
    TagLabel disallowedTag =
        new TagLabel().withTagFQN("Tier.Tier1").withSource(TagLabel.TagSource.CLASSIFICATION);
    table.withTags(List.of(disallowedTag));
    assertThrows(
        RuleValidationException.class,
        () -> RuleEngine.getInstance().evaluate(table, List.of(containsRule), false, false));

    // Test case 4: Multiple tags with at least one matching FQN - rule should pass
    table.withTags(List.of(disallowedTag, allowedTag));
    RuleEngine.getInstance().evaluate(table, List.of(containsRule), false, false);

    // Test case 5: Multiple allowed tags - rule should pass
    TagLabel anotherAllowedTag =
        new TagLabel().withTagFQN("Tier.Tier3").withSource(TagLabel.TagSource.CLASSIFICATION);
    table.withTags(List.of(allowedTag, anotherAllowedTag));
    RuleEngine.getInstance().evaluate(table, List.of(containsRule), false, false);
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testContainsOperatorEdgeCases(TestInfo test) {
    Table table = getMockTable(test);

    // Test case 1: Rule with single allowed value
    SemanticsRule singleValueRule =
        new SemanticsRule()
            .withName("Tag FQN must be specific value")
            .withDescription("Validates that tagFQN equals specific value using contains")
            .withRule(
                "{\"and\":[{\"some\":[{\"var\":\"tags\"},{\"contains\":[{\"var\":\"tagFQN\"},[\"Tier.Tier1\"]]}]}]}");

    TagLabel exactMatch =
        new TagLabel().withTagFQN("Tier.Tier1").withSource(TagLabel.TagSource.CLASSIFICATION);
    table.withTags(List.of(exactMatch));
    RuleEngine.getInstance().evaluate(table, List.of(singleValueRule), false, false);

    TagLabel noMatch =
        new TagLabel().withTagFQN("Tier.Tier2").withSource(TagLabel.TagSource.CLASSIFICATION);
    table.withTags(List.of(noMatch));
    assertThrows(
        RuleValidationException.class,
        () -> RuleEngine.getInstance().evaluate(table, List.of(singleValueRule), false, false));

    // Test case 2: Mixed tag sources (Glossary and Classification)
    SemanticsRule mixedSourceRule =
        new SemanticsRule()
            .withName("Allow mixed tag sources")
            .withDescription("Validates that either glossary or classification tags are allowed")
            .withRule(
                "{\"and\":[{\"some\":[{\"var\":\"tags\"},{\"contains\":[{\"var\":\"tagFQN\"},[\"Glossary.Term1\",\"Tier.Tier1\"]]}]}]}");

    TagLabel glossaryTag =
        new TagLabel().withTagFQN("Glossary.Term1").withSource(TagLabel.TagSource.GLOSSARY);
    TagLabel classificationTag =
        new TagLabel().withTagFQN("Tier.Tier1").withSource(TagLabel.TagSource.CLASSIFICATION);

    // Test with glossary tag
    table.withTags(List.of(glossaryTag));
    RuleEngine.getInstance().evaluate(table, List.of(mixedSourceRule), false, false);

    // Test with classification tag
    table.withTags(List.of(classificationTag));
    RuleEngine.getInstance().evaluate(table, List.of(mixedSourceRule), false, false);

    // Test with both
    table.withTags(List.of(glossaryTag, classificationTag));
    RuleEngine.getInstance().evaluate(table, List.of(mixedSourceRule), false, false);

    // Test with neither allowed
    TagLabel disallowedTag =
        new TagLabel().withTagFQN("NotAllowed.Tag").withSource(TagLabel.TagSource.CLASSIFICATION);
    table.withTags(List.of(disallowedTag));
    assertThrows(
        RuleValidationException.class,
        () -> RuleEngine.getInstance().evaluate(table, List.of(mixedSourceRule), false, false));
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testContainsOperatorNegation(TestInfo test) {
    Table table = getMockTable(test);

    // Rule using proper negation logic: NO tag should be forbidden
    // {"!":{"some":[{"var":"tags"},{"contains":[{"var":"tagFQN"},["Forbidden.Tag1"]]}]}}
    SemanticsRule noForbiddenTagsRule =
        new SemanticsRule()
            .withName("No forbidden tags allowed")
            .withDescription(
                "Validates that no tag is forbidden - fails if ANY tag is in the forbidden list")
            .withRule(
                "{\"!\":{\"some\":[{\"var\":\"tags\"},{\"contains\":[{\"var\":\"tagFQN\"},[\"Forbidden.Tag1\",\"Forbidden.Tag2\"]]}]}}");

    // Test with allowed tags only - should PASS
    TagLabel allowedTag1 =
        new TagLabel().withTagFQN("Tier.Tier1").withSource(TagLabel.TagSource.CLASSIFICATION);
    TagLabel allowedTag2 =
        new TagLabel().withTagFQN("Tier.Tier2").withSource(TagLabel.TagSource.CLASSIFICATION);
    table.withTags(List.of(allowedTag1, allowedTag2));
    RuleEngine.getInstance().evaluate(table, List.of(noForbiddenTagsRule), false, false);

    // Test with forbidden tag only - should FAIL
    TagLabel forbiddenTag =
        new TagLabel().withTagFQN("Forbidden.Tag1").withSource(TagLabel.TagSource.CLASSIFICATION);
    table.withTags(List.of(forbiddenTag));
    assertThrows(
        RuleValidationException.class,
        () -> RuleEngine.getInstance().evaluate(table, List.of(noForbiddenTagsRule), false, false));

    // Test with mixed: one valid tag and one forbidden tag - should FAIL
    // This is the key test case requested
    table.withTags(List.of(allowedTag1, forbiddenTag));
    assertThrows(
        RuleValidationException.class,
        () -> RuleEngine.getInstance().evaluate(table, List.of(noForbiddenTagsRule), false, false));

    // Test with empty tags - should PASS (no forbidden tags)
    table.withTags(List.of());
    RuleEngine.getInstance().evaluate(table, List.of(noForbiddenTagsRule), false, false);

    // Test with multiple forbidden tags - should FAIL
    TagLabel anotherForbiddenTag =
        new TagLabel().withTagFQN("Forbidden.Tag2").withSource(TagLabel.TagSource.CLASSIFICATION);
    table.withTags(List.of(forbiddenTag, anotherForbiddenTag));
    assertThrows(
        RuleValidationException.class,
        () -> RuleEngine.getInstance().evaluate(table, List.of(noForbiddenTagsRule), false, false));
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testNegationLogicForForbiddenTags(TestInfo test) {
    Table table = getMockTable(test);

    // Rule that validates NO tag should be forbidden using correct negation logic
    // {"!":{"some":[{"var":"tags"},{"contains":[{"var":"tagFQN"},["Tier.Tier1"]]}]}}
    // This means: NOT(some tag contains forbidden value) = no forbidden tags allowed
    SemanticsRule noForbiddenTagsRule =
        new SemanticsRule()
            .withName("No forbidden tags allowed")
            .withDescription(
                "Validates that no tag is forbidden - fails if ANY tag is in the forbidden list")
            .withRule(
                "{\"!\":{\"some\":[{\"var\":\"tags\"},{\"contains\":[{\"var\":\"tagFQN\"},[\"Tier.Tier1\"]]}]}}");

    // Test scenario 1: ALL tags are valid (not forbidden) - should PASS
    TagLabel validTag1 =
        new TagLabel().withTagFQN("Tier.Tier2").withSource(TagLabel.TagSource.CLASSIFICATION);
    TagLabel validTag2 =
        new TagLabel().withTagFQN("Tier.Tier3").withSource(TagLabel.TagSource.CLASSIFICATION);
    table.withTags(List.of(validTag1, validTag2));
    RuleEngine.getInstance().evaluate(table, List.of(noForbiddenTagsRule), false, false);

    // Test scenario 2: Mixed - ONE valid tag and ONE forbidden tag - should FAIL
    // This is the key test case you requested
    TagLabel forbiddenTag =
        new TagLabel().withTagFQN("Tier.Tier1").withSource(TagLabel.TagSource.CLASSIFICATION);
    TagLabel validTag =
        new TagLabel().withTagFQN("Tier.Tier2").withSource(TagLabel.TagSource.CLASSIFICATION);
    table.withTags(List.of(forbiddenTag, validTag));
    assertThrows(
        RuleValidationException.class,
        () -> RuleEngine.getInstance().evaluate(table, List.of(noForbiddenTagsRule), false, false));

    // Test scenario 3: ALL tags are forbidden - should FAIL
    TagLabel anotherForbiddenTag =
        new TagLabel().withTagFQN("Tier.Tier1").withSource(TagLabel.TagSource.CLASSIFICATION);
    table.withTags(List.of(forbiddenTag, anotherForbiddenTag));
    assertThrows(
        RuleValidationException.class,
        () -> RuleEngine.getInstance().evaluate(table, List.of(noForbiddenTagsRule), false, false));

    // Test scenario 4: Single valid tag - should PASS
    table.withTags(List.of(validTag1));
    RuleEngine.getInstance().evaluate(table, List.of(noForbiddenTagsRule), false, false);

    // Test scenario 5: Single forbidden tag - should FAIL
    table.withTags(List.of(forbiddenTag));
    assertThrows(
        RuleValidationException.class,
        () -> RuleEngine.getInstance().evaluate(table, List.of(noForbiddenTagsRule), false, false));

    // Test scenario 6: Empty tags list - should PASS (no tags = no forbidden tags)
    table.withTags(List.of());
    RuleEngine.getInstance().evaluate(table, List.of(noForbiddenTagsRule), false, false);

    // Test scenario 7: Multiple forbidden values
    SemanticsRule multipleForbiddenRule =
        new SemanticsRule()
            .withName("No tags should be Tier1 or Tier2")
            .withDescription("Validates that no tag is Tier1 or Tier2")
            .withRule(
                "{\"!\":{\"some\":[{\"var\":\"tags\"},{\"contains\":[{\"var\":\"tagFQN\"},[\"Tier.Tier1\",\"Tier.Tier2\"]]}]}}");

    // All valid tags (not in forbidden list) - should PASS
    TagLabel validTag3 =
        new TagLabel().withTagFQN("Tier.Tier3").withSource(TagLabel.TagSource.CLASSIFICATION);
    TagLabel validTag4 =
        new TagLabel().withTagFQN("Tier.Tier4").withSource(TagLabel.TagSource.CLASSIFICATION);
    table.withTags(List.of(validTag3, validTag4));
    RuleEngine.getInstance().evaluate(table, List.of(multipleForbiddenRule), false, false);

    // Mix of valid and forbidden - should FAIL (any forbidden tag fails)
    TagLabel tier2Tag =
        new TagLabel().withTagFQN("Tier.Tier2").withSource(TagLabel.TagSource.CLASSIFICATION);
    table.withTags(List.of(validTag3, tier2Tag, validTag4));
    assertThrows(
        RuleValidationException.class,
        () ->
            RuleEngine.getInstance().evaluate(table, List.of(multipleForbiddenRule), false, false));

    // All forbidden tags - should FAIL
    table.withTags(List.of(forbiddenTag, tier2Tag));
    assertThrows(
        RuleValidationException.class,
        () ->
            RuleEngine.getInstance().evaluate(table, List.of(multipleForbiddenRule), false, false));

    // Test scenario 8: Mixed tag sources (Classification and Glossary)
    TagLabel glossaryTag =
        new TagLabel().withTagFQN("Glossary.Term1").withSource(TagLabel.TagSource.GLOSSARY);

    // Valid glossary tag with forbidden classification tag - should FAIL
    table.withTags(List.of(forbiddenTag, glossaryTag));
    assertThrows(
        RuleValidationException.class,
        () -> RuleEngine.getInstance().evaluate(table, List.of(noForbiddenTagsRule), false, false));

    // Only valid tags from different sources - should PASS
    table.withTags(List.of(validTag1, glossaryTag));
    RuleEngine.getInstance().evaluate(table, List.of(noForbiddenTagsRule), false, false);
  }

  /**
   * Helper method to create a real Domain entity for testing
   */
  Domain createTestDomain(String name, TestInfo test) throws IOException {
    CreateDomain createDomain =
        domainResourceTest
            .createRequest(test.getDisplayName() + "_" + name)
            .withDescription("Test domain: " + name);
    return domainResourceTest.createEntity(createDomain, ADMIN_AUTH_HEADERS);
  }

  /**
   * Helper method to create a real DataProduct entity for testing
   */
  DataProduct createTestDataProduct(String name, List<Domain> domains, TestInfo test)
      throws IOException {
    String entityName = test.getDisplayName() + "_" + name;

    CreateDataProduct createDataProduct =
        dataProductResourceTest
            .createRequest(entityName)
            .withName(entityName)
            .withDescription("Test data product: " + name);

    if (domains != null && !domains.isEmpty()) {
      createDataProduct.withDomains(
          domains.stream().map(domain -> domain.getFullyQualifiedName()).toList());
    }

    return dataProductResourceTest.createEntity(createDataProduct, ADMIN_AUTH_HEADERS);
  }

  /**
   * Helper method to get the Data Product Domain Validation rule
   */
  SemanticsRule getDataProductDomainRule() {
    List<SemanticsRule> rules =
        SettingsCache.getSetting(SettingsType.ENTITY_RULES_SETTINGS, EntityRulesSettings.class)
            .getEntitySemantics();

    return rules.stream()
        .filter(rule -> DATA_PRODUCT_DOMAIN_RULE.equals(rule.getName()))
        .findFirst()
        .orElseThrow(
            () ->
                new IllegalStateException(
                    "Data Product Domain Validation rule not found. Review the entityRulesSettings.json file."));
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testDataProductDomainValidation_RuleEnabled_MatchingDomains_ShouldPass(TestInfo test)
      throws IOException {
    // Create domains
    Domain dataDomain = createTestDomain("Data", test);
    Domain engineeringDomain = createTestDomain("Engineering", test);

    // Create data products with matching domains
    DataProduct dataProduct1 = createTestDataProduct("Product1", List.of(dataDomain), test);
    DataProduct dataProduct2 = createTestDataProduct("Product2", List.of(engineeringDomain), test);

    EntityResourceTest.toggleMultiDomainSupport(false);
    // Create table with domains that match the data products
    CreateTable createTable =
        tableResourceTest
            .createRequest(test)
            .withDomains(
                List.of(
                    dataDomain.getFullyQualifiedName(), engineeringDomain.getFullyQualifiedName()))
            .withDataProducts(
                List.of(
                    dataProduct1.getFullyQualifiedName(), dataProduct2.getFullyQualifiedName()));

    Table table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    SemanticsRule rule = getDataProductDomainRule();

    // Should pass validation as entity domains match data product domains
    RuleEngine.getInstance().evaluate(table, List.of(rule), false, false);
    EntityResourceTest.toggleMultiDomainSupport(true);
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testDataProductDomainValidation_RuleEnabled_NoMatchingDomains_ShouldFail(TestInfo test)
      throws IOException {
    // Create domains
    Domain dataDomain = createTestDomain("Data", test);
    Domain engineeringDomain = createTestDomain("Engineering", test);
    Domain marketingDomain = createTestDomain("Marketing", test);

    // Create data products with different domains than entity
    DataProduct dataProduct1 = createTestDataProduct("Product1", List.of(dataDomain), test);
    DataProduct dataProduct2 = createTestDataProduct("Product2", List.of(engineeringDomain), test);

    // Create table with domains that don't match the data products
    CreateTable createTable =
        tableResourceTest
            .createRequest(test)
            .withDomains(List.of(marketingDomain.getFullyQualifiedName()))
            .withDataProducts(
                List.of(
                    dataProduct1.getFullyQualifiedName(), dataProduct2.getFullyQualifiedName()));

    // Should fail validation as entity domains don't match data product domains
    assertResponse(
        () -> tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS),
        Response.Status.BAD_REQUEST,
        DATA_PRODUCT_DOMAIN_RULE_EXC);

    // But I can disable the rule and create it
    EntityResourceTest.toggleRule(DATA_PRODUCT_DOMAIN_RULE, false);
    tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);
    EntityResourceTest.toggleRule(DATA_PRODUCT_DOMAIN_RULE, true);
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testDataProductDomainValidation_RuleEnabled_MixedMatching_ShouldFail(TestInfo test)
      throws IOException {
    // Create domains
    Domain dataDomain = createTestDomain("Data", test);
    Domain engineeringDomain = createTestDomain("Engineering", test);
    Domain marketingDomain = createTestDomain("Marketing", test);

    // Create data products - one matches, one doesn't
    DataProduct matchingDataProduct =
        createTestDataProduct("MatchingProduct", List.of(dataDomain), test);
    DataProduct nonMatchingDataProduct =
        createTestDataProduct("NonMatchingProduct", List.of(marketingDomain), test);

    // Create table with some matching and some non-matching domains
    CreateTable createTable =
        tableResourceTest
            .createRequest(test)
            .withDomains(
                List.of(
                    dataDomain.getFullyQualifiedName(), engineeringDomain.getFullyQualifiedName()))
            .withDataProducts(
                List.of(
                    matchingDataProduct.getFullyQualifiedName(),
                    nonMatchingDataProduct.getFullyQualifiedName()));

    // Should fail during entity creation due to rule validation
    assertResponse(
        () -> tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS),
        Response.Status.BAD_REQUEST,
        "Entity does not satisfy multiple rules\n"
            + "Rule [Multiple Domains are not allowed] validation failed: Rule context: By default, we only allow entities to be assigned to a single domain, except for Users and Teams.\n"
            + "Rule [Data Product Domain Validation] validation failed: Rule context: Validates that Data Products assigned to an entity match the entity's domains.");
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testDataProductDomainValidation_RuleDisabled_DifferentDomains_ShouldPass(TestInfo test)
      throws IOException {
    // Store original rule state
    SemanticsRule originalRule = getDataProductDomainRule();
    Boolean originalEnabled = originalRule.getEnabled();

    try {
      // Disable the rule using the system settings
      EntityResourceTest.toggleRule(DATA_PRODUCT_DOMAIN_RULE, false);

      // Create domains
      Domain dataDomain = createTestDomain("Data", test);
      Domain engineeringDomain = createTestDomain("Engineering", test);
      Domain marketingDomain = createTestDomain("Marketing", test);

      // Create data products with completely different domains than entity
      DataProduct dataProduct1 = createTestDataProduct("Product1", List.of(dataDomain), test);
      DataProduct dataProduct2 =
          createTestDataProduct("Product2", List.of(engineeringDomain), test);

      // Create table with domains that don't match the data products
      CreateTable createTable =
          tableResourceTest
              .createRequest(test)
              .withDomains(List.of(marketingDomain.getFullyQualifiedName()))
              .withDataProducts(
                  List.of(
                      dataProduct1.getFullyQualifiedName(), dataProduct2.getFullyQualifiedName()));

      Table table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

      SemanticsRule rule = getDataProductDomainRule();

      // Should pass validation when rule is disabled, even with non-matching domains
      RuleEngine.getInstance().evaluate(table, List.of(rule), false, false);
    } finally {
      // Restore original rule state
      EntityResourceTest.toggleRule(DATA_PRODUCT_DOMAIN_RULE, originalEnabled);
    }
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testDataProductDomainValidation_EdgeCase_EntityWithNullDomains_ShouldHandleGracefully(
      TestInfo test) throws IOException {
    // Create domain and data product
    Domain dataDomain = createTestDomain("Data", test);
    DataProduct dataProduct = createTestDataProduct("Product1", List.of(dataDomain), test);

    // Create table with no domains but assigned to data products with domains
    CreateTable createTable =
        tableResourceTest
            .createRequest(test)
            .withDomains(null) // No domains
            .withDataProducts(List.of(dataProduct.getFullyQualifiedName()));

    // Should fail during entity creation due to rule validation
    assertResponse(
        () -> tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS),
        Response.Status.BAD_REQUEST,
        DATA_PRODUCT_DOMAIN_RULE_EXC);
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testDataProductDomainValidation_EdgeCase_DataProductWithNullDomains_ShouldHandleGracefully(
      TestInfo test) throws IOException {
    // Create domain for entity and data product with no domains
    Domain dataDomain = createTestDomain("Data", test);
    DataProduct dataProduct = createTestDataProduct("Product1", null, test);

    // Create table with domains but assigned to data products with no domains
    CreateTable createTable =
        tableResourceTest
            .createRequest(test)
            .withDomains(List.of(dataDomain.getFullyQualifiedName()))
            .withDataProducts(List.of(dataProduct.getFullyQualifiedName()));

    // Should fail during entity creation due to rule validation
    assertResponse(
        () -> tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS),
        Response.Status.BAD_REQUEST,
        DATA_PRODUCT_DOMAIN_RULE_EXC);
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testDataProductDomainValidation_EdgeCase_NoDataProducts_ShouldAlwaysPass(TestInfo test)
      throws IOException {
    // Create domain for entity
    Domain dataDomain = createTestDomain("Data", test);

    // Create table with domains but no data products assigned
    CreateTable createTable =
        tableResourceTest
            .createRequest(test)
            .withDomains(List.of(dataDomain.getFullyQualifiedName()))
            .withDataProducts(null); // No data products

    Table table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    SemanticsRule rule = getDataProductDomainRule();

    // Should always pass validation when entity has no data products
    RuleEngine.getInstance().evaluate(table, List.of(rule), false, false);

    // Also test with empty list
    CreateTable createTableEmpty =
        tableResourceTest
            .createRequest(test.getDisplayName() + "_empty")
            .withDomains(List.of(dataDomain.getFullyQualifiedName()))
            .withDataProducts(List.of()); // Empty data products

    Table tableEmpty = tableResourceTest.createEntity(createTableEmpty, ADMIN_AUTH_HEADERS);
    RuleEngine.getInstance().evaluate(tableEmpty, List.of(rule), false, false);
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testDataProductDomainValidation_EdgeCase_NoDomains_ShouldHandleGracefully(TestInfo test)
      throws IOException {
    // Create data product with no domains
    DataProduct dataProduct = createTestDataProduct("Product1", null, test);

    // Create table with no domains assigned to data products with no domains
    CreateTable createTable =
        tableResourceTest
            .createRequest(test)
            .withDomains(null) // No domains
            .withDataProducts(List.of(dataProduct.getFullyQualifiedName()));

    // Should fail during entity creation due to rule validation
    assertResponse(
        () -> tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS),
        Response.Status.BAD_REQUEST,
        DATA_PRODUCT_DOMAIN_RULE_EXC);

    // Also test with empty domain lists
    CreateTable createTableEmpty =
        tableResourceTest
            .createRequest(test.getDisplayName() + "_empty")
            .withDomains(List.of()) // Empty domains
            .withDataProducts(List.of(dataProduct.getFullyQualifiedName()));

    // Should also fail during entity creation due to rule validation
    assertResponse(
        () -> tableResourceTest.createEntity(createTableEmpty, ADMIN_AUTH_HEADERS),
        Response.Status.BAD_REQUEST,
        DATA_PRODUCT_DOMAIN_RULE_EXC);
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testDataProductDomainValidation_ComprehensiveScenarios(TestInfo test) throws IOException {
    // Store original rule state for cleanup
    SemanticsRule originalRule = getDataProductDomainRule();
    Boolean originalEnabled = originalRule.getEnabled();

    try {
      // Setup test data - domains and data products
      Domain dataDomain = createTestDomain("Data", test);
      Domain engineeringDomain = createTestDomain("Engineering", test);
      Domain marketingDomain = createTestDomain("Marketing", test);

      DataProduct dataProductWithDataDomain =
          createTestDataProduct("DataProduct", List.of(dataDomain), test);
      DataProduct dataProductWithEngineeringDomain =
          createTestDataProduct("EngineeringProduct", List.of(engineeringDomain), test);
      DataProduct dataProductWithNoDomains = createTestDataProduct("NoDomainProduct", null, test);

      // Test 1: Matching domains - should pass
      CreateTable matchingDomainsTable =
          tableResourceTest
              .createRequest(test.getDisplayName() + "_matching")
              .withDomains(List.of(dataDomain.getFullyQualifiedName()))
              .withDataProducts(List.of(dataProductWithDataDomain.getFullyQualifiedName()));

      Table createdTable = tableResourceTest.createEntity(matchingDomainsTable, ADMIN_AUTH_HEADERS);
      assertNotNull(createdTable);
      assertEquals(1, createdTable.getDomains().size());
      assertEquals(1, createdTable.getDataProducts().size());

      // Test 2: Non-matching domains - should fail
      CreateTable nonMatchingDomainsTable =
          tableResourceTest
              .createRequest(test.getDisplayName() + "_non_matching")
              .withDomains(List.of(marketingDomain.getFullyQualifiedName()))
              .withDataProducts(List.of(dataProductWithDataDomain.getFullyQualifiedName()));

      assertResponse(
          () -> tableResourceTest.createEntity(nonMatchingDomainsTable, ADMIN_AUTH_HEADERS),
          Response.Status.BAD_REQUEST,
          DATA_PRODUCT_DOMAIN_RULE_EXC);

      // Test 3: Disable rule and retry - should pass
      EntityResourceTest.toggleRule(DATA_PRODUCT_DOMAIN_RULE, false);
      Table createdWithDisabledRule =
          tableResourceTest.createEntity(nonMatchingDomainsTable, ADMIN_AUTH_HEADERS);
      assertNotNull(createdWithDisabledRule);

      // Re-enable rule for remaining tests
      EntityResourceTest.toggleRule(DATA_PRODUCT_DOMAIN_RULE, true);

      // Test 4: Entity with null domains but data products with domains - should fail
      CreateTable nullDomainsTable =
          tableResourceTest
              .createRequest(test.getDisplayName() + "_null_domains")
              .withDomains(null)
              .withDataProducts(List.of(dataProductWithDataDomain.getFullyQualifiedName()));

      assertResponse(
          () -> tableResourceTest.createEntity(nullDomainsTable, ADMIN_AUTH_HEADERS),
          Response.Status.BAD_REQUEST,
          DATA_PRODUCT_DOMAIN_RULE_EXC);

      // Test 5: Entity with domains but data products with null domains - should fail
      CreateTable dataProductNullDomainsTable =
          tableResourceTest
              .createRequest(test.getDisplayName() + "_dp_null_domains")
              .withDomains(List.of(dataDomain.getFullyQualifiedName()))
              .withDataProducts(List.of(dataProductWithNoDomains.getFullyQualifiedName()));

      assertResponse(
          () -> tableResourceTest.createEntity(dataProductNullDomainsTable, ADMIN_AUTH_HEADERS),
          Response.Status.BAD_REQUEST,
          DATA_PRODUCT_DOMAIN_RULE_EXC);

      // Test 6: No data products - should always pass
      CreateTable noDataProductsTable =
          tableResourceTest
              .createRequest(test.getDisplayName() + "_no_data_products")
              .withDomains(List.of(dataDomain.getFullyQualifiedName()))
              .withDataProducts(null);

      Table tableWithNoDataProducts =
          tableResourceTest.createEntity(noDataProductsTable, ADMIN_AUTH_HEADERS);
      assertNotNull(tableWithNoDataProducts);

      // Test 7: Empty data products list - should also pass
      CreateTable emptyDataProductsTable =
          tableResourceTest
              .createRequest(test.getDisplayName() + "_empty_data_products")
              .withDomains(List.of(dataDomain.getFullyQualifiedName()))
              .withDataProducts(List.of());

      Table tableWithEmptyDataProducts =
          tableResourceTest.createEntity(emptyDataProductsTable, ADMIN_AUTH_HEADERS);
      assertNotNull(tableWithEmptyDataProducts);

      // Test 8: Disable rule for failing case and verify success
      EntityResourceTest.toggleRule(DATA_PRODUCT_DOMAIN_RULE, false);

      CreateTable previouslyFailingTable =
          tableResourceTest
              .createRequest(test.getDisplayName() + "_previously_failing")
              .withDomains(null)
              .withDataProducts(List.of(dataProductWithDataDomain.getFullyQualifiedName()));

      Table successWithDisabledRule =
          tableResourceTest.createEntity(previouslyFailingTable, ADMIN_AUTH_HEADERS);
      assertNotNull(successWithDisabledRule);

    } finally {
      // Restore original states
      EntityResourceTest.toggleRule(DATA_PRODUCT_DOMAIN_RULE, originalEnabled);
    }
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testDataProductDomainValidation_MultiDomainScenarios(TestInfo test) throws IOException {
    // Store original states
    SemanticsRule originalRule = getDataProductDomainRule();
    Boolean originalEnabled = originalRule.getEnabled();
    EntityResourceTest.toggleMultiDomainSupport(true);

    try {
      // Setup test data
      Domain dataDomain = createTestDomain("Data", test);
      Domain engineeringDomain = createTestDomain("Engineering", test);
      Domain marketingDomain = createTestDomain("Marketing", test);

      DataProduct matchingDataProduct =
          createTestDataProduct("MatchingProduct", List.of(dataDomain), test);
      DataProduct nonMatchingDataProduct =
          createTestDataProduct("NonMatchingProduct", List.of(marketingDomain), test);

      // Test 1: Multiple domains with mixed matching data products - should fail
      // First disable the multi-domain rule to test only the data product domain rule
      EntityResourceTest.toggleRule("Multiple Domains are not allowed", false);

      CreateTable mixedMatchingTable =
          tableResourceTest
              .createRequest(test.getDisplayName() + "_mixed")
              .withDomains(
                  List.of(
                      dataDomain.getFullyQualifiedName(),
                      engineeringDomain.getFullyQualifiedName()))
              .withDataProducts(
                  List.of(
                      matchingDataProduct.getFullyQualifiedName(),
                      nonMatchingDataProduct.getFullyQualifiedName()));

      assertResponse(
          () -> tableResourceTest.createEntity(mixedMatchingTable, ADMIN_AUTH_HEADERS),
          Response.Status.BAD_REQUEST,
          DATA_PRODUCT_DOMAIN_RULE_EXC);

      // Test 2: Disable rule and retry - should pass
      EntityResourceTest.toggleRule(DATA_PRODUCT_DOMAIN_RULE, false);
      Table createdWithDisabledRule =
          tableResourceTest.createEntity(mixedMatchingTable, ADMIN_AUTH_HEADERS);
      assertNotNull(createdWithDisabledRule);
      assertEquals(2, createdWithDisabledRule.getDomains().size());
      assertEquals(2, createdWithDisabledRule.getDataProducts().size());

      // Test 3: Re-enable rule and test with properly matching domains
      EntityResourceTest.toggleRule(DATA_PRODUCT_DOMAIN_RULE, true);

      DataProduct anotherMatchingProduct =
          createTestDataProduct("AnotherMatchingProduct", List.of(engineeringDomain), test);

      CreateTable properlyMatchingTable =
          tableResourceTest
              .createRequest(test.getDisplayName() + "_properly_matching")
              .withDomains(
                  List.of(
                      dataDomain.getFullyQualifiedName(),
                      engineeringDomain.getFullyQualifiedName()))
              .withDataProducts(
                  List.of(
                      matchingDataProduct.getFullyQualifiedName(),
                      anotherMatchingProduct.getFullyQualifiedName()));

      Table properlyCreatedTable =
          tableResourceTest.createEntity(properlyMatchingTable, ADMIN_AUTH_HEADERS);
      assertNotNull(properlyCreatedTable);
      assertEquals(2, properlyCreatedTable.getDomains().size());
      assertEquals(2, properlyCreatedTable.getDataProducts().size());

    } finally {
      // Restore original states
      EntityResourceTest.toggleRule(DATA_PRODUCT_DOMAIN_RULE, originalEnabled);
      EntityResourceTest.toggleRule("Multiple Domains are not allowed", true);
      EntityResourceTest.toggleMultiDomainSupport(false);
    }
  }
}
