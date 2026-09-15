package org.openmetadata.service.entity.history;

import static org.openmetadata.service.util.EntityUtil.nextMajorVersion;
import static org.openmetadata.service.util.EntityUtil.nextVersion;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.service.entity.write.EntityChangeRecorder;

/** Applies version and audit-field decisions without issuing database or cache operations. */
@Slf4j
public final class EntityVersionPolicy {
  private EntityVersionPolicy() {}

  public static boolean updateVersion(
      final EntityInterface original,
      final EntityInterface updated,
      final ChangeDescription changes,
      final Double oldVersion,
      final boolean majorChange) {
    final Double newVersion =
        next(oldVersion, majorChange, EntityChangeRecorder.hasChanges(changes));
    LOG.debug(
        "{} {}->{} - Fields added {}, updated {}, deleted {}",
        original.getId(),
        oldVersion,
        newVersion,
        changes.getFieldsAdded(),
        changes.getFieldsUpdated(),
        changes.getFieldsDeleted());
    changes.withPreviousVersion(oldVersion);
    updated.setVersion(newVersion);
    updated.setChangeDescription(changes);
    return !newVersion.equals(oldVersion);
  }

  private static Double next(final Double previous, final boolean major, final boolean changed) {
    return major ? nextMajorVersion(previous) : changed ? nextVersion(previous) : previous;
  }

  public static boolean isConsolidating(
      final EntityInterface previous, final ChangeDescription changes) {
    return previous != null
        && changes != null
        && changes.getPreviousVersion() != null
        && changes.getPreviousVersion().equals(previous.getVersion());
  }

  public static void retainUnversionedAudit(
      final EntityInterface original,
      final EntityInterface updated,
      final ChangeDescription changes,
      final boolean entityChanged) {
    if (!entityChanged) {
      updated.setChangeDescription(original.getChangeDescription());
      updated.setUpdatedBy(original.getUpdatedBy());
      updated.setUpdatedAt(original.getUpdatedAt());
    } else if (updated.getVersion().equals(changes.getPreviousVersion())) {
      updated.setChangeDescription(original.getChangeDescription());
    }
  }
}
