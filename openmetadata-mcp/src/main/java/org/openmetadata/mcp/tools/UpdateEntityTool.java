package org.openmetadata.mcp.tools;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.google.common.annotations.VisibleForTesting;
import jakarta.json.JsonPatch;
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
 * Updates an entity from typed fields instead of a hand-written JSON Patch.
 *
 * <p>{@code patch_entity} requires the caller to author a JSON Patch document serialised as a
 * string. That costs two things measured on live runs: a mandatory read-before-write (the caller
 * must fetch the entity to learn whether a field exists, so it can choose {@code add} versus
 * {@code replace}, and to avoid clobbering text it meant to extend), and a class of retry when the
 * pointer syntax or the escaping is wrong. One agent summarised it as "pure overhead imposed by the
 * lack of an append affordance".
 *
 * <p>So the server does the work it is better placed to do: fetch the current entity, apply the
 * requested changes, and compute the patch itself. This is deliberately a wrapper over the existing
 * patch path rather than a second write path — the same {@code OperationContext} authorisation, the
 * same {@code repository.patch}, the same {@code changeDescription} and version bump.
 *
 * <p>Array fields take a mode: {@code add} unions (the default), {@code set} replaces, {@code
 * remove} subtracts. Without that, "update the owners" is ambiguous between replace and append.
 *
 * <p><b>The default is {@code add}, not {@code set}, and that is the whole point.</b> An entity's
 * {@code tags} array holds more than the classification tags this tool writes: the tier label lives
 * there (the search index derives {@code tier} from it), and so do glossary terms, which {@link
 * CommonUtils#buildTagLabels} cannot even construct. A {@code set} default therefore meant {@code
 * tags: ["PII.Sensitive"]} - the ordinary way to add one tag - deleted the asset's tier and every
 * glossary term, and returned success. Replacing a list is now something a caller asks for by name.
 */
@Slf4j
public class UpdateEntityTool implements McpTool {

  private static final String MODE_SET = "set";
  private static final String MODE_ADD = "add";
  private static final String MODE_REMOVE = "remove";
  private static final String MODE_APPEND = "append";

  private static final String FIELDS = "owners,tags,domains";

  private static final List<String> ARRAY_MODES = List.of(MODE_ADD, MODE_SET, MODE_REMOVE);
  private static final List<String> DESCRIPTION_MODES = List.of(MODE_SET, MODE_APPEND);

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params) {
    String entityType = (String) params.get("entityType");
    String fqn = (String) params.get("fqn");
    requireTarget(entityType, fqn);

    EntityInterface current = Entity.getEntityByName(entityType, fqn, FIELDS, Include.NON_DELETED);
    String originalJson = JsonUtils.pojoToJson(current);
    EntityInterface updated = JsonUtils.readValue(originalJson, current.getClass());

    applyChanges(updated, params);
    JsonPatch jsonPatch = JsonUtils.getJsonPatch(originalJson, JsonUtils.pojoToJson(updated));
    requireChange(jsonPatch);

    return applyPatch(authorizer, securityContext, entityType, fqn, jsonPatch);
  }

  private static void requireTarget(String entityType, String fqn) {
    if (nullOrEmpty(entityType) || nullOrEmpty(fqn)) {
      throw new IllegalArgumentException("Parameters 'entityType' and 'fqn' are required");
    }
  }

  /**
   * A patch that changes nothing is almost always a caller mistake — a misspelled field name, or a
   * value identical to the stored one. Reporting it beats a silent no-op that looks like success.
   */
  private static void requireChange(JsonPatch jsonPatch) {
    if (jsonPatch.toJsonArray().isEmpty()) {
      throw new IllegalArgumentException(
          "No changes to apply. Supply at least one of: description, displayName, owners, tags."
              + " If you passed one, its value already matches what is stored. To set a tier, pass"
              + " it as a tag, e.g. tags: [\"Tier.Tier1\"] with tagsMode: \"add\".");
    }
  }

  /**
   * Reads a mode and rejects anything outside the documented set.
   *
   * <p>The merge helpers below start from {@code requested} and only deviate for {@code add} and
   * {@code remove}, so an unrecognised mode used to mean <em>replace</em> - silently, and reported
   * as success. The likeliest wrong guess is built into this tool's own vocabulary: descriptions
   * take {@code append} while arrays take {@code add}, so {@code ownersMode: "append"} is a natural
   * thing for a model to write, and it replaced the owner list.
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
  void applyChangesForTest(EntityInterface entity, Map<String, Object> params) {
    applyChanges(entity, params);
  }

  private void applyChanges(EntityInterface entity, Map<String, Object> params) {
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
      boolean appending = MODE_APPEND.equalsIgnoreCase(mode) && !nullOrEmpty(existing);
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
    if (MODE_ADD.equalsIgnoreCase(mode)) {
      result = union(existing, requested, EntityReference::getId);
    } else if (MODE_REMOVE.equalsIgnoreCase(mode)) {
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

  private static List<TagLabel> mergeTags(
      List<TagLabel> existing, List<TagLabel> requested, String mode) {
    List<TagLabel> result = new ArrayList<>(requested);
    if (MODE_ADD.equalsIgnoreCase(mode)) {
      result = union(existing, requested, TagLabel::getTagFQN);
    } else if (MODE_REMOVE.equalsIgnoreCase(mode)) {
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

  private Map<String, Object> applyPatch(
      Authorizer authorizer,
      CatalogSecurityContext securityContext,
      String entityType,
      String fqn,
      JsonPatch jsonPatch) {
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
    return McpResponseUtils.compact(response.entity(), response.changeType());
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      Map<String, Object> params) {
    throw new UnsupportedOperationException(
        "UpdateEntityTool does not support limits enforcement.");
  }
}
