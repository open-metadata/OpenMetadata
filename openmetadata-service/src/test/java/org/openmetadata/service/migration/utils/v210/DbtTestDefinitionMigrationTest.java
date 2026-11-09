package org.openmetadata.service.migration.utils.v210;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestCaseParameter;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.tests.TestPlatform;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.TestDefinitionEntityType;

class DbtTestDefinitionMigrationTest {
  private static final String GENERIC = "unique";
  private static final String LEGACY = "unique_orders_id";
  private static final String DESCRIPTION = "dbt uniqueness check";

  @ParameterizedTest
  @EnumSource(TestDefinitionEntityType.class)
  void derivesSharedNameFromGeneratedParameterAndScope(TestDefinitionEntityType scope) {
    final TestDefinition definition = definition().withEntityType(scope);
    final String expected = scope == TestDefinitionEntityType.COLUMN ? GENERIC : GENERIC + "_table";
    assertEquals(expected, DbtTestDefinitionMigration.sharedName(definition));
    assertNull(DbtTestDefinitionMigration.sharedName(definition.withName(expected)));
  }

  @ParameterizedTest
  @MethodSource("customizations")
  void preservesCustomizedOrUnrecognizedDefinitions(Consumer<TestDefinition> customize) {
    final TestDefinition definition = definition();
    customize.accept(definition);
    assertNull(DbtTestDefinitionMigration.sharedName(definition));
  }

  static Stream<Consumer<TestDefinition>> customizations() {
    return Stream.of(
        d -> d.setProvider(ProviderType.SYSTEM),
        d -> d.setDeleted(true),
        d -> d.setEnabled(false),
        d -> d.setTestPlatforms(List.of(TestPlatform.OPEN_METADATA)),
        d -> d.setDisplayName("Customer-maintained rule"),
        d -> d.setDataQualityDimension("Uniqueness"),
        d -> d.setSqlExpression("SELECT 1"),
        d -> d.setSupportsDynamicAssertion(true),
        d -> d.setParameterDefinition(List.of()),
        d -> d.getParameterDefinition().getFirst().setRequired(true),
        d -> d.getParameterDefinition().getFirst().setDescription("Customer-defined parameter"),
        d -> d.getParameterDefinition().getFirst().setOptionValues(List.of("custom")),
        d -> d.getParameterDefinition().getFirst().setDisplayName("Custom label"));
  }

  @Test
  void requiresEvidenceFromCaseNameDescriptionScopeAndParameters() {
    final TestDefinition definition = definition();
    assertTrue(DbtTestDefinitionMigration.matchesCase(definition, testCase()));
    assertFalse(DbtTestDefinitionMigration.matchesCase(definition, testCase().withName("renamed")));
    assertFalse(
        DbtTestDefinitionMigration.matchesCase(
            definition, testCase().withDescription("Customized")));
    assertFalse(
        DbtTestDefinitionMigration.matchesCase(
            definition, testCase().withEntityLink("<#E::table::svc.db.schema.orders>")));
    assertFalse(
        DbtTestDefinitionMigration.matchesCase(
            definition, testCase().withParameterValues(List.of())));
    assertTrue(
        DbtTestDefinitionMigration.matchesCase(definition.withDescription(null), testCase()));
  }

  @Test
  void refusesIncompatibleCanonicalDefinition() {
    final TestDefinition legacy = definition();
    assertTrue(DbtTestDefinitionMigration.compatibleTarget(legacy, definition().withName(GENERIC)));
    assertFalse(
        DbtTestDefinitionMigration.compatibleTarget(legacy, definition().withEnabled(false)));
    assertFalse(
        DbtTestDefinitionMigration.compatibleTarget(
            legacy, definition().withEntityType(TestDefinitionEntityType.TABLE)));
    assertFalse(
        DbtTestDefinitionMigration.compatibleTarget(
            legacy, definition().withSupportsRowLevelPassedFailed(true)));
    assertFalse(
        DbtTestDefinitionMigration.compatibleTarget(
            legacy, definition().withParameterDefinition(List.of())));
  }

  private static TestDefinition definition() {
    return new TestDefinition()
        .withId(UUID.randomUUID())
        .withName(LEGACY)
        .withDescription(DESCRIPTION)
        .withEntityType(TestDefinitionEntityType.COLUMN)
        .withTestPlatforms(List.of(TestPlatform.DBT))
        .withProvider(ProviderType.USER)
        .withParameterDefinition(
            List.of(
                new TestCaseParameter()
                    .withName(GENERIC)
                    .withDisplayName(GENERIC)
                    .withRequired(false)));
  }

  private static TestCase testCase() {
    return new TestCase()
        .withName(LEGACY)
        .withDescription(DESCRIPTION)
        .withEntityLink("<#E::table::svc.db.schema.orders::columns::id>")
        .withParameterValues(List.of(new TestCaseParameterValue().withName(GENERIC).withValue("")));
  }
}
