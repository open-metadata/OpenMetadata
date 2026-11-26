package org.openmetadata.service.search;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.Optional;
import java.util.function.Function;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.vector.client.EmbeddingClient;

/**
 * What happens to the {@code embedding} field of an existing index, on a mapping update and when
 * the server starts, the same on Elasticsearch and OpenSearch. Both engines refuse to change the
 * dimensions or the index options of an existing vector field, and {@code PUT _mapping} is atomic,
 * so re-sending a field the index already maps either does nothing or costs every other field of
 * the update (ADR:2026-11-26-the-server-reconciles-live-vector-fields-with-the-embedding-model).
 */
@Slf4j
public enum EmbeddingFieldUpdate {
  /** No index behind the name maps the field: declare it, and record the model in {@code _meta}. */
  DECLARE,
  /**
   * Every index behind the name maps it as a vector of the configured dimensions: leave the field
   * out, so it keeps the options it was created with.
   */
  KEEP,
  /**
   * It could not be read, or the index cannot hold the configured vectors (an index maps the field
   * as something else, or cannot take a new vector field): leave the field and its {@code _meta}
   * out, so the rest of the update still reaches the index and nothing claims a model the index
   * does not hold.
   */
  LEAVE_OUT;

  /** Decides the update for {@code live}, and tells the operator when the field is left out. */
  public static EmbeddingFieldUpdate decide(
      LiveEmbeddingField live, int dimension, String modelId) {
    EmbeddingFieldUpdate update = updateFor(live, dimension);
    if (update == LEAVE_OUT) {
      reportLeftOut(live, dimension, modelId);
    }
    return update;
  }

  /**
   * The {@code PUT _mapping} body that declares the field on an existing vector index, built by
   * {@code declaration} for the configured model, when {@link #decide} says {@link #DECLARE}; empty
   * otherwise, and empty without reading the live field when embeddings are off.
   */
  public static Optional<String> declarationFor(
      Supplier<LiveEmbeddingField> live, Function<EmbeddingClient, ObjectNode> declaration) {
    return activeEmbeddingClient()
        .filter(client -> decide(live.get(), client.getDimension(), client.getModelId()) == DECLARE)
        .map(client -> declaration.apply(client).toString());
  }

  /** The configured embedding client, while embeddings are on. */
  public static Optional<EmbeddingClient> activeEmbeddingClient() {
    SearchRepository searchRepository = Entity.getSearchRepository();
    boolean embeddingsOn = searchRepository != null && searchRepository.isVectorEmbeddingEnabled();
    return Optional.ofNullable(embeddingsOn ? searchRepository.getEmbeddingClient() : null);
  }

  static EmbeddingFieldUpdate updateFor(LiveEmbeddingField live, int dimension) {
    EmbeddingFieldUpdate update;
    if (!live.readable()) {
      update = LEAVE_OUT;
    } else if (live.mapped()) {
      update = live.holds(dimension) ? KEEP : LEAVE_OUT;
    } else {
      update = live.acceptsNewVectorField() ? DECLARE : LEAVE_OUT;
    }
    return update;
  }

  private static void reportLeftOut(LiveEmbeddingField live, int dimension, String modelId) {
    if (live.readable()) {
      reportVectorsItCannotHold(live, dimension, modelId);
    } else {
      reportUnreadable(live);
    }
  }

  private static void reportUnreadable(LiveEmbeddingField live) {
    LOG.error(
        "Could not read the live embedding field of search index {}: {}. The field was left as it "
            + "is, and any other mapping change still applies. Restart the server once the field "
            + "can be read, so that a missing embedding field is added.",
        live.name(),
        live.readFailure());
  }

  private static void reportVectorsItCannotHold(
      LiveEmbeddingField live, int dimension, String modelId) {
    LOG.error(
        "Search index {} cannot hold the {}-dimension vectors of the configured embedding model {}: "
            + "{}. A vector field cannot be changed or added there in place, so the field was left "
            + "as it is, and vectors of this model cannot be written to the index or searched in it "
            + "until it is rebuilt. Rebuild the search indexes with this model by running "
            + "Search Indexing for all entities, or ./bootstrap/openmetadata-ops.sh reindex "
            + "--force, or configure the previous embedding model again.",
        live.name(),
        dimension,
        modelId,
        live.describe());
  }
}
