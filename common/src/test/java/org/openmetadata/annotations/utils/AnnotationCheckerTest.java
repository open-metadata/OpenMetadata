package org.openmetadata.annotations.utils;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.openmetadata.annotations.ExposedField;

public class AnnotationCheckerTest {

  @Test
  void testWhenClassHasExposedFields() {
    assertTrue(AnnotationChecker.isExposedFieldPresent(TestHasAnnotation.class));
  }

  @Test
  void testWhenClassWithAFieldWithExposedFields() {
    assertTrue(AnnotationChecker.isExposedFieldPresent(TestNestedHasAnnotation.class));
  }

  @Test
  void testWhenClassInheritFieldWithExposedFields() {
    assertTrue(AnnotationChecker.isExposedFieldPresent(TestInheritHasAnnotation.class));
  }

  @Test
  void testWhenClassDoesNotHasExposedFields() {
    assertFalse(AnnotationChecker.isExposedFieldPresent(TestDoesNotHasAnnotation.class));
  }

  static class TestHasAnnotation {
    protected @ExposedField String exposed;
  }

  static class TestNestedHasAnnotation {
    String notExposed;
    TestHasAnnotation exposed;
  }

  static class TestInheritHasAnnotation extends TestHasAnnotation {}

  static class TestDoesNotHasAnnotation {
    String notExposed;
  }
}
