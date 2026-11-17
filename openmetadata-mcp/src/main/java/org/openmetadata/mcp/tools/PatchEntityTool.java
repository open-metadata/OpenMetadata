package org.openmetadata.mcp.tools;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.json.Json;
import jakarta.json.JsonArray;
import jakarta.json.JsonObject;
import jakarta.json.JsonPatch;
import jakarta.json.JsonString;
import jakarta.json.JsonValue;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.tools.McpResponseUtils.PatchProjectionSpec;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ServiceEntityRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.ImpersonationContext;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.util.BoundedJsonPatch;
import org.openmetadata.service.util.RestUtil;

/**
 * Applies a JSON Patch (RFC 6902) to an entity - the same document the REST PATCH API takes, passed
 * through as written.
 *
 * <p>Nothing here rewrites the operations, and only paths into a service's connection are refused
 * ({@link #requireConnectionUntouched}). A patch touches exactly the paths it names, which is the
 * point of the format; this tool's job is to authorize it and hand it to the repository. By
 * default, the reply carries a compact confirmation and touched non-bulk fields unless {@code
 * response="full"} is requested (ADR:2026-11-17-mcp-patch-entity-returns-compact-confirmation).
 */
@Slf4j
public class PatchEntityTool implements McpTool {

  private static final String ENTITY_TYPE_PARAM = "entityType";
  private static final String FQN_PARAM = "fqn";
  private static final String PATCH_PARAM = "patch";
  private static final String RESPONSE_PARAM = "response";
  private static final String COMPACT_RESPONSE = "compact";
  private static final String FULL_RESPONSE = "full";
  private static final String OP_KEY = "op";
  private static final String PATH_KEY = "path";
  private static final String VALUE_KEY = "value";
  private static final String FROM_KEY = "from";
  private static final String TEST_OP = "test";
  private static final String EXTENSION_FIELD = "extension";
  private static final String POINTER_PREFIX = "/";
  private static final String CONNECTION_POINTER = "/connection";

  // Resources that do lifecycle work outside EntityRepository.patch(), which a direct repository
  // patch would skip. Derived by auditing every @PATCH endpoint under openmetadata-service for a
  // body that is not a bare patchInternal() delegation - re-run that audit before adding an entry
  // here or dropping one. What each entry protects:
  //   announcement         authorizeAdminOrBot on system announcements (no entityLink)
  //   app                  system-app guard, scheduler teardown/reinstall
  //   contextFile          Private/Shared visibility, owner-only restriction of sharing
  //   document             requirePublic - private doc types are not editable
  //   eventsubscription    scheduler re-registration
  //   ingestionPipeline    secret decryptOrNullify on the response
  //   intakeForm           authorizeAdmin
  //   notificationTemplate provider-aware EDIT_ALL authorization
  //   persona              authorizeAdmin
  //   testCase             table-or-testCase authorization, sample cleanup
  //   testSuite            getAuthRequestsForUpdate authorization
  //   task                 restricted-field diff validation
  //   team                 authorizeAdmin on defaultPersona
  //   user                 isAdmin / isBot / roles / teams authorization
  //   workflow             connection-secret decryptOrNullify
  // metric and metricGroup are not listed: their extra checks run in the repository write.
  private static final Set<String> DEDICATED_PATCH_LIFECYCLES =
      Set.of(
          Entity.ANNOUNCEMENT,
          Entity.APPLICATION,
          Entity.CONTEXT_FILE,
          Entity.DOCUMENT,
          Entity.EVENT_SUBSCRIPTION,
          Entity.INGESTION_PIPELINE,
          Entity.INTAKE_FORM,
          Entity.NOTIFICATION_TEMPLATE,
          Entity.PERSONA,
          Entity.TEST_CASE,
          Entity.TEST_SUITE,
          Entity.TASK,
          Entity.TEAM,
          Entity.USER,
          Entity.WORKFLOW);

  /** The members RFC 6902 requires for each operation, beyond {@code op} itself. */
  private static final Map<String, List<String>> REQUIRED_MEMBERS =
      Map.of(
          "add",
          List.of(PATH_KEY, VALUE_KEY),
          "replace",
          List.of(PATH_KEY, VALUE_KEY),
          TEST_OP,
          List.of(PATH_KEY, VALUE_KEY),
          "remove",
          List.of(PATH_KEY),
          "move",
          List.of(PATH_KEY, FROM_KEY),
          "copy",
          List.of(PATH_KEY, FROM_KEY));

  private record ValidatedPatchRequest(
      String entityType, String fqn, JsonPatch jsonPatch, PatchProjectionSpec projection) {}

  @Override
  public Map<String, Object> execute(
      final Authorizer authorizer,
      final CatalogSecurityContext securityContext,
      final Map<String, Object> params) {
    final ValidatedPatchRequest request = validateRequest(securityContext, params);
    authorizeAndEnforceVisibility(authorizer, securityContext, request);
    final RestUtil.PatchResponse<? extends EntityInterface<?>> response =
        applyPatch(securityContext, request);
    final EntityInterface<?> visibleEntity =
        CommonUtils.withVisibleEvidence(response.entity(), authorizer, securityContext);
    return McpResponseUtils.markHeld(
        McpResponseUtils.projectPatch(visibleEntity, response.changeType(), request.projection()),
        response.pendingChangeRequestId());
  }

