package org.openmetadata.service.search.vector;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.search.vector.utils.TextChunkManager;
import org.openmetadata.service.util.EntityPolicyTags;

/** Policy fields and their independent refresh signature; they do not change embedded text. */
public final class ChunkSecurityMetadata {
  public static final String VERSION_FIELD = "accessMetadataVersion";
  public static final String FINGERPRINT_FIELD = "accessMetadataFingerprint";
  public static final int VERSION = 1;

  private ChunkSecurityMetadata() {}

  static Map<String, Object> fields(EntityInterface<?> entity) {
    Map<String, Object> fields = projection(entity);
    String fingerprint = TextChunkManager.computeFingerprint(JsonUtils.pojoToJson(fields));
    fields.put(VERSION_FIELD, VERSION);
    fields.put(FINGERPRINT_FIELD, fingerprint);
    return fields;
  }

  static String fingerprint(EntityInterface<?> entity) {
    return TextChunkManager.computeFingerprint(JsonUtils.pojoToJson(projection(entity)));
  }

  private static Map<String, Object> projection(EntityInterface<?> entity) {
    Map<String, Object> fields = new TreeMap<>();
    fields.put("deleted", Boolean.TRUE.equals(entity.getDeleted()));
    fields.put("domains", references(domains(entity)));
    fields.put("owners", references(entity.getOwners()));
    fields.put("reviewers", references(entity.getReviewers()));
    List<TagLabel> tags = EntityPolicyTags.collect(entity);
    fields.put(
        "policyTags",
        tags == null
            ? List.of()
            : tags.stream()
                .map(TagLabel::getTagFQN)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .sorted()
                .toList());
    if (entity.getService() != null) {
      fields.put("service", reference(entity.getService()));
    }
    return fields;
  }

  /** A Domain is its own domain, matching ResourceContext rather than the empty entity field. */
  private static List<EntityReference> domains(EntityInterface<?> entity) {
    return entity instanceof Domain domain
        ? List.of(
            new EntityReference()
                .withId(domain.getId())
                .withName(domain.getName())
                .withDisplayName(domain.getDisplayName())
                .withFullyQualifiedName(domain.getFullyQualifiedName()))
        : entity.getDomains();
  }

  private static List<Map<String, Object>> references(List<EntityReference> references) {
    return references == null
        ? List.of()
        : references.stream()
            .map(ChunkSecurityMetadata::reference)
            .sorted(Comparator.comparing(JsonUtils::pojoToJson))
            .toList();
  }

  private static Map<String, Object> reference(EntityReference reference) {
    Map<String, Object> fields = new TreeMap<>();
    if (reference.getId() != null) fields.put("id", reference.getId().toString());
    if (reference.getName() != null) fields.put("name", reference.getName());
    if (reference.getDisplayName() != null) fields.put("displayName", reference.getDisplayName());
    if (reference.getFullyQualifiedName() != null) {
      fields.put("fullyQualifiedName", reference.getFullyQualifiedName());
    }
    return fields;
  }
}
