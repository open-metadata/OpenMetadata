package org.openmetadata.service.entity.metadata;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.FIELD_DELETED;
import static org.openmetadata.service.Entity.FIELD_DESCRIPTION;
import static org.openmetadata.service.Entity.FIELD_DISPLAY_NAME;
import static org.openmetadata.service.Entity.FIELD_LIFE_CYCLE;
import static org.openmetadata.service.Entity.FIELD_STYLE;
import static org.openmetadata.service.util.EntityUtil.isNullOrEmptyChangeDescription;

import java.util.Objects;
import java.util.function.UnaryOperator;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.AccessDetails;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.LifeCycle;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.exception.CatalogExceptionMessage;

/** Applies shared value policies through the current updater's change and permission snapshot. */
public final class EntityValueUpdates {
  public record Capabilities(String type, boolean style, boolean lifeCycle) {}

  public interface Session extends ColumnValueUpdater.Session {
    boolean isPatch();

    ChangeDescription getChangeDescription();

    boolean updatingBotDeniedOperation(MetadataOperation operation);

    <K> boolean recordChange(String field, K original, K updated, boolean jsonValue);

    void recordUnversionedChange(String field, Object original, Object updated);
  }

  private final Capabilities capabilities;
  private final UnaryOperator<String> sanitizeDescription;

  public EntityValueUpdates(
      final Capabilities capabilities, final UnaryOperator<String> sanitizeDescription) {
    this.capabilities = capabilities;
    this.sanitizeDescription = sanitizeDescription;
  }

  public void updateDescription(
      final Session session, final EntityInterface original, final EntityInterface updated) {
    if (session.isPut()
        && !nullOrEmpty(original.getDescription())
        && session.updatedByBot()
        && !session.isOverrideMetadata()) {
      updated.setDescription(original.getDescription());
    } else {
      final String sanitized = sanitizeDescription.apply(updated.getDescription());
      updated.setDescription(sanitized);
      session.recordChange(FIELD_DESCRIPTION, original.getDescription(), sanitized);
    }
  }

  public void updateDisplayName(
      final Session session, final EntityInterface original, final EntityInterface updated) {
    if (preserveDisplayName(session, original, updated)) {
      updated.setDisplayName(original.getDisplayName());
    } else {
      session.recordChange(FIELD_DISPLAY_NAME, original.getDisplayName(), updated.getDisplayName());
    }
  }

  private boolean preserveDisplayName(
      final Session session, final EntityInterface original, final EntityInterface updated) {
    // Coarse EDIT_ALL authorization does not enforce this field-level bot denial.
    return session.updatedByBot()
        && !nullOrEmpty(original.getDisplayName())
        && !session.isOverrideMetadata()
        && !Objects.equals(original.getDisplayName(), updated.getDisplayName())
        && session.updatingBotDeniedOperation(MetadataOperation.EDIT_DISPLAY_NAME);
  }

  public void updateDeleted(
      final Session session, final EntityInterface original, final EntityInterface updated) {
    if (session.isPut() || session.isPatch()) {
      validateDeleted(session, original, updated);
      if (Boolean.TRUE.equals(original.getDeleted())) {
        updated.setDeleted(false);
        session.recordChange(FIELD_DELETED, true, false);
      }
    } else {
      session.recordChange(FIELD_DELETED, original.getDeleted(), updated.getDeleted());
    }
  }

  private void validateDeleted(
      final Session session, final EntityInterface original, final EntityInterface updated) {
    if (!Objects.equals(updated.getDeleted(), original.getDeleted())
        && Boolean.TRUE.equals(updated.getDeleted())
        && isNullOrEmptyChangeDescription(session.getChangeDescription())
        && Objects.equals(original.getVersion(), updated.getVersion())) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.readOnlyAttribute(capabilities.type(), FIELD_DELETED));
    }
  }

  public void updateStyle(
      final Session session, final EntityInterface original, final EntityInterface updated) {
    if (!capabilities.style() || original.getStyle() == updated.getStyle()) {
      return;
    }
    if (session.isPut() && updated.getStyle() == null) {
      updated.setStyle(original.getStyle());
    }
    session.recordChange(FIELD_STYLE, original.getStyle(), updated.getStyle(), true);
  }

  public void updateLifeCycle(
      final Session session, final EntityInterface original, final EntityInterface updated) {
    if (!capabilities.lifeCycle()) {
      return;
    }
    final LifeCycle previous = original.getLifeCycle();
    if (session.isPut() && updated.getLifeCycle() == null) {
      updated.setLifeCycle(previous);
    }
    final LifeCycle current = updated.getLifeCycle();
    if (previous != current) {
      keepLatestAccess(previous, current);
      session.recordUnversionedChange(FIELD_LIFE_CYCLE, previous, current);
    }
  }

  private void keepLatestAccess(final LifeCycle previous, final LifeCycle current) {
    if (previous != null && current != null) {
      current.setCreated(latest(previous.getCreated(), current.getCreated()));
      current.setAccessed(latest(previous.getAccessed(), current.getAccessed()));
      current.setUpdated(latest(previous.getUpdated(), current.getUpdated()));
    }
  }

  private AccessDetails latest(final AccessDetails previous, final AccessDetails current) {
    return previous != null && (current == null || current.getTimestamp() < previous.getTimestamp())
        ? previous
        : current;
  }
}
