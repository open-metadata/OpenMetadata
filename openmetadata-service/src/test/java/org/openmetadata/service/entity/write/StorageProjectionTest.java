package org.openmetadata.service.entity.write;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;

class StorageProjectionTest {
  @Test
  void excludesRelationshipAndModuleFieldsWithoutMutatingTheResponse() {
    final EntityReference owner =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.USER);
    final Chart chart =
        new Chart()
            .withName("chart")
            .withDescription("description")
            .withOwners(List.of(owner))
            .withService(new EntityReference().withType(Entity.DASHBOARD_SERVICE));

    final var projection = StorageProjection.attributes(chart, List.of("service"));

    assertFalse(projection.has("owners"));
    assertFalse(projection.has("service"));
    assertEquals("chart", projection.get("name").asText());
    assertEquals("description", projection.get("description").asText());
    assertEquals(List.of(owner), chart.getOwners());
    assertEquals(Entity.DASHBOARD_SERVICE, chart.getService().getType());
    assertEquals("chart", StorageProjection.attributes(chart, null).get("name").asText());
  }
}
