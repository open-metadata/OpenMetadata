package org.openmetadata.service.util;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.Entity.API_ENDPOINT;
import static org.openmetadata.service.Entity.CONTAINER;
import static org.openmetadata.service.Entity.DASHBOARD_DATA_MODEL;
import static org.openmetadata.service.Entity.DASHBOARD_DATA_MODEL_COLUMN;
import static org.openmetadata.service.Entity.MLMODEL;
import static org.openmetadata.service.Entity.PIPELINE;
import static org.openmetadata.service.Entity.SEARCH_INDEX;
import static org.openmetadata.service.Entity.TABLE;
import static org.openmetadata.service.Entity.TABLE_COLUMN;
import static org.openmetadata.service.Entity.TOPIC;
import static org.openmetadata.service.Entity.WORKSHEET;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.FieldInterface;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MlFeature;
import org.openmetadata.schema.type.SearchIndexField;
import org.openmetadata.schema.type.Task;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;

/**
 * Single source of truth for inline-array child collections (columns, schema fields, tasks,
 * features). Every consumer that previously hardcoded an entity-type switch reads this registry
 * instead. Charts are deliberately absent: a chart is a separate entity with its own RBAC and is
 * patched directly.
 */
@Slf4j
public final class ChildFieldResolver {

  public static final int LONGEST_PREFIX = -1;
  private static final int MIN_PARENT_PARTS = 2;

  public record ChildContainerSpec(
      String entityType,
      String childExtensionType,
      List<String> containerPaths,
      String requiredFields,
      Class<? extends FieldInterface> childClass,
      int parentFqnDepth) {}

  private static final Map<String, ChildContainerSpec> REGISTRY = buildRegistry();

  private static final Map<String, String> TYPE_BY_SIMPLE_CLASS_NAME =
      REGISTRY.keySet().stream()
          .collect(Collectors.toMap(type -> type.toLowerCase(Locale.ROOT), type -> type));

  private ChildFieldResolver() {}

  private static Map<String, ChildContainerSpec> buildRegistry() {
    return Map.ofEntries(
        Map.entry(
            TABLE,
            new ChildContainerSpec(
                TABLE,
                TABLE_COLUMN,
                List.of("columns"),
                "columns,tags,tableConstraints",
                Column.class,
                4)),
        Map.entry(
            DASHBOARD_DATA_MODEL,
            new ChildContainerSpec(
                DASHBOARD_DATA_MODEL,
                DASHBOARD_DATA_MODEL_COLUMN,
                List.of("columns"),
                "columns,tags",
                Column.class,
                3)),
        Map.entry(
            TOPIC,
            new ChildContainerSpec(
                TOPIC,
                null,
                List.of("messageSchema.schemaFields"),
                "messageSchema,tags",
                Field.class,
                2)),
        Map.entry(
            CONTAINER,
            new ChildContainerSpec(
                CONTAINER,
                null,
                List.of("dataModel.columns"),
                "dataModel,tags",
                Column.class,
                LONGEST_PREFIX)),
        Map.entry(
            MLMODEL,
            new ChildContainerSpec(
                MLMODEL, null, List.of("mlFeatures"), "tags", MlFeature.class, 2)),
        Map.entry(
            PIPELINE,
            new ChildContainerSpec(PIPELINE, null, List.of("tasks"), "tasks,tags", Task.class, 2)),
        Map.entry(
            SEARCH_INDEX,
            new ChildContainerSpec(
                SEARCH_INDEX, null, List.of("fields"), "fields,tags", SearchIndexField.class, 2)),
        Map.entry(
            API_ENDPOINT,
            new ChildContainerSpec(
                API_ENDPOINT,
                null,
                List.of("requestSchema.schemaFields", "responseSchema.schemaFields"),
                "requestSchema,responseSchema,tags",
                Field.class,
                3)),
        Map.entry(
            WORKSHEET,
            new ChildContainerSpec(
                WORKSHEET,
                null,
                List.of("columns"),
                "columns,tags",
                Column.class,
                LONGEST_PREFIX)));
  }

  public static boolean supports(String entityType) {
    return entityType != null && REGISTRY.containsKey(entityType);
  }

  public static Set<String> supportedEntityTypes() {
    return REGISTRY.keySet();
  }

  /**
   * The entity fields a caller must request to get the child containers populated, and nothing
   * else. Each container path's first segment is the entity property that holds it, so
   * "messageSchema.schemaFields" is reached by asking for "messageSchema".
   *
   * <p>Distinct from {@link ChildContainerSpec#requiredFields()}, which also carries the tags and
   * constraints a write path needs. A caller that only reads child names should ask for this
   * instead, so it does not pay for tag lookups it will not use.
   */
  public static String containerFields(String entityType) {
    return specFor(entityType).containerPaths().stream()
        .map(path -> path.split("\\.")[0])
        .distinct()
        .collect(Collectors.joining(","));
  }

  public static ChildContainerSpec specFor(String entityType) {
    ChildContainerSpec spec = entityType == null ? null : REGISTRY.get(entityType);
    if (spec == null) {
      throw new IllegalArgumentException(
          "Unsupported entity type: %s. Supported types are: %s"
              .formatted(entityType, String.join(", ", new TreeSet<>(REGISTRY.keySet()))));
    }
    return spec;
  }

