package org.openmetadata.service.entity.metadata;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.FIELD_DESCRIPTION;
import static org.openmetadata.service.Entity.FIELD_DISPLAY_NAME;
import static org.openmetadata.service.util.EntityUtil.getFieldName;

import org.openmetadata.schema.type.Column;

/** Records scalar column changes while preserving bot metadata and major-version rules. */
public final class ColumnValueUpdater {
  public interface Session {
    boolean isPut();

    boolean updatedByBot();

    boolean isOverrideMetadata();

    <K> boolean recordChange(String field, K original, K updated);
  }

  public void updateDescription(
      final Session session, final String prefix, final Column original, final Column updated) {
    if (preserveDescription(session, original, updated)) {
      updated.setDescription(original.getDescription());
    } else {
      session.recordChange(
          getFieldName(prefix, FIELD_DESCRIPTION),
          original.getDescription(),
          updated.getDescription());
    }
  }

  private boolean preserveDescription(
      final Session session, final Column original, final Column updated) {
    return session.isPut()
        && !nullOrEmpty(original.getDescription())
        && session.updatedByBot()
        && (!session.isOverrideMetadata() || nullOrEmpty(updated.getDescription()));
  }

  public void updateDisplayName(
      final Session session, final String prefix, final Column original, final Column updated) {
    if (session.isPut() && !nullOrEmpty(original.getDisplayName()) && session.updatedByBot()) {
      updated.setDisplayName(original.getDisplayName());
    } else {
      session.recordChange(
          getFieldName(prefix, FIELD_DISPLAY_NAME),
          original.getDisplayName(),
          updated.getDisplayName());
    }
  }

  public void updateConstraint(
      final Session session, final String prefix, final Column original, final Column updated) {
    session.recordChange(
        getFieldName(prefix, "constraint"), original.getConstraint(), updated.getConstraint());
  }

  public boolean updateDataLength(
      final Session session, final String prefix, final Column original, final Column updated) {
    final Integer previous = original.getDataLength();
    final Integer current = updated.getDataLength();
    final boolean changed =
        session.recordChange(getFieldName(prefix, "dataLength"), previous, current);
    return changed && (previous == null || (current != null && current < previous));
  }

  public boolean updatePrecision(
      final Session session, final String prefix, final Column original, final Column updated) {
    return updateNullableSize(
        session,
        getFieldName(prefix, "precision"),
        original.getPrecision(),
        updated.getPrecision());
  }

  public boolean updateScale(
      final Session session, final String prefix, final Column original, final Column updated) {
    return updateNullableSize(
        session, getFieldName(prefix, "scale"), original.getScale(), updated.getScale());
  }

  private boolean updateNullableSize(
      final Session session, final String field, final Integer previous, final Integer current) {
    final boolean changed = session.recordChange(field, previous, current);
    return previous != null && changed && (current == null || current < previous);
  }
}
