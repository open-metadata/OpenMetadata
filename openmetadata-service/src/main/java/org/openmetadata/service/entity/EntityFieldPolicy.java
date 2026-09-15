package org.openmetadata.service.entity;

import static org.openmetadata.service.Entity.FIELD_CERTIFICATION;
import static org.openmetadata.service.Entity.FIELD_DATA_PRODUCTS;
import static org.openmetadata.service.Entity.FIELD_DESCRIPTION;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.FIELD_ENTITY_STATUS;
import static org.openmetadata.service.Entity.FIELD_EXPERTS;
import static org.openmetadata.service.Entity.FIELD_EXTENSION;
import static org.openmetadata.service.Entity.FIELD_FOLLOWERS;
import static org.openmetadata.service.Entity.FIELD_LIFE_CYCLE;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.Entity.FIELD_REVIEWERS;
import static org.openmetadata.service.Entity.FIELD_STYLE;
import static org.openmetadata.service.Entity.FIELD_TAGS;
import static org.openmetadata.service.Entity.FIELD_VOTES;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.openmetadata.service.util.EntityUtil.Fields;

/** Schema-backed field selections and the shared write and summary defaults. */
public final class EntityFieldPolicy {
  private static final List<String> COMMON_WRITE_FIELDS =
      List.of(
          FIELD_TAGS,
          FIELD_OWNERS,
          FIELD_FOLLOWERS,
          FIELD_EXTENSION,
          FIELD_VOTES,
          FIELD_DOMAINS,
          FIELD_REVIEWERS,
          FIELD_EXPERTS,
          FIELD_DATA_PRODUCTS,
          FIELD_STYLE,
          FIELD_LIFE_CYCLE,
          FIELD_CERTIFICATION,
          FIELD_ENTITY_STATUS);
  private static final List<String> COMMON_SUMMARY_FIELDS =
      List.of(FIELD_DESCRIPTION, FIELD_OWNERS);
  private final Set<String> allowed;

  public EntityFieldPolicy(final Set<String> allowed) {
    // Entity modules may extend the schema's fields during startup, after the base is constructed.
    this.allowed = allowed;
  }

  public Fields parse(final String fields) {
    return "*".equals(fields) ? all() : new Fields(allowed, fields);
  }

  public Fields supported(final String fields) {
    return "*".equals(fields) ? all() : new Fields(allowed, fields, true);
  }

  public Fields parse(final Set<String> fields) {
    return new Fields(allowed, fields);
  }

  public Fields excluding(final String fields) {
    return Fields.createWithExcludedFields(allowed, fields);
  }

  private Fields all() {
    return new Fields(allowedCopy());
  }

  public Set<String> allowedCopy() {
    return new HashSet<>(allowed);
  }

  public void addCommonWriteFields(final Fields patch, final Fields put) {
    for (final String field : COMMON_WRITE_FIELDS) {
      if (allowed.contains(field)) {
        patch.addField(allowed, field);
        put.addField(allowed, field);
      }
    }
  }

  public Set<String> summaryFields(final Set<String> configured) {
    final Set<String> fields = new HashSet<>(configured);
    for (final String field : COMMON_SUMMARY_FIELDS) {
      if (allowed.contains(field)) {
        fields.add(field);
      }
    }
    return fields;
  }
}
