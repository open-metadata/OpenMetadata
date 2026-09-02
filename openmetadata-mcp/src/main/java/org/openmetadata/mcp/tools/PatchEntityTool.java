package org.openmetadata.mcp.tools;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.json.Json;
import jakarta.json.JsonArray;
import jakarta.json.JsonException;
import jakarta.json.JsonObject;
import jakarta.json.JsonPatch;
import jakarta.json.JsonString;
import jakarta.json.JsonValue;
import java.io.StringReader;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.ImpersonationContext;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.util.RestUtil;

/**
 * Applies a JSON Patch (RFC 6902) to an entity - the same document the REST PATCH API takes, passed
 * through as written.
 *
 * <p>Nothing here inspects or rewrites the operations. A patch touches exactly the paths it names,
 * which is the point of the format; this tool's job is to authorize it and hand it to the
 * repository. The parts that are easy to get wrong - {@code /owners} replaces the whole list where
 * {@code /owners/-} appends to it - are taught in the tool description, where the model reads them,
 * rather than enforced by second-guessing a well-formed patch.
 */
@Slf4j
public class PatchEntityTool implements McpTool {

  private static final String PATCH_PARAM = "patch";
  private static final String OP_KEY = "op";
  private static final String PATH_KEY = "path";
  private static final String VALUE_KEY = "value";
  private static final String FROM_KEY = "from";

  // Resources that do lifecycle work outside EntityRepository.patch(), which a direct repository
  // patch would skip. Derived by auditing every @PATCH endpoint under openmetadata-service for a
  // body that is not a bare patchInternal() delegation - re-run that audit before adding an entry
  // here or dropping one. What each entry protects:
  //   app                  system-app guard, scheduler teardown/reinstall
  //   document             requirePublic - private doc types are not editable
  //   eventsubscription    scheduler re-registration
  //   ingestionPipeline    secret decryptOrNullify on the response
  //   intakeForm           authorizeAdmin
  //   notificationTemplate provider-aware EDIT_ALL authorization
  //   persona              authorizeAdmin
  //   testCase             table-or-testCase authorization, sample cleanup
  //   testSuite            getAuthRequestsForUpdate authorization
  //   task                 restricted-field diff validation
  //   user                 isAdmin / isBot / roles / teams authorization
  //   workflow             connection-secret decryptOrNullify
  private static final Set<String> DEDICATED_PATCH_LIFECYCLES =
      Set.of(
          Entity.APPLICATION,
          Entity.DOCUMENT,
          Entity.EVENT_SUBSCRIPTION,
          Entity.INGESTION_PIPELINE,
          Entity.INTAKE_FORM,
          Entity.NOTIFICATION_TEMPLATE,
          Entity.PERSONA,
          Entity.TEST_CASE,
          Entity.TEST_SUITE,
          Entity.TASK,
          Entity.USER,
          Entity.WORKFLOW);

