package org.openmetadata.mcp.tools;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.introspect.BeanPropertyDefinition;
import jakarta.json.Json;
import jakarta.json.JsonArray;
import jakarta.json.JsonArrayBuilder;
import jakarta.json.JsonObject;
import jakarta.json.JsonObjectBuilder;
import jakarta.json.JsonPatch;
import jakarta.json.JsonValue;
import java.io.StringReader;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.ImpersonationContext;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.util.RestUtil;

@Slf4j
public class PatchEntityTool implements McpTool {
  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params) {
    String entityType = (String) params.get("entityType");
    String fqn = (String) params.get("fqn");
    String jsonPatchString = (String) params.get("patch");
    if (nullOrEmpty(jsonPatchString)) {
      throw new IllegalArgumentException("Patch cannot be null or empty");
    }

    JsonArray patchArray = Json.createReader(new StringReader(jsonPatchString)).readArray();
    EntityRepository<? extends EntityInterface> repository = Entity.getEntityRepository(entityType);
    PatchRewrite rewrite = rewriteDeprecatedPaths(patchArray, repository.getEntityClass());
    JsonPatch jsonPatch = Json.createPatch(rewrite.patch());

    // Validate If the User Can Perform the Patch Operation
    OperationContext operationContext = new OperationContext(entityType, jsonPatch);
    authorizer.authorize(
        securityContext, operationContext, new ResourceContext<>(entityType, null, fqn));

    String userName = securityContext.getUserPrincipal().getName();
    String impersonatedBy = ImpersonationContext.getImpersonatedBy();
    RestUtil.PatchResponse<? extends EntityInterface> response =
        repository.patch(null, fqn, userName, jsonPatch, ChangeSource.MANUAL, null, impersonatedBy);
    McpChangeEventUtil.publishChangeEvent(response.entity(), response.changeType(), userName);
    return withWarnings(JsonUtils.convertValue(response, Map.class), rewrite.warnings());
  }

  /** A patch with any deprecated field paths rewritten, plus one warning per rewrite. */
  record PatchRewrite(JsonArray patch, List<String> warnings) {}

  /**
   * Field names that were renamed in the schema, mapped to their current name. Callers trained on
   * an older schema (LLMs especially) still send the old name, which would otherwise fail the whole
   * patch. Rewriting lets the first call succeed while the returned warning teaches the caller the
   * current name.
   */
  private static final Map<String, String> DEPRECATED_FIELD_ALIASES =
      Map.of("status", "entityStatus");

  private static final List<String> POINTER_KEYS = List.of("path", "from");

  /**
   * Rewrites deprecated field paths for the target entity only. The alias is applied solely when the
   * entity has the replacement field and does NOT have the deprecated one: {@code status} is a real,
   * unrelated field on ingestionPipeline, dataContract, thread and others, so rewriting it blindly
   * would corrupt those patches. Introspection is skipped entirely unless a deprecated path is
   * actually present.
   */
  static PatchRewrite rewriteDeprecatedPaths(JsonArray patchArray, Class<?> entityClass) {
    PatchRewrite result = new PatchRewrite(patchArray, List.of());
    if (entityClass != null && containsDeprecatedPath(patchArray)) {
      result = applyAliases(patchArray, fieldNames(entityClass));
    }
    return result;
  }

  private static boolean containsDeprecatedPath(JsonArray patchArray) {
    return patchArray.stream()
        .map(JsonValue::asJsonObject)
        .anyMatch(
            operation ->
                POINTER_KEYS.stream()
                    .map(key -> operation.getString(key, null))
                    .anyMatch(
                        pointer -> DEPRECATED_FIELD_ALIASES.containsKey(rootSegment(pointer))));
  }

  private static PatchRewrite applyAliases(JsonArray patchArray, Set<String> fields) {
    JsonArrayBuilder rewritten = Json.createArrayBuilder();
    Set<String> warnings = new LinkedHashSet<>();
    for (JsonValue entry : patchArray) {
      JsonObject operation = entry.asJsonObject();
      JsonObjectBuilder builder = Json.createObjectBuilder(operation);
      POINTER_KEYS.forEach(key -> rewritePointer(operation, key, fields, builder, warnings));
      rewritten.add(builder);
    }
    return new PatchRewrite(rewritten.build(), List.copyOf(warnings));
  }

  private static void rewritePointer(
      JsonObject operation,
      String key,
      Set<String> fields,
      JsonObjectBuilder builder,
      Set<String> warnings) {
    String pointer = operation.getString(key, null);
    String replacement = aliasedPointer(pointer, fields);
    if (replacement != null) {
      builder.add(key, replacement);
      warnings.add(
          String.format(
              "Field path '%s' is deprecated and was applied as '%s'. Use '%s' in future patches.",
              pointer, replacement, replacement));
    }
  }

  private static String aliasedPointer(String pointer, Set<String> fields) {
    String root = rootSegment(pointer);
    String current = DEPRECATED_FIELD_ALIASES.get(root);
    String result = null;
    if (current != null && fields.contains(current) && !fields.contains(root)) {
      result = pointer.replaceFirst("^/" + root, "/" + current);
    }
    return result;
  }

  /** First path segment of a JSON Pointer, e.g. {@code /owners/0} yields {@code owners}. */
  private static String rootSegment(String pointer) {
    String result = "";
    if (pointer != null && pointer.startsWith("/")) {
      int end = pointer.indexOf('/', 1);
      result = end < 0 ? pointer.substring(1) : pointer.substring(1, end);
    }
    return result;
  }

  private static Set<String> fieldNames(Class<?> entityClass) {
    ObjectMapper mapper = JsonUtils.getObjectMapper();
    return mapper
        .getSerializationConfig()
        .introspect(mapper.constructType(entityClass))
        .findProperties()
        .stream()
        .map(BeanPropertyDefinition::getName)
        .collect(Collectors.toSet());
  }

  private static Map<String, Object> withWarnings(
      Map<String, Object> result, List<String> warnings) {
    Map<String, Object> merged = result;
    if (!warnings.isEmpty()) {
      merged = new LinkedHashMap<>(result);
      merged.put("warnings", warnings);
    }
    return merged;
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      Map<String, Object> params) {
    throw new UnsupportedOperationException("PatchEntityTool does not support limits enforcement.");
  }
}