  private static ValidatedPatchRequest validateRequest(
      final CatalogSecurityContext securityContext, final Map<String, Object> params) {
    final String entityType = (String) params.get(ENTITY_TYPE_PARAM);
    final String fqn = (String) params.get(FQN_PARAM);
    requireTarget(entityType, fqn);
    final boolean fullResponse = wantsFullResponse(params);
    requireGenericPatchLifecycle(entityType);
    CommonUtils.refuseImpersonatedGrantWrite(securityContext, entityType);
    final JsonPatch jsonPatch = parsePatch((String) params.get(PATCH_PARAM));
    requireConnectionUntouched(entityType, jsonPatch);
    final PatchProjectionSpec projection = buildProjectionSpec(entityType, fullResponse, jsonPatch);
    return new ValidatedPatchRequest(entityType, fqn, jsonPatch, projection);
  }

  private static void authorizeAndEnforceVisibility(
      final Authorizer authorizer,
      final CatalogSecurityContext securityContext,
      final ValidatedPatchRequest request) {
    // The permission comes from the patch itself: the operations it carries decide which
    // MetadataOperations are checked, exactly as the REST resource does it.
    authorizer.authorize(
        securityContext,
        new OperationContext(request.entityType(), request.jsonPatch()),
        new ResourceContext<>(
            request.entityType(), null, request.fqn(), ResourceContextInterface.Operation.PATCH));
    // The response carries the patched entity, so this write answers a read as well: apply the
    // per-entity visibility rules the authorize() above cannot see.
    CommonUtils.enforceEntityVisibility(request.entityType(), request.fqn(), securityContext);
  }

  private static RestUtil.PatchResponse<? extends EntityInterface<?>> applyPatch(
      final CatalogSecurityContext securityContext, final ValidatedPatchRequest request) {
    final EntityRepository<? extends EntityInterface<?>> repository =
        Entity.getEntityRepository(request.entityType());
    final String userName = securityContext.getUserPrincipal().getName();
    final RestUtil.PatchResponse<? extends EntityInterface<?>> response =
        repository.patch(
            null,
            request.fqn(),
            userName,
            request.jsonPatch(),
            // AUTOMATED, not MANUAL: the write is made by an agent through MCP, not by a person
            // editing in the UI.
            ChangeSource.AUTOMATED,
            null,
            ImpersonationContext.getImpersonatedBy());
    McpChangeEventUtil.publishChangeEvent(response.entity(), response.changeType(), userName);
    return response;
  }

  private static boolean wantsFullResponse(final Map<String, Object> params) {
    final Object rawMode = params.get(RESPONSE_PARAM);
    if (rawMode == null) {
      return false;
    }
    if (rawMode instanceof String mode) {
      return switch (mode.isBlank() ? COMPACT_RESPONSE : mode) {
        case COMPACT_RESPONSE -> false;
        case FULL_RESPONSE -> true;
        default -> throw invalidResponseMode(rawMode);
      };
    }
    throw invalidResponseMode(rawMode);
  }

  private static IllegalArgumentException invalidResponseMode(final Object rawMode) {
    return new IllegalArgumentException(
        "Parameter 'response' must be 'compact' or 'full'. Received: "
            + rawMode
            + ". Nothing was changed.");
  }

  static PatchProjectionSpec buildProjectionSpec(
      final String entityType, final boolean fullResponse, final JsonPatch jsonPatch) {
    return fullResponse
        ? PatchProjectionSpec.full(entityType)
        : buildCompactProjectionSpec(entityType, jsonPatch);
  }

  private static PatchProjectionSpec buildCompactProjectionSpec(
      final String entityType, final JsonPatch jsonPatch) {
    final Set<String> touchedFields = new LinkedHashSet<>();
    final Set<String> touchedExtensionKeys = new LinkedHashSet<>();
    boolean replaceWholeExtension = false;
    for (final JsonValue value : jsonPatch.toJsonArray()) {
      final JsonObject op = value.asJsonObject();
      if (!TEST_OP.equals(memberOrNull(op, OP_KEY))) {
        replaceWholeExtension |=
            collectPointerTarget(memberOrNull(op, PATH_KEY), touchedFields, touchedExtensionKeys);
        replaceWholeExtension |=
            collectPointerTarget(memberOrNull(op, FROM_KEY), touchedFields, touchedExtensionKeys);
      }
    }
    return new PatchProjectionSpec(
        entityType, false, touchedFields, touchedExtensionKeys, replaceWholeExtension);
  }

