package org.openmetadata.service.search;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Optional;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.vector.client.EmbeddingModel;

/**
 * What happens to the {@code embedding} field of an existing index, on a mapping update and when
 * the server starts, the same on Elasticsearch and OpenSearch. Both engines refuse to change the
 * dimensions or the index options of an existing vector field, and {@code PUT _mapping} is atomic,
 * so re-sending a field the index already maps either does nothing or costs every other field of
 * the update (ADR:2026-11-26-the-server-reconciles-live-vector-fields-with-the-embedding-model).
 */
public enum EmbeddingFieldUpdate {
  /** No index behind the name maps the field: declare it, and record the model in {@code _meta}. */
  DECLARE,
  /**
   * Every index behind the name maps it as a vector of the model: leave the field and the model
   * {@code _meta} records out, so the field keeps the options it was created with.
   */
  KEEP,
  /**
   * It could not be read, or the index cannot hold the model's vectors (an index maps the field
   * with other dimensions or as something else, records another model, or cannot take a new vector
   * field): leave the field and its {@code _meta} out, so the rest of the update still reaches the
   * index and nothing claims a model the index does not hold.
   */
  LEAVE_OUT;

  /** What to do with the field for {@code model}, given what {@code live} maps now. */
  public static EmbeddingFieldUpdate updateFor(LiveEmbeddingField live, EmbeddingModel model) {
    EmbeddingFieldUpdate update;
    if (!live.readable()) {
      update = LEAVE_OUT;
    } else if (live.mapped()) {
      update = live.holds(model) ? KEEP : LEAVE_OUT;
    } else {
      update = live.acceptsNewVectorField() ? DECLARE : LEAVE_OUT;
    }
    return update;
  }

  /**
   * As {@link #updateFor}, for a mapping update of an existing index: what it decides is recorded
   * in the server's {@link VectorFieldHealth}, which reports it and keeps vectors away from an
   * index that cannot hold them.
   */
  public static EmbeddingFieldUpdate decide(LiveEmbeddingField live, EmbeddingModel model) {
    EmbeddingFieldUpdate update = updateFor(live, model);
    SearchRepository searchRepository = Entity.getSearchRepository();
    if (searchRepository != null) {
      searchRepository.getVectorFieldHealth().record(live, model, update);
    }
    return update;
  }

  /** The embedding model search indexes are built for, while semantic search is on. */
  public static Optional<EmbeddingModel> activeEmbeddingModel() {
    SearchRepository searchRepository = Entity.getSearchRepository();
    return searchRepository == null ? Optional.empty() : searchRepository.getEmbeddingModel();
  }

  /**
   * Whether new vector indexes are built to hold vectors, also before the model's dimension is
   * known ({@link SearchRepository#buildsVectorIndexes}).
   */
  public static boolean buildsVectorIndexes() {
    SearchRepository searchRepository = Entity.getSearchRepository();
    return searchRepository != null && searchRepository.buildsVectorIndexes();
  }

  /**
   * Records {@code model} in the {@code _meta} of {@code mappings}, keeping its other entries, and
   * returns that {@code _meta}. It is the one place that writes which model an index's vectors are
   * built with, for a new index as for a {@code PUT _mapping} on an existing one; a {@code PUT
   * _mapping} replaces the whole live {@code _meta}, so its body starts from the live one.
   */
  public static ObjectNode recordModel(ObjectNode mappings, EmbeddingModel model) {
    ObjectNode meta =
        mappings.get(LiveEmbeddingField.META) instanceof ObjectNode existing
            ? existing
            : mappings.putObject(LiveEmbeddingField.META);
    return meta.put(LiveEmbeddingField.META_EMBEDDING_MODEL, model.id())
        .put(LiveEmbeddingField.META_EMBEDDING_DIMENSION, model.dimension());
  }

  /**
   * The {@code PUT _mapping} body that records {@code model} in the {@code _meta} of {@code index}:
   * its live {@code _meta}, from {@code reply} to {@code GET <index>/_mapping?filter_path=
   * *.mappings._meta}, with the model recorded in it.
   */
  public static ObjectNode modelRecordedOn(String index, JsonNode reply, EmbeddingModel model) {
    ObjectNode mappings = JsonUtils.getObjectNode();
    if (reply.path(index).path("mappings").path(LiveEmbeddingField.META)
        instanceof ObjectNode live) {
      mappings.set(LiveEmbeddingField.META, live.deepCopy());
    }
    recordModel(mappings, model);
    return mappings;
  }

  /**
   * Records {@code model} in the {@code _meta} of {@code mappings} when the field is declared, and
   * drops the model entries otherwise. A {@code PUT _mapping} replaces the whole {@code _meta} and
   * keeps the live one when the body has none, so an emptied {@code _meta} is dropped as well.
   */
  public void applyModelMeta(ObjectNode mappings, EmbeddingModel model) {
    if (this == DECLARE) {
      recordModel(mappings, model);
    } else if (mappings.get(LiveEmbeddingField.META) instanceof ObjectNode meta) {
      meta.remove(
          List.of(
              LiveEmbeddingField.META_EMBEDDING_MODEL,
              LiveEmbeddingField.META_EMBEDDING_DIMENSION));
      if (meta.isEmpty()) {
        mappings.remove(LiveEmbeddingField.META);
      }
    }
  }
}
