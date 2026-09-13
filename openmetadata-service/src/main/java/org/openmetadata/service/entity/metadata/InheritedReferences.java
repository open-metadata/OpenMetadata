package org.openmetadata.service.entity.metadata;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.FIELD_DATA_PRODUCTS;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.FIELD_EXPERTS;
import static org.openmetadata.service.Entity.FIELD_FOLLOWERS;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.Entity.FIELD_REVIEWERS;
import static org.openmetadata.service.util.EntityUtil.mergedInheritedEntityRefs;

import java.util.Collections;
import java.util.List;
import java.util.function.BiConsumer;
import java.util.function.Function;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.util.EntityUtil.Fields;

/** Applies inherited reference values without sharing mutable references with the parent or siblings. */
public final class InheritedReferences {
  private InheritedReferences() {}

  public enum Field {
    DOMAINS(FIELD_DOMAINS, EntityInterface::getDomains, EntityInterface::setDomains),
    DATA_PRODUCTS(
        FIELD_DATA_PRODUCTS, EntityInterface::getDataProducts, EntityInterface::setDataProducts),
    FOLLOWERS(FIELD_FOLLOWERS, EntityInterface::getFollowers, EntityInterface::setFollowers),
    OWNERS(FIELD_OWNERS, EntityInterface::getOwners, EntityInterface::setOwners),
    EXPERTS(FIELD_EXPERTS, EntityInterface::getExperts, EntityInterface::setExperts),
    REVIEWERS(FIELD_REVIEWERS, EntityInterface::getReviewers, EntityInterface::setReviewers);

    private final String name;
    private final Function<EntityInterface, List<EntityReference>> read;
    private final BiConsumer<EntityInterface, List<EntityReference>> write;

    Field(
        String name,
        Function<EntityInterface, List<EntityReference>> read,
        BiConsumer<EntityInterface, List<EntityReference>> write) {
      this.name = name;
      this.read = read;
      this.write = write;
    }
  }

  public static void apply(
      final Field field,
      final EntityInterface entity,
      final Fields fields,
      final EntityInterface parent) {
    if (eligible(field, entity, fields, parent)) {
      field.write.accept(entity, inherited(field, entity, parent));
    }
  }

  public static List<EntityReference> resolve(
      final Field field,
      final EntityInterface entity,
      final Fields fields,
      final EntityInterface parent) {
    return eligible(field, entity, fields, parent)
        ? inherited(field, entity, parent)
        : field.read.apply(entity);
  }

  private static boolean eligible(
      final Field field,
      final EntityInterface entity,
      final Fields fields,
      final EntityInterface parent) {
    return fields.contains(field.name)
        && (field == Field.REVIEWERS || nullOrEmpty(field.read.apply(entity)))
        && parent != null;
  }

  private static List<EntityReference> inherited(
      final Field field, final EntityInterface entity, final EntityInterface parent) {
    final List<EntityReference> inherited = copy(field.read.apply(parent));
    return field == Field.REVIEWERS
        ? mergedInheritedEntityRefs(field.read.apply(entity), inherited)
        : inherited;
  }

  private static List<EntityReference> copy(final List<EntityReference> references) {
    return nullOrEmpty(references)
        ? Collections.emptyList()
        : references.stream().map(InheritedReferences::copy).toList();
  }

  private static EntityReference copy(final EntityReference reference) {
    final EntityReference inherited = JsonUtils.deepCopy(reference, EntityReference.class);
    inherited.setInherited(true);
    return inherited;
  }
}
