package org.openmetadata.service.rules;

import static org.junit.Assert.assertThrows;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.service.OpenMetadataApplicationTest;

public class RuleEngineTests extends OpenMetadataApplicationTest {
  private static final String C1 = "id";
  private static final String C2 = "name";
  private static final String C3 = "description";
  private static final String EMAIL_COL = "email";

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
  void testValidateDefaultRules(TestInfo test) {
    Table table = getMockTable(test);

    // we're passing no extra rules, just using the ones on the default settings (no more than 1
    // owner)
    RuleEngine.getInstance().evaluate(table, null);

    Table tableWithOneOwner =
        table.withOwners(
            List.of(
                new org.openmetadata.schema.type.EntityReference()
                    .withId(UUID.randomUUID())
                    .withName("owner1")));
    RuleEngine.getInstance().evaluate(tableWithOneOwner, null);

    Table tableWithOwners =
        table.withOwners(
            List.of(
                new org.openmetadata.schema.type.EntityReference()
                    .withId(UUID.randomUUID())
                    .withName("owner1"),
                new org.openmetadata.schema.type.EntityReference()
                    .withId(UUID.randomUUID())
                    .withName("owner2")));
    assertThrows(
        RuleValidationException.class,
        () -> RuleEngine.getInstance().evaluate(tableWithOwners, null));

    // if we don't apply the default rules, it should work
    RuleEngine.getInstance().evaluate(tableWithOwners, null, true);
  }
}
