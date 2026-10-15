package org.openmetadata.service.governance.workflows.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.MetadataCollectionConfiguration;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.RequiredMetadataField;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.service.governance.workflows.metadata.MetadataCollectionService.Outstanding;

class MetadataCollectionServiceTest {
  @ParameterizedTest
  @CsvSource({
    "experts, Experts",
    "description, Description",
    "extension.costCenter, Cost center",
    "metricExpression.code, Metric expression code"
  })
  void namesAFieldAsPeopleReadIt(final String path, final String name) {
    assertEquals(name, MetadataCollectionService.fieldName(path));
  }

  @Test
  void keepsOneTaskPerAssetAndStageNode() {
    final UUID asset = UUID.randomUUID();

    assertEquals(
        MetadataCollectionService.taskId(asset, "DomainLifecycle", "Collect0"),
        MetadataCollectionService.taskId(asset, "DomainLifecycle", "Collect0"));
    assertNotEquals(
        MetadataCollectionService.taskId(asset, "DomainLifecycle", "Collect0"),
        MetadataCollectionService.taskId(asset, "DomainLifecycle", "Collect1"));
  }

  @Test
  void namesMissingFieldsButReportsUnmetConditionsOnlyGenerically() {
    assertEquals(
        "Still missing: Experts. The task completes itself once these are filled in."
            + " The lifecycle conditions are not met.",
        new Outstanding(List.of("experts"), false).describe());
    assertEquals(
        "The lifecycle conditions are not met.", new Outstanding(List.of(), false).describe());
    assertTrue(Outstanding.NOTHING.isNothing());
    assertFalse(new Outstanding(List.of(), false).isNothing());
  }

  @Test
  void checksTheStageConditionsAlongsideItsRequiredFields() {
    final Domain domain =
        new Domain().withId(UUID.randomUUID()).withName("finance").withDescription("Money");
    final MetadataCollectionConfiguration required =
        new MetadataCollectionConfiguration()
            .withStage(EntityStatus.DRAFT)
            .withFields(
                List.of(
                    new RequiredMetadataField()
                        .withField("description")
                        .withRules("{\"!!\":[{\"var\":\"description\"}]}")));

    assertEquals(Outstanding.NOTHING, MetadataCollectionService.outstanding(domain, required));
    assertEquals(
        new Outstanding(List.of(), false),
        MetadataCollectionService.outstanding(
            domain, required.withConditions("{\"==\":[{\"var\":\"name\"},\"sales\"]}")));
    assertEquals(
        new Outstanding(List.of("description"), true),
        MetadataCollectionService.outstanding(
            domain.withDescription(null),
            required.withConditions("{\"==\":[{\"var\":\"name\"},\"finance\"]}")));
  }

  @Test
  void asksTheAdminsOnlyWhenTheAskedGroupIsEmpty() {
    final EntityReference admin = new EntityReference().withId(UUID.randomUUID()).withType("user");
    final EntityReference owner = new EntityReference().withId(UUID.randomUUID()).withType("user");

    assertEquals(
        List.of(admin), MetadataCollectionService.orAdmins(List.of(), () -> List.of(admin)));
    assertEquals(
        List.of(owner),
        MetadataCollectionService.orAdmins(
            List.of(owner),
            () -> {
              throw new AssertionError("the admins are not looked up while someone can be asked");
            }));
  }
}
