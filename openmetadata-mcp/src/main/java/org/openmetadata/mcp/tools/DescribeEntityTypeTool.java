package org.openmetadata.mcp.tools;

import com.fasterxml.jackson.databind.BeanDescription;
import com.fasterxml.jackson.databind.JavaType;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.introspect.AnnotatedMember;
import com.fasterxml.jackson.databind.introspect.BeanPropertyDefinition;
import jakarta.validation.constraints.NotNull;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.mcp.tools.CreatableEntityRegistry.CreatableType;
import org.openmetadata.schema.CreateEntity;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

/**
 * The type-specific half of {@code create_entity}'s contract, read from the generated request class
 * itself so it cannot drift from what the create path accepts.
 *
 * <p>This is what makes one create tool cheaper than eight: the fields only one type uses no longer
 * have to sit in every client's tool list on every request, and are fetched only by a caller that
 * is actually creating that type.
 *
 * <p>No authorization: this returns the shape of a public API request class, the same schema shipped
 * in the product's JSON schemas. It reads no entity and reveals no instance data.
 */
public class DescribeEntityTypeTool implements McpTool {

  /** Fields {@code create_entity} takes as top-level parameters, common to every type. */
  static final List<String> SHARED_FIELDS =
      List.of(
          "name",
          "description",
          "displayName",
          "owners",
          "tags",
          "domains",
          "reviewers",
          "extension");

  private static final Set<String> SHARED = Set.copyOf(SHARED_FIELDS);

  /** Settable on the request class, but decided by the server rather than the caller. */
  private static final Set<String> SERVER_OWNED = Set.of("provider", "fullyQualifiedName");

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params) {
    String requested = CommonUtils.requireNonBlank(params.get("entityType"), "entityType");
    CreatableType<?, ?> type = CreatableEntityRegistry.require(requested);
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("entityType", type.entityType());
    result.put("sharedParameters", SHARED_FIELDS);
    // Beyond 'name', which every type requires. Some of these are shared parameters and some are
    // attributes, so the caller is told the set rather than left to infer it from the two lists.
    result.put("alsoRequired", type.required());
    result.put("attributes", describe(type));
    return result;
  }

  /** The attribute names this type accepts, for validating a caller's {@code attributes} map. */
  static Set<String> attributeNames(CreatableType<?, ?> type) {
    Set<String> names = new LinkedHashSet<>();
    properties(type).forEach(property -> names.add(property.getName()));
    return names;
  }

  /**
   * The values {@code field} accepts, or empty when it is not an enum. Lets a rejected value be
   * explained with the alternatives instead of the binding library's own wording.
   */
  static List<String> allowedValuesOf(CreatableType<?, ?> type, String field) {
    return properties(type).stream()
        .filter(property -> property.getName().equals(field))
        .findFirst()
        .map(property -> allowedValues(property.getPrimaryType()))
        .orElseGet(List::of);
  }

  private static List<Map<String, Object>> describe(CreatableType<?, ?> type) {
    List<Map<String, Object>> attributes = new ArrayList<>();
    properties(type).forEach(property -> attributes.add(describeOne(property)));
    return attributes;
  }

  private static Map<String, Object> describeOne(BeanPropertyDefinition property) {
    Map<String, Object> attribute = new LinkedHashMap<>();
    attribute.put("name", property.getName());
    attribute.put("type", typeName(property.getPrimaryType()));
    if (isRequired(property)) {
      attribute.put("required", Boolean.TRUE);
    }
    List<String> allowed = allowedValues(property.getPrimaryType());
    if (!allowed.isEmpty()) {
      attribute.put("allowedValues", allowed);
    }
    String description = property.getMetadata().getDescription();
    if (description != null && !description.isBlank()) {
      attribute.put("description", description);
    }
    return attribute;
  }

  /**
   * Every writable property except the ones {@code create_entity} already exposes at the top level,
   * so the caller is never told to put a shared field in {@code attributes}.
   */
  private static List<BeanPropertyDefinition> properties(CreatableType<?, ?> type) {
    return bindable(type).stream()
        .filter(property -> !SHARED.contains(property.getName()))
        .sorted((left, right) -> left.getName().compareTo(right.getName()))
        .toList();
  }

  /** The names this type can actually be given a value for, shared parameters included. */
  static Set<String> bindableNames(CreatableType<?, ?> type) {
    Set<String> names = new LinkedHashSet<>();
    bindable(type).forEach(property -> names.add(property.getName()));
    return names;
  }

  /**
   * The properties the request class itself declares.
   *
   * <p>{@link org.openmetadata.schema.CreateEntity} carries defaults that Jackson introspects as
   * properties of every implementor, and neither kind can hold a value: a getter with no setter
   * ({@code lifeCycle}) makes the bind fail outright, and a {@code default} no-op setter ({@code
   * tags}, {@code domains}, {@code reviewers}, {@code dataProducts}) accepts the value and discards
   * it. Advertising either is worse than omitting it - the first makes {@code describe_entity_type}
   * recommend a field {@code create_entity} then rejects, the second reports success on a write
   * that did not happen.
   *
   * <p>{@code provider} and {@code fullyQualifiedName} are real and settable but not the caller's
   * to set: the mappers overwrite the name, and {@code provider: system} produces an entity nobody
   * can ever delete. REST accepts both, so this is deliberately narrower than parity - an LLM
   * should not be handed them in a list of things to fill in.
   */
  private static List<BeanPropertyDefinition> bindable(CreatableType<?, ?> type) {
    ObjectMapper mapper = JsonUtils.getObjectMapper();
    JavaType javaType = mapper.constructType(type.requestClass());
    BeanDescription description = mapper.getSerializationConfig().introspect(javaType);
    return description.findProperties().stream()
        .filter(property -> !SERVER_OWNED.contains(property.getName()))
        .filter(DescribeEntityTypeTool::declaredByRequestClass)
        .toList();
  }

  private static boolean declaredByRequestClass(BeanPropertyDefinition property) {
    AnnotatedMember mutator = property.getMutator();
    return mutator != null && !CreateEntity.class.equals(mutator.getDeclaringClass());
  }

  /**
   * Generated request classes carry {@code @NotNull} rather than {@code @JsonProperty(required)},
   * so both are consulted - reading only Jackson's flag reports every field as optional.
   */
  private static boolean isRequired(BeanPropertyDefinition property) {
    AnnotatedMember member = property.getPrimaryMember();
    return property.isRequired() || (member != null && member.hasAnnotation(NotNull.class));
  }

  private static String typeName(JavaType type) {
    String name;
    if (type.isCollectionLikeType() && type.getContentType() != null) {
      name = "array of " + type.getContentType().getRawClass().getSimpleName();
    } else {
      name = type.getRawClass().getSimpleName();
    }
    return name;
  }

  private static List<String> allowedValues(JavaType type) {
    JavaType candidate = type.isCollectionLikeType() ? type.getContentType() : type;
    List<String> values = new ArrayList<>();
    if (candidate != null && candidate.getRawClass().isEnum()) {
      for (Object constant : candidate.getRawClass().getEnumConstants()) {
        values.add(String.valueOf(constant));
      }
    }
    return values;
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      Map<String, Object> params) {
    throw new UnsupportedOperationException(
        "DescribeEntityTypeTool does not require limit validation.");
  }
}
