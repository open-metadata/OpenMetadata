package org.openmetadata.mcp.tools;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.json.Json;
import jakarta.json.JsonArray;
import jakarta.json.JsonException;
import jakarta.json.JsonPatch;
import java.io.StringReader;
import java.util.Map;
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

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params) {
    String entityType = (String) params.get("entityType");
    String fqn = (String) params.get("fqn");
    requireTarget(entityType, fqn);

    JsonPatch jsonPatch = parsePatch((String) params.get(PATCH_PARAM));

    // The permission comes from the patch itself: the operations it carries decide which
    // MetadataOperations are checked, exactly as the REST resource does it.
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

  private static JsonPatch parsePatch(String rawPatch) {
    if (nullOrEmpty(rawPatch)) {
      throw new IllegalArgumentException(
          "Parameter 'patch' is required: a JSONPatch document (RFC 6902) as a JSON array string,"
              + " e.g. [{\"op\": \"replace\", \"path\": \"/description\", \"value\": \"...\"}].");
    }
    return Json.createPatch(readOperations(rawPatch));
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
