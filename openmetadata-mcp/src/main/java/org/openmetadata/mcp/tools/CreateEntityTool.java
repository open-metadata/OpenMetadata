package org.openmetadata.mcp.tools;

import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.exc.ValueInstantiationException;
import java.util.Arrays;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.tools.CreatableEntityRegistry.CreatableType;
import org.openmetadata.schema.CreateEntity;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.ImpersonationContext;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.CreateResourceContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.util.RestUtil;

/**
 * Creates any registered entity type through one pipeline.
 *
 * <p>Replaces eight create tools that ran a byte-identical sequence - build request, map, enforce
 * limits, authorize CREATE, prepare, authorize the overwrite, {@code createOrUpdate} - and differed
 * only in the request class and mapper. Those live in {@link CreatableEntityRegistry} now.
 *
 * <p>Collapsing them fixed three inconsistencies rather than just preserving eight behaviours:
 * every type now accepts {@code extension} and resolves {@code reviewers} (three did not), and an
 * owner that resolves to nothing fails the call instead of being dropped - the old shared helper
 * returned only what it could resolve, so one misspelled name created an unowned entity and
 * reported success.
 */
@Slf4j
public class CreateEntityTool implements McpTool {

  private static final Set<String> SHARED = Set.copyOf(DescribeEntityTypeTool.SHARED_FIELDS);

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      Map<String, Object> params) {
    CreatableType<?, ?> type =
        CreatableEntityRegistry.require(
            CommonUtils.requireNonBlank(params.get("entityType"), "entityType"));
    String userName = CommonUtils.principal(securityContext);
    EntityInterface entity = type.toEntity(buildRequest(type, params), userName);

    authorizeCreate(authorizer, limits, securityContext, type.entityType(), entity);
    return persist(authorizer, securityContext, type.entityType(), entity, userName);
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

  private static Map<String, Object> persist(
      Authorizer authorizer,
      CatalogSecurityContext securityContext,
      String entityType,
      EntityInterface entity,
      String userName) {
    EntityRepository<EntityInterface> repository = repositoryFor(entityType);
    repository.prepareInternal(entity, false);
    CommonUtils.authorizeOverwrite(authorizer, securityContext, entityType, entity);
    RestUtil.PutResponse<EntityInterface> response =
        repository.createOrUpdate(null, entity, userName, ImpersonationContext.getImpersonatedBy());
    McpChangeEventUtil.publishChangeEvent(response.getEntity(), response.getChangeType(), userName);
    return McpResponseUtils.compact(response.getEntity(), response.getChangeType());
  }

  /**
   * The one unchecked cast at the repository boundary. {@code Entity.getEntityRepository} is keyed
   * by the same entity type the registry supplied, so the repository is the one declared over this
   * entity.
   */
  @SuppressWarnings("unchecked")
  private static EntityRepository<EntityInterface> repositoryFor(String entityType) {
    return (EntityRepository<EntityInterface>) Entity.getEntityRepository(entityType);
  }

  /** Shared parameters plus the type's own attributes, bound to its generated request class. */
  private static CreateEntity buildRequest(CreatableType<?, ?> type, Map<String, Object> params) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("name", CommonUtils.requireNonBlank(params.get("name"), "name"));
    putIfPresent(payload, "description", CommonUtils.optString(params, "description"));
    putIfPresent(payload, "displayName", CommonUtils.optString(params, "displayName"));
    putIfPresent(payload, "owners", owners(params, "owners"));
    putIfPresent(payload, "reviewers", owners(params, "reviewers"));
    putIfPresent(payload, "tags", tags(params));
    putIfPresent(payload, "domains", domains(params));
    putIfPresent(payload, "extension", CommonUtils.extension(params));
    payload.putAll(attributes(type, params));
    requireFields(type, payload);
    return convert(type, payload);
  }

  /**
   * The fields this type cannot be created without, carried over from the schema each replaced
   * tool declared. Checked together so one error names everything that is missing rather than one
   * field per retry.
   */
  private static void requireFields(CreatableType<?, ?> type, Map<String, Object> payload) {
    List<String> missing =
        type.required().stream().filter(field -> isAbsent(payload.get(field))).sorted().toList();
    if (!missing.isEmpty()) {
      throw new IllegalArgumentException(
          String.format(
              "entityType '%s' also requires %s. Nothing was created. Shared fields go in their"
                  + " own parameter and type-specific ones inside 'attributes' -"
                  + " describe_entity_type says which is which.",
              type.entityType(), missing));
    }
  }

  private static boolean isAbsent(Object value) {
    boolean absent;
    if (value == null) {
      absent = true;
    } else if (value instanceof String text) {
      absent = text.isBlank();
    } else if (value instanceof Collection<?> items) {
      absent = items.isEmpty();
    } else {
      absent = false;
    }
    return absent;
  }

  /**
   * Resolves names to references, failing on any that do not resolve. The helper the individual
   * create tools used returned only what it could resolve and said nothing about the rest.
   */
  private static Object owners(Map<String, Object> params, String key) {
    Object raw = params.get(key);
    return raw == null ? null : CommonUtils.requireTeamsOrUsers(raw, key);
  }

  private static Object tags(Map<String, Object> params) {
    Object raw = params.get("tags");
    return raw == null ? null : CommonUtils.buildTagLabels(raw);
  }

  private static Object domains(Map<String, Object> params) {
    Object raw = params.get("domains");
    return raw == null ? null : JsonUtils.readOrConvertValues(raw, String.class);
  }

  private static void putIfPresent(Map<String, Object> payload, String key, Object value) {
    if (value != null) {
      payload.put(key, value);
    }
  }

  /**
   * The caller's {@code attributes}, checked against what this type actually accepts before Jackson
   * sees them. Jackson would reject an unknown key too, but its message names the Java class rather
   * than the valid alternatives, which is not something a caller can act on in one retry.
   */
  private static Map<String, Object> attributes(
      CreatableType<?, ?> type, Map<String, Object> params) {
    Map<String, Object> attributes = asMap(params.get("attributes"));
    rejectShadowed(attributes);
    Set<String> accepted = DescribeEntityTypeTool.attributeNames(type);
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
          "Parameter 'attributes' must be an object mapping field names to values. Received: "
              + raw);
    }
    return attributes;
  }

  private static CreateEntity convert(CreatableType<?, ?> type, Map<String, Object> payload) {
    CreateEntity request;
    try {
      request = JsonUtils.convertValue(payload, type.requestClass());
    } catch (RuntimeException e) {
      throw new IllegalArgumentException(
          String.format(
              "Could not build a '%s' request: %s. Nothing was created. Call"
                  + " describe_entity_type for the accepted attributes and their types.",
              type.entityType(), detail(type, e)),
          e);
    }
    return request;
  }

  /**
   * A rejected value explained in the caller's terms. Binding failures are nearly always a bad enum
   * value, and the eight replaced tools each hand-wrote the valid list into an error string per
   * enum; reading them off the field covers every enum on every type and cannot fall out of date.
   *
   * <p>Keyed on the failing field rather than on the exception's target type: the generated enums
   * are built by a {@code fromValue} creator that throws, so the failure arrives as a {@link
   * ValueInstantiationException} carrying the enclosing class, and only the path identifies which
   * field was actually rejected.
   */
  private static String detail(CreatableType<?, ?> type, RuntimeException failure) {
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
   * field up on the request class finds nothing.
   */
  private static List<String> allowedValues(
      JsonMappingException mapping, CreatableType<?, ?> type, String field) {
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
