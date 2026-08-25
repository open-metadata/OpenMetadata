package org.openmetadata.mcp.tools;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.json.Json;
import jakarta.json.JsonArray;
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
 * Updates an entity, from either a hand-written JSON Patch or typed fields.
 *
 * <p>The two forms converge immediately: {@link TypedFieldPatch} turns typed fields into a patch
 * document and everything after that is identical, so there is one authorization check, one {@code
 * repository.patch} and one change event regardless of which the caller used. Typed fields exist
 * because authoring the patch requires knowing whether a field is already set - {@code add} versus
 * {@code replace} - which costs a read the server can do itself.
 */
@Slf4j
public class PatchEntityTool implements McpTool {

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params) {
    String entityType = (String) params.get("entityType");
    String fqn = (String) params.get("fqn");
    requireTarget(entityType, fqn);

    JsonPatch jsonPatch = buildPatch(entityType, fqn, params);

    // The permission is derived from the patch itself, so a typed-field update is authorized
    // exactly as strictly as the equivalent hand-written document.
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
   * Chooses the form the caller used, and refuses to guess when they used both.
   *
   * <p>Silently preferring one would let the ignored half look applied - the same class of
   * "reported success, did something else" this tool's typed fields exist to remove.
   */
  private static JsonPatch buildPatch(String entityType, String fqn, Map<String, Object> params) {
    String rawPatch = (String) params.get("patch");
    boolean typed = TypedFieldPatch.requested(params);
    if (!nullOrEmpty(rawPatch) && typed) {
      throw new IllegalArgumentException(
          "Pass either 'patch' or the typed fields (description, displayName, owners, tags), not"
              + " both.");
    }
    if (nullOrEmpty(rawPatch) && !typed) {
      throw new IllegalArgumentException(
          "Nothing to apply. Pass typed fields (description, displayName, owners, tags) or a"
              + " 'patch' document.");
    }
    return typed ? TypedFieldPatch.build(entityType, fqn, params) : parsePatchDocument(rawPatch);
  }

  private static JsonPatch parsePatchDocument(String rawPatch) {
    JsonArray patchArray = Json.createReader(new StringReader(rawPatch)).readArray();
    return Json.createPatch(patchArray);
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
