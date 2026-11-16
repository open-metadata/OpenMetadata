package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.FieldInterface;
import org.openmetadata.schema.type.MlFeature;
import org.openmetadata.schema.type.Task;

/**
 * Conformance of Task and MlFeature to FieldInterface.
 *
 * <p>Deliberately NO task_implementsFieldInterface / mlFeature_implementsFieldInterface tests: every
 * test method below declares its variable as {@code FieldInterface task = new Task()}, which fails
 * to COMPILE if the type does not implement the interface. An
 * {@code assertTrue(FieldInterface.class.isAssignableFrom(Task.class))} could never fail without
 * this same file already failing to compile, so it would assert nothing. The compile-time binding
 * below is the real assertion.
 */
class FieldInterfaceConformanceTest {

  @Test
  void task_hasNoChildren_defaultReturnsNull() {
    FieldInterface task = new Task().withName("t1").withDescription("d");
    assertNull(task.getChildren());
    assertEquals("d", task.getDescription());
  }

  @Test
  void mlFeature_hasNoChildren_defaultReturnsNull() {
    FieldInterface feature = new MlFeature().withName("f1");
    assertNull(feature.getChildren());
  }

  @Test
  void task_descriptionSetterIsReal() {
    FieldInterface task = new Task().withName("t1");
    task.setDescription("updated");
    assertEquals("updated", task.getDescription());
  }

  @Test
  void mlFeature_descriptionSetterIsReal() {
    FieldInterface feature = new MlFeature().withName("f1");
    feature.setDescription("updated");
    assertEquals("updated", feature.getDescription());
  }

  @Test
  void mlFeature_displayNameSetterIsReal() {
    // mlFeature carries displayName like every other child type, so the write must stick
    // rather than be swallowed by an interface default.
    FieldInterface feature = new MlFeature().withName("f1");
    feature.setDisplayName("Customer age");
    assertEquals("Customer age", feature.getDisplayName());
  }
}
