package org.openmetadata.mcp.tools;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.google.common.annotations.VisibleForTesting;
import jakarta.json.Json;
import jakarta.json.JsonArray;
import jakarta.json.JsonPatch;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.util.McpParams;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
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
 * Updates an entity, from either typed fields or a hand-written JSON Patch.
 *
 * <p>Typed fields remove a round trip: authoring a patch means knowing whether a field is already
 * set ({@code add} versus {@code replace}), which the caller can only learn by fetching the entity
 * first. Here the server reads it, applies the fields to a copy and diffs the two, so a one-field
 * edit is one call. Both forms converge on the same authorization and the same {@code
 * repository.patch}.
 */
@Slf4j
public class PatchEntityTool implements McpTool {

  private static final String MODE_SET = "set";
  private static final String MODE_ADD = "add";
  private static final String MODE_REMOVE = "remove";
  private static final String MODE_APPEND = "append";

  private static final List<String> ARRAY_MODES = List.of(MODE_ADD, MODE_SET, MODE_REMOVE);
  private static final List<String> DESCRIPTION_MODES = List.of(MODE_SET, MODE_APPEND);

  private static final List<String> TYPED_FIELDS =
      List.of("description", "displayName", "owners", "tags");

  /** Resolved on the read so owner and tag merges see what is already on the entity. */
  private static final String READ_FIELDS = "owners,tags,domains";

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params) {
    String entityType = (String) params.get("entityType");
    String fqn = (String) params.get("fqn");
    requireTarget(entityType, fqn);

    JsonPatch jsonPatch = buildPatch(entityType, fqn, params);

    // The permission comes from the patch itself, so a typed update is checked exactly as strictly
    // as the equivalent hand-written document.
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

  /** Picks the form the caller used. Both at once is rejected rather than guessed. */
  private static JsonPatch buildPatch(String entityType, String fqn, Map<String, Object> params) {
    String rawPatch = (String) params.get("patch");
    boolean typed = TYPED_FIELDS.stream().anyMatch(field -> params.get(field) != null);
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
    return typed ? typedPatch(entityType, fqn, params) : parsePatchDocument(rawPatch);
  }

  private static JsonPatch parsePatchDocument(String rawPatch) {
    JsonArray patchArray = Json.createReader(new StringReader(rawPatch)).readArray();
    return Json.createPatch(patchArray);
  }

  /** Reads the entity, applies the typed fields to a copy, and returns the resulting diff. */
  private static JsonPatch typedPatch(String entityType, String fqn, Map<String, Object> params) {
    EntityInterface current =
        Entity.getEntityByName(entityType, fqn, READ_FIELDS, Include.NON_DELETED);
    String originalJson = JsonUtils.pojoToJson(current);
    EntityInterface updated = JsonUtils.readValue(originalJson, current.getClass());
    applyChanges(updated, params);
    JsonPatch jsonPatch = JsonUtils.getJsonPatch(originalJson, JsonUtils.pojoToJson(updated));
    requireChange(jsonPatch);
    return jsonPatch;
  }

  /** A patch that changes nothing is a caller mistake, and beats a no-op that looks like success. */
  private static void requireChange(JsonPatch jsonPatch) {
    if (jsonPatch.toJsonArray().isEmpty()) {
      throw new IllegalArgumentException(
          "No changes to apply. Supply at least one of: description, displayName, owners, tags."
              + " If you passed one, its value already matches what is stored. To set a tier, pass"
              + " it as a tag, e.g. tags: [\"Tier.Tier1\"] with tagsMode: \"add\".");
    }
  }

  /**
   * Reads a mode, rejecting anything outside the documented set. The merge helpers start from the
   * requested list and only deviate for {@code add} and {@code remove}, so an unrecognised mode
   * would silently mean <em>replace</em> - and {@code ownersMode: "append"} is the likely wrong
   * guess, since descriptions take {@code append} while arrays take {@code add}.
   */
  private static String mode(
      Map<String, Object> params, String key, String fallback, List<String> allowed) {
    String requested = McpParams.getString(params, key, fallback).toLowerCase(Locale.ROOT);
    if (!allowed.contains(requested)) {
      throw new IllegalArgumentException(
          String.format(
              "Parameter '%s' must be one of %s. Received: '%s'.", key, allowed, requested));
    }
    return requested;
  }

  @VisibleForTesting
  static void applyChanges(EntityInterface entity, Map<String, Object> params) {
    applyDescription(entity, params);
    applyDisplayName(entity, params);
    applyOwners(entity, params);
    applyTags(entity, params);
  }

  private static void applyDescription(EntityInterface entity, Map<String, Object> params) {
    Object description = params.get("description");
    if (description != null) {
      String mode = mode(params, "descriptionMode", MODE_SET, DESCRIPTION_MODES);
      String existing = entity.getDescription();
      boolean appending = MODE_APPEND.equals(mode) && !nullOrEmpty(existing);
      entity.setDescription(appending ? existing + "\n\n" + description : description.toString());
    }
  }

  private static void applyDisplayName(EntityInterface entity, Map<String, Object> params) {
    Object displayName = params.get("displayName");
    if (displayName != null) {
      entity.setDisplayName(displayName.toString());
    }
  }

  private static void applyOwners(EntityInterface entity, Map<String, Object> params) {
    Object owners = params.get("owners");
    if (owners != null) {
      String mode = mode(params, "ownersMode", MODE_ADD, ARRAY_MODES);
      // Removal matches the entity's current owners rather than the directory: an owner who has
      // been deleted no longer resolves, and requiring resolution would make the stale reference a
      // caller most wants to clear the one they cannot.
      List<EntityReference> requested =
          MODE_REMOVE.equals(mode)
              ? CommonUtils.matchOwnersByName(owners, entity.getOwners())
              : CommonUtils.requireTeamsOrUsers(owners, "owners");
      entity.setOwners(mergeOwners(entity.getOwners(), requested, mode));
    }
  }

  private static List<EntityReference> mergeOwners(
      List<EntityReference> existing, List<EntityReference> requested, String mode) {
    List<EntityReference> result = new ArrayList<>(requested);
    if (MODE_ADD.equals(mode)) {
      result = union(existing, requested, EntityReference::getId);
    } else if (MODE_REMOVE.equals(mode)) {
      result = subtract(existing, requested, EntityReference::getId);
    }
    return result;
  }

  private static void applyTags(EntityInterface entity, Map<String, Object> params) {
    Object tags = params.get("tags");
    if (tags != null) {
      List<TagLabel> requested = CommonUtils.buildTagLabels(tags);
      String mode = mode(params, "tagsMode", MODE_ADD, ARRAY_MODES);
      entity.setTags(mergeTags(entity.getTags(), requested, mode));
    }
  }

  /**
   * Array modes default to {@code add}. The {@code tags} array also holds the entity's tier (the
   * search index derives {@code tier} from it) and its glossary terms, which {@link
   * CommonUtils#buildTagLabels} cannot construct - so a {@code set} default would make {@code tags:
   * ["PII.Sensitive"]}, the ordinary way to add one tag, delete both.
   */
  private static List<TagLabel> mergeTags(
      List<TagLabel> existing, List<TagLabel> requested, String mode) {
    List<TagLabel> result = new ArrayList<>(requested);
    if (MODE_ADD.equals(mode)) {
      result = union(existing, requested, TagLabel::getTagFQN);
    } else if (MODE_REMOVE.equals(mode)) {
      result = subtract(existing, requested, TagLabel::getTagFQN);
    }
    return result;
  }

  private static <T> List<T> union(List<T> existing, List<T> requested, Function<T, Object> key) {
    Set<Object> seen = new LinkedHashSet<>();
    List<T> result = new ArrayList<>();
    Stream.of(existing, requested)
        .filter(list -> !nullOrEmpty(list))
        .flatMap(List::stream)
        .forEach(
            item -> {
              if (seen.add(key.apply(item))) {
                result.add(item);
              }
            });
    return result;
  }

  private static <T> List<T> subtract(
      List<T> existing, List<T> requested, Function<T, Object> key) {
    Set<Object> removing = new LinkedHashSet<>();
    if (!nullOrEmpty(requested)) {
      requested.forEach(item -> removing.add(key.apply(item)));
    }
    List<T> result = new ArrayList<>();
    if (!nullOrEmpty(existing)) {
      existing.stream().filter(item -> !removing.contains(key.apply(item))).forEach(result::add);
    }
    return result;
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
