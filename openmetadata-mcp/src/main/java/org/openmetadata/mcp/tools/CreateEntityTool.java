package org.openmetadata.mcp.tools;

import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.exc.ValueInstantiationException;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.rules.RuleEngine;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.ImpersonationContext;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.CreateResourceContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.util.DescriptionSanitizer;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;

/**
 * Creates any registered entity type through one pipeline.
 *
 * <p>The submitted entity type resolves through {@link EntityCreationSpec}, which delegates to the
 * repository already registered by the platform. Type-specific attributes bind directly to that
 * repository's entity class, so adding a repository does not require another MCP registry.
 *
 * <p>Collapsing them fixed inconsistencies rather than just preserving eight behaviours: an owner
 * or reviewer that resolves to nothing now fails the call instead of being dropped - the shared
 * helper the old tools used returned only what it could resolve, so one misspelled name created
 * an unowned entity and reported success. A shared parameter the type has no field for is
 * refused by name rather than silently discarded.
 */
public class CreateEntityTool implements McpTool {

  private static final Set<String> SHARED = Set.copyOf(DescribeEntityTypeTool.SHARED_FIELDS);
  private static final String NAME = "name";
  private static final String DESCRIPTION = "description";
  private static final String EXTENSION = "extension";
  private static final String ATTRIBUTES = "attributes";

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      Map<String, Object> params) {
    String entityType = CommonUtils.requireNonBlank(params.get("entityType"), "entityType");
    EntityCreationSpec type = EntityCreationSpec.resolve(entityType);
    String userName = CommonUtils.principal(securityContext);
    EntityInterface entity = buildEntity(type, params, userName);
    Boolean requestedMutuallyExclusive = requestedMutuallyExclusive(entity);

    applyRepositoryDefaults(entity);
    authorizeCreate(authorizer, limits, securityContext, entityType, entity);
    RuleEngine.getInstance().evaluate(entity);
    RestUtil.PutResponse<EntityInterface> response =
        persist(authorizer, securityContext, type, entity, userName);

    Map<String, Object> result =
        McpResponseUtils.compact(response.getEntity(), response.getChangeType());
    addClassificationWarning(
        requestedMutuallyExclusive, response.getEntity(), response.getChangeType(), result);
    return result;
  }

  /**
   * CREATE rights first, then the overwrite check once {@code prepareInternal} has resolved the
   * fully qualified name - {@code createOrUpdate} updates in place when the name is taken, so a
   * caller holding only create rights must not be able to overwrite somebody else's entity.
   */
  private static void authorizeCreate(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      String entityType,
      EntityInterface entity) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.CREATE);
    CreateResourceContext<EntityInterface> resourceContext =
        new CreateResourceContext<>(entityType, entity);
    limits.enforceLimits(securityContext, resourceContext, operationContext);
    authorizer.authorize(securityContext, operationContext, resourceContext);
  }

  private static RestUtil.PutResponse<EntityInterface> persist(
      Authorizer authorizer,
      CatalogSecurityContext securityContext,
      EntityCreationSpec type,
      EntityInterface entity,
      String userName) {
    String entityType = type.entityType();
    EntityRepository<EntityInterface> repository = type.typedRepository();
    repository.prepareInternal(entity, false);
    CommonUtils.authorizeOverwrite(authorizer, securityContext, entityType, entity);
    RestUtil.PutResponse<EntityInterface> response =
        repository.createOrUpdate(null, entity, userName, ImpersonationContext.getImpersonatedBy());
    McpChangeEventUtil.publishChangeEvent(response.getEntity(), response.getChangeType(), userName);
    return response;
  }

  /** Shared parameters plus attributes bound to the entity class owned by the repository. */
  private static EntityInterface buildEntity(
      EntityCreationSpec type, Map<String, Object> params, String userName) {
    Set<String> bindable = DescribeEntityTypeTool.bindableNames(type);
    // Before resolving anything: owners and reviewers cost a directory lookup, and a name that does
    // not resolve throws. Doing that first would report "no user or team found" for a field the
    // type
    // cannot accept in the first place, and would spend the lookup to say it.
    rejectUnsupportedShared(type, bindable, params);
    Map<String, Object> attributes = attributes(type, bindable, params);
    requireFields(type, params, attributes);
    EntityInterface entity = convert(type, attributes);
    applySharedFields(entity, params, userName);
    applyMcpDefaults(entity);
    return entity;
  }

  private static void applyRepositoryDefaults(EntityInterface entity) {
    if (entity instanceof Tag tag) {
      deriveTagClassification(tag);
    }
  }

  private static void deriveTagClassification(Tag tag) {
    EntityReference parent = tag.getParent();
    EntityReference classification = tag.getClassification();
    if (parent == null) {
      if (classification == null) {
        throw new IllegalArgumentException(
            "Attribute 'classification' is required for a tag unless 'parent' identifies a parent"
                + " tag. Nothing was created.");
      }
      tag.setClassification(Entity.getEntityReference(classification, Include.NON_DELETED));
      return;
    }

    EntityReference resolvedParent = Entity.getEntityReference(parent, Include.NON_DELETED);
    tag.setParent(resolvedParent);
    String derivedClassification =
        FullyQualifiedName.split(resolvedParent.getFullyQualifiedName())[0];
    if (classification == null) {
      classification =
          new EntityReference()
              .withType(Entity.CLASSIFICATION)
              .withFullyQualifiedName(derivedClassification);
    }

    EntityReference resolvedClassification =
        Entity.getEntityReference(classification, Include.NON_DELETED);
    if (!derivedClassification.equals(resolvedClassification.getFullyQualifiedName())) {
      throw new IllegalArgumentException(
          "Tag classification '"
              + resolvedClassification.getFullyQualifiedName()
              + "' must match the root classification of parent '"
              + resolvedParent.getFullyQualifiedName()
              + "' (expected '"
              + derivedClassification
              + "'). Nothing was created.");
    }
    tag.setClassification(resolvedClassification);
  }

  private static void applySharedFields(
      EntityInterface entity, Map<String, Object> params, String userName) {
    entity.setId(UUID.randomUUID());
    entity.setName(CommonUtils.requireNonBlank(params.get(NAME), NAME));
    entity.setDescription(
        DescriptionSanitizer.sanitize(CommonUtils.optString(params, DESCRIPTION)));
    entity.setDisplayName(CommonUtils.optString(params, "displayName"));
    entity.setOwners(owners(params, "owners"));
    entity.setReviewers(owners(params, "reviewers"));
    entity.setTags(tags(params));
    entity.setDomains(domains(params));
    entity.setExtension(CommonUtils.extension(params));
    entity.setUpdatedBy(userName);
    entity.setUpdatedAt(System.currentTimeMillis());
  }

  private static void applyMcpDefaults(EntityInterface entity) {
    if (entity instanceof Domain domain && domain.getDomainType() == null) {
      domain.setDomainType(CreateDomain.DomainType.AGGREGATE);
    }
    if (entity instanceof ContextMemory memory) {
      memory.setSourceType(ContextMemorySourceType.REMEMBER_REQUEST);
    }
    if (entity instanceof Metric metric) {
      validateMetric(metric);
    }
  }

  private static void validateMetric(Metric metric) {
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

  private static Boolean requestedMutuallyExclusive(EntityInterface entity) {
    return entity instanceof Classification classification
        ? classification.getMutuallyExclusive()
        : null;
  }

  private static void addClassificationWarning(
      Boolean requested, EntityInterface saved, EventType changeType, Map<String, Object> result) {
    if (requested != null
        && saved instanceof Classification classification
        && !EventType.ENTITY_CREATED.equals(changeType)
        && !Objects.equals(requested, classification.getMutuallyExclusive())) {
      result.put(
          "_warning",
          "mutuallyExclusive cannot be changed on an existing classification. Retained existing"
              + " value: "
              + classification.getMutuallyExclusive()
              + ". Supplied value "
              + requested
              + " was ignored.");
    }
  }

  /**
   * Refuses shared parameters this type has no field for, all of them in one error.
   *
   * <p>Not every type accepts every shared parameter - a classification has no {@code extension},
   * a domain no {@code reviewers}. Passing them through anyway ended one of two ways, both bad:
   * the value vanished into a {@code default} no-op setter on {@code CreateEntity} and the call
   * reported success, or the bind failed with a message naming a Java class.
   */
  private static void rejectUnsupportedShared(
      EntityCreationSpec type, Set<String> bindable, Map<String, Object> params) {
    List<String> unsupported =
        DescribeEntityTypeTool.SHARED_FIELDS.stream()
            .filter(field -> params.get(field) != null)
            .filter(field -> !bindable.contains(field))
            .toList();
    if (!unsupported.isEmpty()) {
      throw new IllegalArgumentException(
          String.format(
              "Parameters %s are not supported for entityType '%s'. Nothing was created."
                  + " Supported for this type: %s.",
              unsupported, type.entityType(), DescribeEntityTypeTool.sharedFor(type)));
    }
  }

  /**
   * The fields this type cannot be created without, derived from its registered entity class.
   * Checked together so one error names everything missing rather than one field per retry.
   */
  private static void requireFields(
      EntityCreationSpec type, Map<String, Object> params, Map<String, Object> attributes) {
    List<String> missing =
        DescribeEntityTypeTool.requiredFields(type).stream()
            .filter(field -> isAbsent(valueOf(field, params, attributes)))
            .toList();
    if (!missing.isEmpty()) {
      throw new IllegalArgumentException(
          String.format(
              "entityType '%s' also requires %s. Nothing was created. Shared fields go in their"
                  + " own parameter and type-specific ones inside 'attributes' -"
                  + " describe_entity_type says which is which.",
              type.entityType(), missing));
    }
  }

  private static Object valueOf(
      String field, Map<String, Object> params, Map<String, Object> attributes) {
    return SHARED.contains(field) ? params.get(field) : attributes.get(field);
  }

  private static boolean isAbsent(Object value) {
    boolean absent;
    if (value == null) {
      absent = true;
    } else if (value instanceof String text) {
      absent = text.isBlank();
    } else if (value instanceof Collection<?> items) {
      absent = items.isEmpty();
    } else if (value instanceof Map<?, ?> entries) {
      absent = entries.isEmpty();
    } else {
      absent = false;
    }
    return absent;
  }

  /**
   * Resolves names to references, failing on any that do not resolve. The helper the individual
   * create tools used returned only what it could resolve and said nothing about the rest.
   */
  private static List<EntityReference> owners(Map<String, Object> params, String key) {
    Object raw = params.get(key);
    return raw == null ? null : CommonUtils.requireTeamsOrUsers(raw, key);
  }

  private static List<TagLabel> tags(Map<String, Object> params) {
    Object raw = params.get("tags");
    return raw == null ? null : CommonUtils.buildTagLabels(raw);
  }

  private static List<EntityReference> domains(Map<String, Object> params) {
    Object raw = params.get("domains");
    return raw == null
        ? null
        : EntityUtil.getEntityReferences(
            Entity.DOMAIN, JsonUtils.readOrConvertValues(raw, String.class));
  }

  /**
   * The caller's {@code attributes}, checked against what this type actually accepts before Jackson
   * sees them. Jackson would reject an unknown key too, but its message names the Java class rather
   * than the valid alternatives, which is not something a caller can act on in one retry.
   */
  private static Map<String, Object> attributes(
      EntityCreationSpec type, Set<String> bindable, Map<String, Object> params) {
    Map<String, Object> attributes = asMap(params.get(ATTRIBUTES));
    rejectShadowed(attributes);
    Set<String> accepted =
        bindable.stream().filter(name -> !SHARED.contains(name)).collect(Collectors.toSet());
    List<String> unknown =
        attributes.keySet().stream().filter(key -> !accepted.contains(key)).sorted().toList();
    if (!unknown.isEmpty()) {
      throw new IllegalArgumentException(
          String.format(
              "Parameter 'attributes': %s not accepted by entityType '%s'. Accepted: %s."
                  + " Nothing was created. Call describe_entity_type for their types and which"
                  + " are required.",
              unknown, type.entityType(), accepted));
    }
    return attributes;
  }

  /** A shared field belongs in its own parameter; silently letting it through would shadow one. */
  private static void rejectShadowed(Map<String, Object> attributes) {
    List<String> shadowed = attributes.keySet().stream().filter(SHARED::contains).sorted().toList();
    if (!shadowed.isEmpty()) {
      throw new IllegalArgumentException(
          String.format(
              "Parameter 'attributes': %s are shared fields - pass them as top-level parameters,"
                  + " not inside 'attributes'.",
              shadowed));
    }
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> asMap(Object raw) {
    Map<String, Object> attributes;
    if (raw == null) {
      attributes = Map.of();
    } else if (raw instanceof Map) {
      attributes = (Map<String, Object>) raw;
    } else {
      throw new IllegalArgumentException(
          "Parameter '"
              + ATTRIBUTES
              + "' must be an object mapping field names to values. Received: "
              + raw);
    }
    return attributes;
  }

  private static EntityInterface convert(EntityCreationSpec type, Map<String, Object> payload) {
    EntityInterface entity;
    try {
      entity = JsonUtils.convertValue(payload, type.entityClass());
    } catch (RuntimeException e) {
      throw new IllegalArgumentException(
          String.format(
              "Could not build a '%s' entity: %s. Nothing was created. Call"
                  + " describe_entity_type for the accepted attributes and their types.",
              type.entityType(), detail(type, e)),
          e);
    }
    return entity;
  }

  /**
   * A rejected value explained in the caller's terms. Binding failures are nearly always a bad enum
   * value, and the eight replaced tools each hand-wrote the valid list into an error string per
   * enum; reading them off the entity field covers every enum on every type and cannot fall out of
   * date.
   *
   * <p>Keyed on the failing field rather than on the exception's target type: the generated enums
   * are built by a {@code fromValue} creator that throws, so the failure arrives as a {@link
   * ValueInstantiationException} carrying the enclosing class, and only the path identifies which
   * field was actually rejected.
   */
  private static String detail(EntityCreationSpec type, RuntimeException failure) {
    String message = failure.getMessage();
    if (failure.getCause() instanceof JsonMappingException mapping) {
      String field = fieldName(mapping);
      List<String> allowed = allowedValues(mapping, type, field);
      if (!allowed.isEmpty()) {
        message = String.format("'%s' has an invalid value. Allowed values: %s", field, allowed);
      }
    }
    return message;
  }

  /**
   * The rejected enum's values, taken from the exception first and the request class second. The
   * exception carries the type that failed to construct, and that is the only source which works at
   * any depth: {@code metricExpression.language} belongs to {@code MetricExpression}, so looking the
   * field up on the entity class finds nothing.
   */
  private static List<String> allowedValues(
      JsonMappingException mapping, EntityCreationSpec type, String field) {
    List<String> allowed = List.of();
    if (mapping instanceof ValueInstantiationException instantiation
        && instantiation.getType() != null
        && instantiation.getType().getRawClass().isEnum()) {
      allowed =
          Arrays.stream(instantiation.getType().getRawClass().getEnumConstants())
              .map(String::valueOf)
              .toList();
    }
    return allowed.isEmpty() ? DescribeEntityTypeTool.allowedValuesOf(type, field) : allowed;
  }

  /** The full path to the rejected value, so a nested field is not reported by its leaf name. */
  private static String fieldName(JsonMappingException mapping) {
    return mapping.getPath().stream()
        .map(JsonMappingException.Reference::getFieldName)
        .filter(Objects::nonNull)
        .collect(Collectors.joining("."));
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params) {
    throw new UnsupportedOperationException("CreateEntityTool requires limit validation.");
  }
}
