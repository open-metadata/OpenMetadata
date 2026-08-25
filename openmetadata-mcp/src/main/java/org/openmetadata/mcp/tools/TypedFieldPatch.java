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
import org.openmetadata.mcp.util.McpParams;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

/**
 * Builds a JSON Patch for {@code patch_entity} from typed fields, so the caller does not have to
 * author one.
 *
 * <p>Writing the patch by hand costs a mandatory read first: JSON Patch needs {@code add} when the
 * field is absent and {@code replace} when it is present, and the caller cannot know which without
 * fetching the entity. That makes a one-field edit two MCP calls, and every call re-sends the whole
 * conversation and all tool definitions. Nothing here decides between {@code add} and {@code
 * replace} either - it reads the entity, applies the fields to a copy, and lets {@link
 * JsonUtils#getJsonPatch} diff the two. The read still happens; it just happens in-process instead
 * of as a second round trip.
 *
 * <p>Array fields take a mode: {@code add} unions (the default), {@code set} replaces, {@code
 * remove} subtracts. The default is {@code add}, and that matters. An entity's {@code tags} array
 * holds more than the classification tags this writes - the tier label lives there (the search index
 * derives {@code tier} from it), and so do glossary terms, which {@link CommonUtils#buildTagLabels}
 * cannot even construct. With a {@code set} default, {@code tags: ["PII.Sensitive"]} - the ordinary
 * way to add one tag - deleted the asset's tier and every glossary term and returned success.
 * Replacing a list is something a caller has to ask for by name.
 */
public final class TypedFieldPatch {

  private static final String MODE_SET = "set";
  private static final String MODE_ADD = "add";
  private static final String MODE_REMOVE = "remove";
  private static final String MODE_APPEND = "append";

  /** Fields resolved on the read, so owner and tag merges see what is already there. */
  private static final String READ_FIELDS = "owners,tags,domains";

  private static final List<String> ARRAY_MODES = List.of(MODE_ADD, MODE_SET, MODE_REMOVE);
  private static final List<String> DESCRIPTION_MODES = List.of(MODE_SET, MODE_APPEND);

  /** The typed fields this understands. Any of them present means the caller chose this form. */
  private static final List<String> TYPED_FIELDS =
      List.of("description", "displayName", "owners", "tags");

  private TypedFieldPatch() {}

  /** True when the caller supplied typed fields rather than a hand-written patch document. */
  public static boolean requested(Map<String, Object> params) {
    return params != null && TYPED_FIELDS.stream().anyMatch(field -> params.get(field) != null);
  }

  /** Reads the entity, applies the requested fields to a copy, and returns the resulting diff. */
  public static JsonPatch build(String entityType, String fqn, Map<String, Object> params) {
    EntityInterface current =
        Entity.getEntityByName(entityType, fqn, READ_FIELDS, Include.NON_DELETED);
    String originalJson = JsonUtils.pojoToJson(current);
    EntityInterface updated = JsonUtils.readValue(originalJson, current.getClass());
    applyChanges(updated, params);
    JsonPatch jsonPatch = JsonUtils.getJsonPatch(originalJson, JsonUtils.pojoToJson(updated));
    requireChange(jsonPatch);
    return jsonPatch;
  }

  /**
   * A patch that changes nothing is almost always a caller mistake - a misspelled field name, or a
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
   * <p>The merge helpers start from {@code requested} and only deviate for {@code add} and {@code
   * remove}, so an unrecognised mode meant <em>replace</em> - silently, and reported as success. The
   * likeliest wrong guess is built into this vocabulary: descriptions take {@code append} while
   * arrays take {@code add}, so {@code ownersMode: "append"} is a natural thing for a model to
   * write, and it replaced the owner list.
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
      // Removal matches against the entity's current owners rather than the directory: an owner who
      // has since been deleted no longer resolves, and requiring resolution would make exactly the
      // stale reference a caller most wants to clear the one they cannot.
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
}
