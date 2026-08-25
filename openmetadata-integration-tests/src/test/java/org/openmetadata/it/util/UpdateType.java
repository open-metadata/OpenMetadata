package org.openmetadata.it.util;

/**
 * Enum representing the type of update made to an entity.
 *
 * Migrated from: org.openmetadata.service.util.TestUtils.UpdateType
 * Used to validate that entity updates result in correct version changes and ChangeDescription.
 */
public enum UpdateType {
  /** Entity was newly created (version starts at 0.1) */
  CREATED,

  /** PUT/PATCH made no change to the entity and the version remains the same */
  NO_CHANGE,

  /** PATCH made change that was consolidated with previous change in same session (no version change) */
  CHANGE_CONSOLIDATED,

  /** PATCH resulted in entity reverting to previous version due to consolidation of changes */
  REVERT,

  /** PUT/PATCH made backward compatible change (minor version increment: 0.1 → 0.2) */
  MINOR_UPDATE,

  /** PUT/PATCH made backward incompatible change (major version increment: 0.9 → 1.0) */
  MAJOR_UPDATE
}