  /** The members RFC 6902 requires for each operation, beyond {@code op} itself. */
  private static final Map<String, List<String>> REQUIRED_MEMBERS =
      Map.of(
          "add", List.of(PATH_KEY, VALUE_KEY),
          "replace", List.of(PATH_KEY, VALUE_KEY),
          "test", List.of(PATH_KEY, VALUE_KEY),
          "remove", List.of(PATH_KEY),
          "move", List.of(PATH_KEY, FROM_KEY),
          "copy", List.of(PATH_KEY, FROM_KEY));

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params) {
    String entityType = (String) params.get("entityType");
    String fqn = (String) params.get("fqn");
    requireTarget(entityType, fqn);
    requireGenericPatchLifecycle(entityType);

    JsonPatch jsonPatch = parsePatch((String) params.get(PATCH_PARAM));

    // The permission comes from the patch itself: the operations it carries decide which
    // MetadataOperations are checked, exactly as the REST resource does it.
    authorizer.authorize(
        securityContext,
        new OperationContext(entityType, jsonPatch),
        new ResourceContext<>(entityType, null, fqn, ResourceContextInterface.Operation.PATCH));

    // The response carries the patched entity, so this write answers a read as well: apply the
    // per-entity visibility rules the authorize() above cannot see, since they live outside the
    // policy model.
    CommonUtils.enforceEntityVisibility(entityType, fqn, securityContext);

    EntityRepository<? extends EntityInterface> repository = Entity.getEntityRepository(entityType);
    String userName = securityContext.getUserPrincipal().getName();
    RestUtil.PatchResponse<? extends EntityInterface> response =
        repository.patch(
            null,
            fqn,
            userName,
            jsonPatch,
            // AUTOMATED, not MANUAL: the write is made by an agent through MCP, not by a person
            // editing in the UI. RecognizerFeedbackRepository draws the same line - a human review
            // is MANUAL, anything machine-made is AUTOMATED - and the change summary is what tells
            // a stewardship report which is which.
            ChangeSource.AUTOMATED,
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

  private static void requireGenericPatchLifecycle(String entityType) {
    if (DEDICATED_PATCH_LIFECYCLES.contains(entityType)) {
      throw new IllegalArgumentException(
          "entityType '"
              + entityType
              + "' cannot be patched through patch_entity because its resource performs"
              + " additional authorization, scheduling, cleanup, or secret handling. Use its"
              + " dedicated OpenMetadata REST PATCH API. Nothing was changed.");
    }
    if (Entity.isTimeSeriesEntity(entityType)) {
      throw new IllegalArgumentException(
          "entityType '"
              + entityType
              + "' cannot be patched through patch_entity because time-series entities use"
              + " dedicated repositories and authorization. Use the entity's dedicated"
              + " OpenMetadata API. Nothing was changed.");
    }
  }

  private static JsonPatch parsePatch(String rawPatch) {
    if (nullOrEmpty(rawPatch)) {
      throw new IllegalArgumentException(
          "Parameter 'patch' is required: a JSONPatch document (RFC 6902) as a JSON array string,"
              + " e.g. [{\"op\": \"replace\", \"path\": \"/description\", \"value\": \"...\"}].");
    }
    JsonArray operations = readOperations(rawPatch);
    operations.forEach(PatchEntityTool::requireOperationShape);
    return Json.createPatch(operations);
  }

  /**
   * Checks that one operation has the members RFC 6902 requires for its {@code op}.
   *
   * <p>Structural only, deliberately. {@code Json.createPatch} validates nothing - it builds
   * happily and fails at apply time, inside {@code repository.patch}, where an unknown {@code op}
   * surfaces as a {@code JsonException} and a bare {@code [{"foo":"bar"}]} as a raw {@code
   * NullPointerException}; the dispatcher reads neither as the caller's fault and answers 500 with
   * "retrying will not help", for a document the model wrote and could correct.
   *
   * <p>Whether a path exists is <em>not</em> checked here. That is a question about the entity, not
   * about the document, and the two are indistinguishable once the patch is applied: replacing
   * {@code /description} or appending to {@code /owners/-} both fail against an object that lacks
   * those members, and both are perfectly valid patches. The repository answers that question
   * against the real entity.
   */
  private static void requireOperationShape(JsonValue operation) {
    if (operation.getValueType() != JsonValue.ValueType.OBJECT) {
      throw invalidPatch("every operation must be a JSON object, and this one is not");
    }
    JsonObject fields = operation.asJsonObject();
    String op = memberOrNull(fields, OP_KEY);
    if (op == null || !REQUIRED_MEMBERS.containsKey(op)) {
      throw invalidPatch(
          "'op' must be one of " + REQUIRED_MEMBERS.keySet() + ", and this one is " + op);
    }
    REQUIRED_MEMBERS.get(op).stream()
        .filter(member -> !fields.containsKey(member))
        .findFirst()
        .ifPresent(
            missing -> {
              throw invalidPatch("a '" + op + "' operation needs a '" + missing + "' member");
            });
  }

  private static String memberOrNull(JsonObject fields, String key) {
    JsonValue value = fields.get(key);
    return value != null && value.getValueType() == JsonValue.ValueType.STRING
        ? ((JsonString) value).getString()
        : null;
  }

  private static IllegalArgumentException invalidPatch(String reason) {
    return new IllegalArgumentException(
        "Parameter 'patch' is not a valid JSONPatch document: "
            + reason
            + ". Nothing was changed. See https://jsonpatch.com for the shape of each operation.");
  }

  /**
   * Parses the document, reporting a syntax error as the caller's to fix.
   *
   * <p>The patch is an argument, so malformed JSON is a bad argument. Left to propagate, the
   * dispatcher classifies an unrecognised exception as a server fault and tells the model its
   * arguments were fine and not to retry - for a document the model wrote and could correct.
   */
  private static JsonArray readOperations(String rawPatch) {
    try {
      return Json.createReader(new StringReader(rawPatch)).readArray();
    } catch (JsonException | IllegalStateException e) {
      throw new IllegalArgumentException(
          "Parameter 'patch' is not valid JSON: "
              + e.getMessage()
              + ". It must be a JSON array of operations, e.g. [{\"op\": \"add\", \"path\":"
              + " \"/owners/-\", \"value\": {\"id\": \"<uuid>\", \"type\": \"user\"}}].",
          e);
    }
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