  @SuppressWarnings("unchecked")
  public static List<FieldInterface> childrenOf(EntityInterface<?> parent, String entityType) {
    ChildContainerSpec spec = specFor(entityType);
    List<FieldInterface> children = new ArrayList<>();
    for (String path : spec.containerPaths()) {
      Object node = walkPath(parent, path);
      if (node instanceof List<?> list) {
        children.addAll((List<FieldInterface>) list);
      }
    }
    return children;
  }

  public static Optional<FieldInterface> locate(
      EntityInterface<?> parent, String entityType, String childFqn) {
    return findByFqn(childrenOf(parent, entityType), childFqn);
  }

  public static void ensureChildFqns(EntityInterface<?> parent, String entityType) {
    assignFqns(parent.getFullyQualifiedName(), childrenOf(parent, entityType));
  }

  /**
   * The entity's own live child list at one of its type's declared container paths, such as
   * {@code messageSchema.schemaFields}. Returns null when the entity's type is not registered or
   * does not declare that path.
   */
  public static List<?> containerListFor(EntityInterface<?> entity, String containerPath) {
    String entityType = registryTypeOf(entity);
    boolean declared =
        supports(entityType) && specFor(entityType).containerPaths().contains(containerPath);
    return declared && walkPath(entity, containerPath) instanceof List<?> list ? list : null;
  }

  /**
   * Map a POJO to its registry entity type by simple class name.
   *
   * <p>Deliberately not {@link Entity#getEntityTypeFromObject}: that reads a map populated by
   * {@code Entity.registerEntity} during server bootstrap, so it returns null in any context where
   * repositories have not registered (unit tests, and any static utility invoked before
   * registration). The registry's own keys already are the canonical entity-type names, so deriving
   * the lookup from them keeps this resolvable everywhere and independent of registration order.
   */
  private static String registryTypeOf(EntityInterface<?> entity) {
    return TYPE_BY_SIMPLE_CLASS_NAME.get(
        entity.getClass().getSimpleName().toLowerCase(Locale.ROOT));
  }

  public static String parentFqnOf(String childFqn, String entityType) {
    ChildContainerSpec spec = specFor(entityType);
    return spec.parentFqnDepth() == LONGEST_PREFIX
        ? longestPrefixParent(childFqn, entityType)
        : fixedDepthParent(childFqn, spec.parentFqnDepth());
  }

  private static Object walkPath(Object root, String path) {
    Object current = root;
    for (String segment : path.split("\\.")) {
      current = current == null ? null : invokeGetter(current, getterName(segment));
    }
    return current;
  }

  private static Optional<FieldInterface> findByFqn(
      List<? extends FieldInterface> fields, String childFqn) {
    Optional<FieldInterface> result = Optional.empty();
    for (FieldInterface field : listOrEmpty(fields)) {
      if (result.isEmpty()) {
        result =
            childFqn.equals(field.getFullyQualifiedName())
                ? Optional.of(field)
                : findByFqn(field.getChildren(), childFqn);
      }
    }
    return result;
  }

  private static void assignFqns(String parentFqn, List<? extends FieldInterface> fields) {
    for (FieldInterface field : listOrEmpty(fields)) {
      String fqn =
          field.getFullyQualifiedName() != null
              ? field.getFullyQualifiedName()
              : FullyQualifiedName.add(parentFqn, field.getName());
      field.setFullyQualifiedName(fqn);
      assignFqns(fqn, field.getChildren());
    }
  }

  private static String fixedDepthParent(String childFqn, int depth) {
    String[] parts = FullyQualifiedName.split(childFqn);
    if (parts.length <= depth) {
      throw new IllegalArgumentException("Invalid fully qualified child name: " + childFqn);
    }
    return FullyQualifiedName.build(Arrays.copyOf(parts, depth));
  }

  private static String longestPrefixParent(String childFqn, String entityType) {
    EntityRepository<? extends EntityInterface<?>> repository =
        Entity.getEntityRepository(entityType);
    String[] parts = FullyQualifiedName.split(childFqn);
    String result = null;
    for (int end = parts.length - 1; end >= MIN_PARENT_PARTS && result == null; end--) {
      EntityInterface<?> parent =
          repository.findByNameOrNull(
              FullyQualifiedName.build(Arrays.copyOf(parts, end)), Include.ALL);
      result = parent == null ? null : parent.getFullyQualifiedName();
    }
    if (result == null) {
      throw new IllegalArgumentException(
          "No %s parent found for child FQN: %s".formatted(entityType, childFqn));
    }
    return result;
  }

  /**
   * Invokes a no-arg getter reflectively. Package-visible, not {@code private}: {@link
   * FieldPathUtils} (same package) reuses this exact method instead of keeping its own copy, so the
   * service module has a single reflection-based getter-invoker.
   */
  static Object invokeGetter(Object target, String methodName) {
    Object result = null;
    try {
      Method method = target.getClass().getMethod(methodName);
      result = method.invoke(target);
    } catch (NoSuchMethodException e) {
      LOG.debug("[ChildFieldResolver] {} has no {}", target.getClass().getSimpleName(), methodName);
    } catch (ReflectiveOperationException e) {
      LOG.warn("[ChildFieldResolver] Could not invoke {}: {}", methodName, e.getMessage());
    }
    return result;
  }

  /** Package-visible for the same reuse reason as {@link #invokeGetter}. */
  static String getterName(String property) {
    return "get" + Character.toUpperCase(property.charAt(0)) + property.substring(1);
  }
}
