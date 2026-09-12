package org.openmetadata.service.entity.metadata;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.FIELD_CERTIFICATION;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.Period;
import java.time.ZoneOffset;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.LongSupplier;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.configuration.AssetCertificationSettings;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.service.util.FullyQualifiedName;

/** Applies certification mutation policy within the caller's existing metadata flush. */
@Slf4j
public final class EntityCertificationUpdates<T extends EntityInterface> {
  public interface Session {
    boolean isPut();

    boolean updatedByBot();

    boolean isOverrideMetadata();

    <K> boolean recordChange(String field, K original, K updated, boolean jsonValue);
  }

  public record Persistence<T extends EntityInterface>(
      Consumer<String> delete, Consumer<T> apply) {}

  private final boolean supported;
  private final Supplier<AssetCertificationSettings> settings;
  private final LongSupplier clock;
  private final Persistence<T> persistence;

  public EntityCertificationUpdates(
      final boolean supported,
      final Supplier<AssetCertificationSettings> settings,
      final LongSupplier clock,
      final Persistence<T> persistence) {
    this.supported = supported;
    this.settings = settings;
    this.clock = clock;
    this.persistence = persistence;
  }

  public void update(final Session session, final T original, final T updated) {
    if (!supported) {
      return;
    }
    LOG.debug(
        "Updating certification - Original: {}, Updated: {}",
        original.getCertification(),
        updated.getCertification());
    if (session.isPut()
        && !nullOrEmpty(original.getCertification())
        && session.updatedByBot()
        && !session.isOverrideMetadata()) {
      updated.setCertification(original.getCertification());
    } else {
      apply(session, original.getCertification(), updated);
    }
  }

  private void apply(final Session session, final AssetCertification original, final T updated) {
    final AssetCertification incoming = updated.getCertification();
    if (incoming == null) {
      LOG.debug("Setting certification to null");
      persistence.delete().accept(updated.getFullyQualifiedName());
      session.recordChange(FIELD_CERTIFICATION, original, null, true);
    } else if (hasSameTag(original, incoming)) {
      LOG.debug("Certification unchanged");
      updated.setCertification(original);
    } else {
      setValidity(incoming);
      persistence.apply().accept(updated);
      session.recordChange(FIELD_CERTIFICATION, original, incoming, true);
    }
  }

  private boolean hasSameTag(final AssetCertification original, final AssetCertification incoming) {
    return original != null
        && original.getTagLabel() != null
        && incoming.getTagLabel() != null
        && Objects.equals(original.getTagLabel().getTagFQN(), incoming.getTagLabel().getTagFQN());
  }

  public void prepare(final T entity) {
    final AssetCertification certification = entity.getCertification();
    if (supported
        && certification != null
        && certification.getTagLabel() != null
        && !nullOrEmpty(certification.getTagLabel().getTagFQN())) {
      setValidity(certification);
    }
  }

  private void setValidity(final AssetCertification incoming) {
    final AssetCertificationSettings current = settings.get();
    validate(incoming.getTagLabel().getTagFQN(), current);
    final long now = clock.getAsLong();
    incoming.setAppliedDate(now);
    final LocalDateTime applied =
        LocalDateTime.ofInstant(Instant.ofEpochMilli(now), ZoneOffset.UTC);
    final LocalDateTime expiry = applied.plus(Period.parse(current.getValidityPeriod()));
    incoming.setExpiryDate(expiry.toInstant(ZoneOffset.UTC).toEpochMilli());
  }

  private void validate(final String label, final AssetCertificationSettings current) {
    if (current == null) {
      throw new IllegalArgumentException(
          "Certification is not configured. Please configure the Classification used for Certification in the Settings.");
    }
    final String parent = FullyQualifiedName.getParentFQN(FullyQualifiedName.split(label));
    if (!current.getAllowedClassification().equals(parent)) {
      throw new IllegalArgumentException(
          String.format("Invalid Classification: %s is not valid for Certification.", label));
    }
  }
}
