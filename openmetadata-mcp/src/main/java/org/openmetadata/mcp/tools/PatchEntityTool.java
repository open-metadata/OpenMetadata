package org.openmetadata.mcp.tools;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.google.common.annotations.VisibleForTesting;
import jakarta.json.Json;
import jakarta.json.JsonArray;
import jakarta.json.JsonObject;
import jakarta.json.JsonPatch;
import jakarta.json.JsonValue;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Include;
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

/**
 * Applies a JSON Patch (RFC 6902) to an entity, the same document the REST PATCH API takes.
 *
 * <p>The patch is passed through as written - any operation, any path. The one thing this does not
 * do blindly is silently discard a list: {@code /owners} and {@code /owners/-} differ by two
 * characters and mean "replace every owner" and "append one", so a patch that would empty a
 * populated array has to say it meant to. See {@link #guardArrayReplacement}.
 */
@Slf4j
public class PatchEntityTool implements McpTool {

  private static final String PATCH_PARAM = "patch";
  private static final String CONFIRM_PARAM = "confirmReplace";
  private static final String OP_KEY = "op";
  private static final String PATH_KEY = "path";
  private static final String OP_REPLACE = "replace";
  private static final String OP_ADD = "add";
  private static final String OP_REMOVE = "remove";

  /**
   * The arrays worth guarding: collaborative fields where losing the existing entries is data loss
   * rather than an edit. Read with the entity so the error can say how many would go.
   */
  private static final Set<String> GUARDED_ARRAYS =
      Set.of("owners", "tags", "reviewers", "domains", "experts", "dataProducts");

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params) {
    String entityType = (String) params.get("entityType");
    String fqn = (String) params.get("fqn");
    requireTarget(entityType, fqn);
    String rawPatch = (String) params.get(PATCH_PARAM);
    if (nullOrEmpty(rawPatch)) {
      throw new IllegalArgumentException(
          "Parameter 'patch' is required: a JSONPatch document (RFC 6902) as a JSON array string.");
    }

    JsonArray operations = Json.createReader(new StringReader(rawPatch)).readArray();
    guardArrayReplacement(entityType, fqn, operations, params);
    JsonPatch jsonPatch = Json.createPatch(operations);

    authorizer.authorize(
        securityContext,
        new OperationContext(entityType, jsonPatch),
        new ResourceContext<>(entityType, null, fqn));

    EntityRepository<? extends EntityInterface> repository = Entity.getEntityRepository(entityType);
    String userName = securityContext.getUserPrincipal().getName();
    RestUtil.PatchResponse<? extends EntityInterface> response =
        repository.patch(
            null,
            fqn,
            userName,
            jsonPatch,
            ChangeSource.MANUAL,
            null,
            ImpersonationContext.getImpersonatedBy());
    McpChangeEventUtil.publishChangeEvent(response.entity(), response.changeType(), userName);
    return McpResponseUtils.compactPatch(response.entity(), response.changeType());
  }

  private static void requireTarget(String entityType, String fqn) {
    if (nullOrEmpty(entityType) || nullOrEmpty(fqn)) {
      throw new IllegalArgumentException("Parameters 'entityType' and 'fqn' are required");
    }
  }

  /**
   * Refuses a patch that would drop every entry of a populated list, unless the caller says that is
   * the intent.
   *
   * <p>{@code /owners} and {@code /owners/-} are the same operation to a JSON Patch processor and
   * opposite operations to a person. Applying the first when the second was meant deletes owners
   * and returns success, which is how this went wrong in testing. The entity is only read when the
   * patch actually touches a guarded array, so an ordinary description edit costs nothing extra.
   */
  @VisibleForTesting
  static void guardArrayReplacement(
      String entityType, String fqn, JsonArray operations, Map<String, Object> params) {
    List<String> replaced = wholeArrayTargets(operations);
    boolean confirmed =
        params.get(CONFIRM_PARAM) != null
            && CommonUtils.parseBoolean(params.get(CONFIRM_PARAM), CONFIRM_PARAM);
    if (replaced.isEmpty() || confirmed) {
      return;
    }
    List<String> populated = populatedAmong(entityType, fqn, replaced);
    if (!populated.isEmpty()) {
      throw new IllegalArgumentException(
          String.format(
              "This patch replaces the whole of %s, discarding what is there now. Nothing was"
                  + " changed. To ADD without losing the rest, target the end of the array"
                  + " instead: {\"op\": \"add\", \"path\": \"/%s/-\", \"value\": {...}}. To REMOVE"
                  + " one entry, use its index: {\"op\": \"remove\", \"path\": \"/%s/0\"}. If"
                  + " replacing all of it really is the intent, pass confirmReplace: true.",
              populated, populated.getFirst(), populated.getFirst()));
    }
  }

  /**
   * The guarded arrays this patch writes as a whole. A path of {@code /owners} addresses the array
   * itself; {@code /owners/0} or {@code /owners/-} addresses one entry and is left alone.
   */
  private static List<String> wholeArrayTargets(JsonArray operations) {
    List<String> targets = new ArrayList<>();
    for (JsonValue operation : operations) {
      if (operation.getValueType() == JsonValue.ValueType.OBJECT) {
        addIfWholeArray(operation.asJsonObject(), targets);
      }
    }
    return targets;
  }

  private static void addIfWholeArray(JsonObject operation, List<String> targets) {
    String op = stringOrNull(operation, OP_KEY);
    String path = stringOrNull(operation, PATH_KEY);
    boolean writes = OP_REPLACE.equals(op) || OP_ADD.equals(op) || OP_REMOVE.equals(op);
    if (writes && path != null && path.startsWith("/")) {
      String field = path.substring(1);
      // The path is the array itself, so this writes the whole list - including 'add', which on an
      // existing array replaces it rather than extending it. Only '/owners/-' and '/owners/0'
      // address an element, and those paths do not reach here.
      if (GUARDED_ARRAYS.contains(field)) {
        targets.add(field);
      }
    }
  }

  private static String stringOrNull(JsonObject operation, String key) {
    JsonValue value = operation.get(key);
    return value != null && value.getValueType() == JsonValue.ValueType.STRING
        ? ((jakarta.json.JsonString) value).getString()
        : null;
  }

  /**
   * Of the arrays this patch overwrites, the ones that currently hold something. Replacing an empty
   * list discards nothing, so it is not worth interrupting the caller over.
   */
  private static List<String> populatedAmong(String entityType, String fqn, List<String> fields) {
    List<String> populated = new ArrayList<>();
    List<String> wanted = fields.stream().distinct().toList();
    try {
      // Ask for exactly the arrays this patch overwrites. A fixed field list would silently stop
      // covering an array added to GUARDED_ARRAYS later: unrequested fields come back empty, which
      // reads as "nothing to lose" and waves the patch through.
      EntityInterface current =
          Entity.getEntityByName(entityType, fqn, String.join(",", wanted), Include.NON_DELETED);
      Map<String, Object> asMap = JsonUtils.getMap(current);
      wanted.stream().filter(field -> holdsEntries(asMap.get(field))).forEach(populated::add);
    } catch (Exception e) {
      // The entity is read only to describe what would be lost. If that read fails, the patch is
      // still the caller's to make - let the write itself report the real problem.
      LOG.debug(
          "Could not read {} {} to check array replacement: {}", entityType, fqn, e.getMessage());
    }
    return populated;
  }

  private static boolean holdsEntries(Object value) {
    return value instanceof List<?> list && !list.isEmpty();
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
