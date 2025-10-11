package org.openmetadata.it.util;

import static org.junit.jupiter.api.Assertions.*;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;

/**
 * Utility class for validating entity changes, versions, and ChangeDescription.
 *
 * Migrated from: EntityResourceTest validation methods
 * Provides validation that ensures entity lifecycle, versioning, and change tracking work correctly.
 */
public class EntityValidation {

  /**
   * Validate entity version based on update type.
   *
   * @param entity Entity to validate
   * @param updateType Type of update that was performed
   * @param previousVersion Version before the update (null if CREATED)
   */
  public static void validateVersion(
      EntityInterface entity, UpdateType updateType, Double previousVersion) {
    switch (updateType) {
      case CREATED:
        assertEquals(0.1, entity.getVersion(), 0.001, "Created entity should have version 0.1");
        break;

      case NO_CHANGE:
      case CHANGE_CONSOLIDATED:
        assertNotNull(previousVersion, "Previous version required for NO_CHANGE validation");
        assertEquals(
            previousVersion,
            entity.getVersion(),
            0.001,
            "Version should not change for NO_CHANGE/CHANGE_CONSOLIDATED");
        break;

      case MINOR_UPDATE:
        assertNotNull(previousVersion, "Previous version required for MINOR_UPDATE validation");
        double expectedMinorVersion = Math.floor(previousVersion * 10 + 1) / 10;
        assertEquals(
            expectedMinorVersion,
            entity.getVersion(),
            0.001,
            String.format(
                "Minor update should increment version from %.1f to %.1f",
                previousVersion, expectedMinorVersion));
        break;

      case MAJOR_UPDATE:
        assertNotNull(previousVersion, "Previous version required for MAJOR_UPDATE validation");
        double expectedMajorVersion = Math.floor(previousVersion) + 1.0;
        assertEquals(
            expectedMajorVersion,
            entity.getVersion(),
            0.001,
            String.format(
                "Major update should increment version from %.1f to %.1f",
                previousVersion, expectedMajorVersion));
        break;

      case REVERT:
        assertNotNull(previousVersion, "Previous version required for REVERT validation");
        assertTrue(
            entity.getVersion() < previousVersion,
            "Reverted entity should have version less than previous");
        break;

      default:
        fail("Unknown UpdateType: " + updateType);
    }
  }

  /**
   * Validate ChangeDescription based on update type.
   *
   * @param entity Entity to validate
   * @param updateType Type of update that was performed
   * @param expectedChange Expected ChangeDescription (can be null for CREATED/NO_CHANGE)
   */
  public static void validateChangeDescription(
      EntityInterface entity, UpdateType updateType, ChangeDescription expectedChange) {
    if (updateType == UpdateType.CREATED) {
      assertNull(entity.getChangeDescription(), "Created entity should not have ChangeDescription");
      return;
    }

    if (updateType == UpdateType.NO_CHANGE) {
      // NO_CHANGE may or may not have ChangeDescription depending on context
      // If expectedChange is provided, validate it
      if (expectedChange != null) {
        assertChangeDescription(expectedChange, entity.getChangeDescription());
      }
      return;
    }

    // For MINOR_UPDATE, MAJOR_UPDATE, CHANGE_CONSOLIDATED, REVERT
    assertNotNull(
        entity.getChangeDescription(), "Entity should have ChangeDescription after update");

    if (expectedChange != null) {
      assertChangeDescription(expectedChange, entity.getChangeDescription());
    }
  }

  /**
   * Compare expected and actual ChangeDescription.
   */
  private static void assertChangeDescription(
      ChangeDescription expected, ChangeDescription actual) {
    assertNotNull(actual, "ChangeDescription should not be null");

    // Validate previousVersion
    assertEquals(
        expected.getPreviousVersion(),
        actual.getPreviousVersion(),
        0.001,
        "Previous version mismatch");

    // Validate fieldsAdded
    assertFieldLists(expected.getFieldsAdded(), actual.getFieldsAdded(), "fieldsAdded");

    // Validate fieldsUpdated
    assertFieldLists(expected.getFieldsUpdated(), actual.getFieldsUpdated(), "fieldsUpdated");

    // Validate fieldsDeleted
    assertFieldLists(expected.getFieldsDeleted(), actual.getFieldsDeleted(), "fieldsDeleted");
  }

  /**
   * Compare two lists of FieldChange.
   */
  private static void assertFieldLists(
      List<FieldChange> expected, List<FieldChange> actual, String listName) {
    if (expected == null && actual == null) {
      return;
    }

    assertNotNull(expected, listName + " expected list should not be null");
    assertNotNull(actual, listName + " actual list should not be null");

    assertEquals(
        expected.size(),
        actual.size(),
        listName + " size mismatch. Expected: " + expected + ", Actual: " + actual);

    for (int i = 0; i < expected.size(); i++) {
      FieldChange expectedField = expected.get(i);
      FieldChange actualField = actual.get(i);

      assertEquals(
          expectedField.getName(),
          actualField.getName(),
          listName + "[" + i + "] field name mismatch");

      // Note: We're doing basic validation here. EntityResourceTest has more sophisticated
      // field value comparison based on field type (EntityReference, lists, etc.)
      // For now, we just check that the field name matches and values are present
      if (expectedField.getNewValue() != null) {
        assertNotNull(
            actualField.getNewValue(),
            listName + "[" + i + "] should have newValue for field " + expectedField.getName());
      }

      if (expectedField.getOldValue() != null) {
        assertNotNull(
            actualField.getOldValue(),
            listName + "[" + i + "] should have oldValue for field " + expectedField.getName());
      }
    }
  }

  /**
   * Create ChangeDescription for an entity update.
   *
   * @param previousVersion Version before the update
   * @param updateType Type of update being performed
   * @return ChangeDescription with previousVersion set and empty field lists
   */
  public static ChangeDescription getChangeDescription(
      Double previousVersion, UpdateType updateType) {
    if (updateType == UpdateType.CREATED || updateType == UpdateType.NO_CHANGE) {
      return null;
    }

    Double changeDescriptionPreviousVersion;
    if (updateType == UpdateType.CHANGE_CONSOLIDATED) {
      // For consolidated changes, previous version comes from existing ChangeDescription
      changeDescriptionPreviousVersion = previousVersion;
    } else {
      // For MINOR_UPDATE, MAJOR_UPDATE, the current version becomes the previous version
      changeDescriptionPreviousVersion = previousVersion;
    }

    return new ChangeDescription()
        .withPreviousVersion(changeDescriptionPreviousVersion)
        .withFieldsAdded(new ArrayList<>())
        .withFieldsUpdated(new ArrayList<>())
        .withFieldsDeleted(new ArrayList<>());
  }

  /**
   * Create FieldChange for a field that was added.
   */
  public static FieldChange fieldAdded(String fieldName, Object newValue) {
    return new FieldChange().withName(fieldName).withNewValue(newValue);
  }

  /**
   * Create FieldChange for a field that was updated.
   */
  public static FieldChange fieldUpdated(String fieldName, Object oldValue, Object newValue) {
    return new FieldChange().withName(fieldName).withOldValue(oldValue).withNewValue(newValue);
  }

  /**
   * Create FieldChange for a field that was deleted.
   */
  public static FieldChange fieldDeleted(String fieldName, Object oldValue) {
    return new FieldChange().withName(fieldName).withOldValue(oldValue);
  }
}
