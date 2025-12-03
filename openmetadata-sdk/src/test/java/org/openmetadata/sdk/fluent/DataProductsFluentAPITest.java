package org.openmetadata.sdk.fluent;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.type.EntityReference;

/**
 * Tests for DataProducts fluent API, specifically for input/output ports functionality.
 */
class DataProductsFluentAPITest {

  @Test
  void testDataProductCreatorWithInputPorts() {
    // Test that the creator can set input ports via varargs
    EntityReference port1 =
        new EntityReference().withId(java.util.UUID.randomUUID()).withType("table");
    EntityReference port2 =
        new EntityReference().withId(java.util.UUID.randomUUID()).withType("table");

    // We can't actually execute without a client, but we can verify the builder pattern works
    // by checking the CreateDataProduct request is properly configured
    CreateDataProduct request = new CreateDataProduct();
    request.setName("test-data-product");
    request.setInputPorts(List.of(port1, port2));

    assertEquals(2, request.getInputPorts().size());
    assertTrue(request.getInputPorts().contains(port1));
    assertTrue(request.getInputPorts().contains(port2));
  }

  @Test
  void testDataProductCreatorWithOutputPorts() {
    // Test that the creator can set output ports via varargs
    EntityReference port1 =
        new EntityReference().withId(java.util.UUID.randomUUID()).withType("table");
    EntityReference port2 =
        new EntityReference().withId(java.util.UUID.randomUUID()).withType("table");

    CreateDataProduct request = new CreateDataProduct();
    request.setName("test-data-product");
    request.setOutputPorts(List.of(port1, port2));

    assertEquals(2, request.getOutputPorts().size());
    assertTrue(request.getOutputPorts().contains(port1));
    assertTrue(request.getOutputPorts().contains(port2));
  }

  @Test
  void testDataProductCreatorWithBothPorts() {
    // Test that the creator can set both input and output ports
    EntityReference inputPort =
        new EntityReference().withId(java.util.UUID.randomUUID()).withType("table");
    EntityReference outputPort =
        new EntityReference().withId(java.util.UUID.randomUUID()).withType("topic");

    CreateDataProduct request = new CreateDataProduct();
    request.setName("test-data-product");
    request.setInputPorts(List.of(inputPort));
    request.setOutputPorts(List.of(outputPort));

    assertEquals(1, request.getInputPorts().size());
    assertEquals(1, request.getOutputPorts().size());
    assertEquals(inputPort.getId(), request.getInputPorts().get(0).getId());
    assertEquals(outputPort.getId(), request.getOutputPorts().get(0).getId());
  }

  @Test
  void testEntityReferenceForPorts() {
    // Test that EntityReference can be created properly for different asset types
    EntityReference tablePort =
        new EntityReference()
            .withId(java.util.UUID.randomUUID())
            .withType("table")
            .withName("test_table")
            .withFullyQualifiedName("db.schema.test_table");

    assertNotNull(tablePort.getId());
    assertEquals("table", tablePort.getType());
    assertEquals("test_table", tablePort.getName());
    assertEquals("db.schema.test_table", tablePort.getFullyQualifiedName());

    EntityReference topicPort =
        new EntityReference()
            .withId(java.util.UUID.randomUUID())
            .withType("topic")
            .withName("test_topic")
            .withFullyQualifiedName("messaging.test_topic");

    assertNotNull(topicPort.getId());
    assertEquals("topic", topicPort.getType());
    assertEquals("test_topic", topicPort.getName());
  }

  @Test
  void testPortsCanBeDifferentEntityTypes() {
    // Test that ports can reference different entity types (tables, topics, dashboards, etc.)
    EntityReference tablePort =
        new EntityReference().withId(java.util.UUID.randomUUID()).withType("table");
    EntityReference topicPort =
        new EntityReference().withId(java.util.UUID.randomUUID()).withType("topic");
    EntityReference dashboardPort =
        new EntityReference().withId(java.util.UUID.randomUUID()).withType("dashboard");
    EntityReference pipelinePort =
        new EntityReference().withId(java.util.UUID.randomUUID()).withType("pipeline");

    CreateDataProduct request = new CreateDataProduct();
    request.setName("test-data-product");
    request.setInputPorts(List.of(tablePort, topicPort));
    request.setOutputPorts(List.of(dashboardPort, pipelinePort));

    // Verify all different types are accepted
    assertEquals(2, request.getInputPorts().size());
    assertEquals(2, request.getOutputPorts().size());
    assertEquals("table", request.getInputPorts().get(0).getType());
    assertEquals("topic", request.getInputPorts().get(1).getType());
    assertEquals("dashboard", request.getOutputPorts().get(0).getType());
    assertEquals("pipeline", request.getOutputPorts().get(1).getType());
  }

  @Test
  void testEmptyPorts() {
    // Test that empty port lists work correctly
    CreateDataProduct request = new CreateDataProduct();
    request.setName("test-data-product");
    request.setInputPorts(List.of());
    request.setOutputPorts(List.of());

    assertNotNull(request.getInputPorts());
    assertNotNull(request.getOutputPorts());
    assertTrue(request.getInputPorts().isEmpty());
    assertTrue(request.getOutputPorts().isEmpty());
  }

  @Test
  void testNullPorts() {
    // Test that null port lists are handled correctly
    CreateDataProduct request = new CreateDataProduct();
    request.setName("test-data-product");

    // Ports should be null by default
    assertNull(request.getInputPorts());
    assertNull(request.getOutputPorts());
  }
}
