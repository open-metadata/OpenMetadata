package org.openmetadata.service.entity.write;

import jakarta.ws.rs.core.Response.Status;
import jakarta.ws.rs.core.UriInfo;
import java.util.function.BiFunction;
import java.util.function.Function;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.util.RestUtil.PutResponse;

/** Matches moved glossary terms while retaining the distinct import lookup failure policies. */
public final class GlossaryTermImportPolicy {
  public record Reads(
      Function<String, GlossaryTerm> byFqn, BiFunction<String, String, String> byNameInGlossary) {}

  public record Writes(
      Function<GlossaryTerm, GlossaryTerm> create,
      BiFunction<UriInfo, GlossaryTerm, GlossaryTerm> withHref,
      EntityPuts<GlossaryTerm> update) {}

  private final Reads reads;
  private final Writes writes;

  public GlossaryTermImportPolicy(final Reads reads, final Writes writes) {
    this.reads = reads;
    this.writes = writes;
  }

  public GlossaryTerm match(final GlossaryTerm requested) {
    final GlossaryTerm original = reads.byFqn().apply(requested.getFullyQualifiedName());
    return original == null ? byNameInGlossary(requested) : original;
  }

  public PutResponse<GlossaryTerm> upsert(
      final UriInfo uri, final GlossaryTerm requested, final String actor) {
    final GlossaryTerm original = matchingForUpsert(requested);
    if (original == null) {
      return new PutResponse<>(
          Status.CREATED,
          writes.withHref().apply(uri, writes.create().apply(requested)),
          EventType.ENTITY_CREATED);
    }
    return writes
        .update()
        .update(
            uri,
            original,
            requested,
            new EntityCommandActor(actor, null),
            EntityPutService.Mode.IMPORT);
  }

  private GlossaryTerm matchingForUpsert(final GlossaryTerm requested) {
    final GlossaryTerm original = reads.byFqn().apply(requested.getFullyQualifiedName());
    return original == null ? optionalNameMatch(requested) : original;
  }

  private GlossaryTerm optionalNameMatch(final GlossaryTerm requested) {
    try {
      return byNameInGlossary(requested);
    } catch (Exception ignored) {
      // A failed fallback has historically allowed single-term import to attempt creation.
      return null;
    }
  }

  private GlossaryTerm byNameInGlossary(final GlossaryTerm requested) {
    final String json =
        reads
            .byNameInGlossary()
            .apply(requested.getGlossary().getFullyQualifiedName(), requested.getName());
    return json == null || json.isEmpty() ? null : JsonUtils.readValue(json, GlossaryTerm.class);
  }
}