  private static boolean collectPointerTarget(
      final String pointer,
      final Set<String> touchedFields,
      final Set<String> touchedExtensionKeys) {
    if (pointer == null || !pointer.startsWith(POINTER_PREFIX)) {
      return pointer != null && pointer.isEmpty();
    }
    final String body = pointer.substring(1);
    final int slashIndex = body.indexOf('/');
    final String topLevel =
        unescapeJsonPointer(slashIndex < 0 ? body : body.substring(0, slashIndex));
    if (!topLevel.isEmpty()) {
      touchedFields.add(topLevel);
    }
    return EXTENSION_FIELD.equals(topLevel)
        && collectExtensionSubkey(body, slashIndex, touchedExtensionKeys);
  }

  private static boolean collectExtensionSubkey(
      final String body, final int slashIndex, final Set<String> touchedExtensionKeys) {
    if (slashIndex < 0) {
      return true;
    }
    final String remainder = body.substring(slashIndex + 1);
    final int nextSlash = remainder.indexOf('/');
    final String subkey =
        unescapeJsonPointer(nextSlash < 0 ? remainder : remainder.substring(0, nextSlash));
    if (subkey.isEmpty()) {
      return true;
    }
    touchedExtensionKeys.add(subkey);
    return false;
  }

  private static String unescapeJsonPointer(final String token) {
    // RFC 6901 §4: decode '~1' before '~0' so '~01' becomes '~1' rather than '/'.
    return token.replace("~1", "/").replace("~0", "~");
  }

  private static void requireTarget(final String entityType, final String fqn) {
    if (nullOrEmpty(entityType) || nullOrEmpty(fqn)) {
      throw new IllegalArgumentException("Parameters 'entityType' and 'fqn' are required");
    }
  }

  private static void requireGenericPatchLifecycle(final String entityType) {
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

  /**
   * A service's connection holds its credentials, and MCP reads return it masked. Stricter than
   * REST PATCH on purpose: an agent neither edits the connection nor reads the stored config back
   * through a {@code copy}, {@code move} or {@code test}; connection changes go through the
   * service's REST API. The root pointer is refused too: replacing the whole document replaces the
   * connection with it. ADR:2026-10-20-mcp-responses-mask-stored-credentials
   */
  private static void requireConnectionUntouched(final String entityType, final JsonPatch patch) {
    final boolean touchesConnection =
        Entity.getEntityRepository(entityType) instanceof ServiceEntityRepository<?, ?>
            && patch.toJsonArray().stream()
                .map(JsonValue::asJsonObject)
                .flatMap(op -> Stream.of(memberOrNull(op, PATH_KEY), memberOrNull(op, FROM_KEY)))
                .anyMatch(PatchEntityTool::reachesConnection);
    if (touchesConnection) {
      throw new IllegalArgumentException(
          "patch_entity cannot change or read a service's '"
              + CONNECTION_POINTER
              + "': it holds the service's credentials. Use the service's OpenMetadata REST API."
              + " Nothing was changed.");
    }
  }

  private static boolean reachesConnection(final String pointer) {
    return pointer != null
        && (pointer.isEmpty()
            || pointer.equals(CONNECTION_POINTER)
            || pointer.startsWith(CONNECTION_POINTER + POINTER_PREFIX));
  }

  private static JsonPatch parsePatch(final String rawPatch) {
    if (nullOrEmpty(rawPatch)) {
      throw new IllegalArgumentException(
          "Parameter 'patch' is required: a JSONPatch document (RFC 6902) as a JSON array string,"
              + " e.g. [{\"op\": \"replace\", \"path\": \"/description\", \"value\": \"...\"}].");
    }
    // Bound the parse the same way the REST reader does, before anything is authorized.
    final JsonArray operations;
    try {
      operations = BoundedJsonPatch.readArray(rawPatch);
    } catch (BoundedJsonPatch.PatchTooLargeException e) {
      throw new IllegalArgumentException("Parameter 'patch' is too large: " + e.getMessage(), e);
    } catch (BoundedJsonPatch.InvalidPatchException e) {
      throw new IllegalArgumentException(
          "Parameter 'patch' is not valid JSON: " + e.getMessage(), e);
    }
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
  private static void requireOperationShape(final JsonValue operation) {
    if (operation.getValueType() != JsonValue.ValueType.OBJECT) {
      throw invalidPatch("every operation must be a JSON object, and this one is not");
    }
    final JsonObject fields = operation.asJsonObject();
    final String op = memberOrNull(fields, OP_KEY);
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

  private static String memberOrNull(final JsonObject fields, final String key) {
    final JsonValue value = fields.get(key);
    return value != null && value.getValueType() == JsonValue.ValueType.STRING
        ? ((JsonString) value).getString()
        : null;
  }

  private static IllegalArgumentException invalidPatch(final String reason) {
    return new IllegalArgumentException(
        "Parameter 'patch' is not a valid JSONPatch document: "
            + reason
            + ". Nothing was changed. See https://jsonpatch.com for the shape of each operation.");
  }

  @Override
  public Map<String, Object> execute(
      final Authorizer authorizer,
      final Limits limits,
      final CatalogSecurityContext securityContext,
      final Map<String, Object> params) {
    throw new UnsupportedOperationException("PatchEntityTool does not support limits enforcement.");
  }
}
