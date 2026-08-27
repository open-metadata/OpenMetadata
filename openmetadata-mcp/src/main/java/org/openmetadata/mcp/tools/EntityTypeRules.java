package org.openmetadata.mcp.tools;

import java.util.Map;
import java.util.Objects;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.data.Article;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.data.PageType;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * What {@code create_entity} has to do for one entity type and no other, kept here so the tool
 * itself stays a single pipeline every type runs through.
 *
 * <p>Each rule exists because the type's own create request does work no generic binding can: a
 * value the request derives, a field the caller cannot be asked for, or a value the repository
 * refuses to change.
 */
final class EntityTypeRules {

  private static final String PAGE_BODY = "page";
  private static final String RELATED_ENTITIES = "relatedEntities";

  private EntityTypeRules() {}

  /** Values a type's create request would have filled in, applied before the entity is prepared. */
  static void applyDefaults(EntityInterface entity) {
    if (entity instanceof Domain domain && domain.getDomainType() == null) {
      domain.setDomainType(CreateDomain.DomainType.AGGREGATE);
    }
    if (entity instanceof ContextMemory memory) {
      memory.setSourceType(ContextMemorySourceType.REMEMBER_REQUEST);
    }
    if (entity instanceof Metric metric) {
      requireMetricExpression(metric);
    }
    if (entity instanceof Page page) {
      defaultArticleBody(page);
    }
    if (entity instanceof Tag tag) {
      deriveTagClassification(tag);
    }
  }

  /** The last word before the write, once it is known whether an entity exists under this name. */
  static void applyBeforeWrite(
      EntityInterface entity, Map<String, Object> attributes, boolean updatesExisting) {
    if (entity instanceof Page page) {
      keepStoredPageBody(page, attributes, updatesExisting);
      requirePageBody(page, updatesExisting);
    }
  }

  /**
   * The one requested value the repository can refuse to change, read before the write because the
   * saved entity may be the same object.
   */
  static Boolean requestedMutuallyExclusive(EntityInterface entity) {
    return entity instanceof Classification classification
        ? classification.getMutuallyExclusive()
        : null;
  }

  /** Tells the caller when the repository kept a value the request asked to change. */
  static void addWarnings(
      Boolean requestedMutuallyExclusive,
      EntityInterface saved,
      EventType changeType,
      Map<String, Object> result) {
    if (requestedMutuallyExclusive != null
        && saved instanceof Classification stored
        && !EventType.ENTITY_CREATED.equals(changeType)
        && !Objects.equals(requestedMutuallyExclusive, stored.getMutuallyExclusive())) {
      result.put(
          "_warning",
          "mutuallyExclusive cannot be changed on an existing classification. Retained existing"
              + " value: "
              + stored.getMutuallyExclusive()
              + ". Supplied value "
              + requestedMutuallyExclusive
              + " was ignored.");
    }
  }

  /**
   * An article's body carries nothing the caller has to supply - its markdown lives in {@code
   * description} - so requiring the bare {@code page} object would fail every article creation on a
   * field with no value to give it.
   */
  private static void defaultArticleBody(Page page) {
    if (page.getPage() == null && PageType.ARTICLE.equals(page.getPageType())) {
      page.setPage(new Article());
    }
  }

  /**
   * An update replaces the entity, so the body defaulted for a create would drop the publication
   * date and delete every related-article relationship. Read with the related articles the updater
   * compares against, leaving {@code page} out changes nothing.
   */
  private static void keepStoredPageBody(
      Page page, Map<String, Object> attributes, boolean updatesExisting) {
    if (updatesExisting && !attributes.containsKey(PAGE_BODY)) {
      Page stored =
          Entity.getEntityByName(
              Entity.PAGE, page.getFullyQualifiedName(), RELATED_ENTITIES, Include.ALL);
      page.setPage(stored.getPage());
    }
  }

  /**
   * A quick link's body is its destination, which cannot be defaulted the way an article's can. An
   * update that leaves it out has already kept the stored one.
   */
  private static void requirePageBody(Page page, boolean updatesExisting) {
    if (page.getPage() == null) {
      throw new IllegalArgumentException(
          String.format(
              "Attribute 'page' is required for a '%s' page and must carry its url, as"
                  + " {\"url\": \"https://...\"}. Nothing was %s.",
              page.getPageType(), updatesExisting ? "changed" : "created"));
    }
  }

  private static void requireMetricExpression(Metric metric) {
    boolean incomplete =
        metric.getMetricExpression() == null
            || metric.getMetricExpression().getLanguage() == null
            || metric.getMetricExpression().getCode() == null
            || metric.getMetricExpression().getCode().isBlank();
    if (incomplete) {
      throw new IllegalArgumentException(
          "Attribute 'metricExpression' needs both 'language' and a non-empty 'code'. Nothing was"
              + " created.");
    }
  }

  /** A tag belongs to the classification its parent belongs to, and says so or says nothing. */
  private static void deriveTagClassification(Tag tag) {
    EntityReference parent = tag.getParent();
    if (parent == null) {
      tag.setClassification(classificationOf(tag));
    } else {
      EntityReference resolvedParent = Entity.getEntityReference(parent, Include.NON_DELETED);
      tag.setParent(resolvedParent);
      tag.setClassification(
          matchingClassification(
              tag, FullyQualifiedName.split(resolvedParent.getFullyQualifiedName())[0]));
    }
  }

  private static EntityReference classificationOf(Tag tag) {
    if (tag.getClassification() == null) {
      throw new IllegalArgumentException(
          "Attribute 'classification' is required for a tag unless 'parent' identifies a parent"
              + " tag. Nothing was created.");
    }
    return Entity.getEntityReference(tag.getClassification(), Include.NON_DELETED);
  }

  private static EntityReference matchingClassification(Tag tag, String derived) {
    EntityReference requested =
        tag.getClassification() == null
            ? new EntityReference().withType(Entity.CLASSIFICATION).withFullyQualifiedName(derived)
            : tag.getClassification();
    EntityReference resolved = Entity.getEntityReference(requested, Include.NON_DELETED);
    if (!derived.equals(resolved.getFullyQualifiedName())) {
      throw new IllegalArgumentException(
          String.format(
              "Tag classification '%s' must match the root classification of parent '%s' (expected"
                  + " '%s'). Nothing was created.",
              resolved.getFullyQualifiedName(), tag.getParent().getFullyQualifiedName(), derived));
    }
    return resolved;
  }
}
