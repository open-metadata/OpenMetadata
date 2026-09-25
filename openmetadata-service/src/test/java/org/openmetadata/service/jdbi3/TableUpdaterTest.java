package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.PartitionColumnDetails;
import org.openmetadata.schema.type.PartitionIntervalTypes;
import org.openmetadata.schema.type.TablePartition;

class TableUpdaterTest {

  private static final String TABLE_PARTITION_FIELD = "tablePartition";

  @Test
  void recordsTablePartitionAddedByPatch() {
    assertTablePartitionChange(null, tablePartition("daily"));
  }

  @Test
  void recordsTablePartitionUpdatedByPatch() {
    assertTablePartitionChange(tablePartition("daily"), tablePartition("monthly"));
  }

  private void assertTablePartitionChange(
      TablePartition originalPartition, TablePartition updatedPartition) {
    Table original = table(originalPartition);
    Table updated = table(updatedPartition);
    TableRepository.TableUpdater updater =
        mock(TableRepository.class)
            .new TableUpdater(original, updated, EntityRepository.Operation.PATCH, null);
    updater.setPatchedFields(Set.of(TABLE_PARTITION_FIELD));
    updater.changeDescription = new ChangeDescription();

    updater.entitySpecificUpdate(false);

    assertTrue(updater.fieldsChanged());
    assertEquals(
        List.of(TABLE_PARTITION_FIELD),
        updater.changeDescription.getFieldsAdded().stream().map(field -> field.getName()).toList());
  }

  private Table table(TablePartition tablePartition) {
    return new Table()
        .withId(UUID.randomUUID())
        .withName("orders")
        .withFullyQualifiedName("postgres.default.public.orders")
        .withUpdatedBy("admin")
        .withVersion(0.1)
        .withTablePartition(tablePartition);
  }

  private TablePartition tablePartition(String interval) {
    return new TablePartition()
        .withColumns(
            List.of(
                new PartitionColumnDetails()
                    .withColumnName("order_date")
                    .withIntervalType(PartitionIntervalTypes.TIME_UNIT)
                    .withInterval(interval)));
  }
}
