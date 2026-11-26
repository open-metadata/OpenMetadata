package org.openmetadata.service.search;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;
import org.openmetadata.service.search.vector.client.EmbeddingModel;

/**
 * What the indexes behind one name map as their {@code embedding} field, and which embedding model
 * each records in {@code _meta}, read live. The name may be an alias over a rebuilt index, so each
 * index behind it is kept apart. Whether the field can hold the vectors of the configured model is
 * decided from it (ADR:2026-11-26-the-server-reconciles-live-vector-fields-with-the-embedding-model).
 *
 * @param name the index or alias the server writes to
 * @param indexes every index behind the name
 * @param byIndex how each index that maps the field declares it
 * @param recordedModels the {@code _meta.embedding_model} of each index that records one
 * @param withoutVectorSupport indexes that cannot take a new vector field until they are rebuilt,
 *     such as an OpenSearch index created without {@code index.knn}
 * @param readFailure why the field could not be read, or {@code null} when it was
 */
public record LiveEmbeddingField(
    String name,
    Set<String> indexes,
    Map<String, Declared> byIndex,
    Map<String, String> recordedModels,
    Set<String> withoutVectorSupport,
    String readFailure) {
  public static final String FIELD = "embedding";
  public static final String META = "_meta";
  public static final String META_EMBEDDING_MODEL = "embedding_model";
  public static final String META_EMBEDDING_DIMENSION = "embedding_dimension";

  /**
   * How one index declares the field: a vector of {@code dimensions}, or another type, whose
   * {@code dimensions} is {@code null}.
   */
  public record Declared(String type, Integer dimensions) {
    boolean holds(int dimension) {
      return dimensions != null && dimensions == dimension;
    }

    @Override
    public String toString() {
      return dimensions == null ? type : String.format("%s of %d dimensions", type, dimensions);
    }
  }

  public LiveEmbeddingField {
    indexes = Set.copyOf(indexes);
    byIndex = Map.copyOf(byIndex);
    recordedModels = Map.copyOf(recordedModels);
    withoutVectorSupport = Set.copyOf(withoutVectorSupport);
  }

  /** An index about to be created, which maps nothing yet. */
  public static LiveEmbeddingField notMapped(String name) {
    return new LiveEmbeddingField(name, Set.of(), Map.of(), Map.of(), Set.of(), null);
  }

  public static LiveEmbeddingField unreadable(String name, String reason) {
    String failure = reason == null ? "no reason given" : reason;
    return new LiveEmbeddingField(name, Set.of(), Map.of(), Map.of(), Set.of(), failure);
  }

  /**
   * Reads the reply of {@code GET <name>/_mapping/field/embedding}, which has the same shape on
   * Elasticsearch and OpenSearch: {@code {"<index>": {"mappings": {"embedding": {"mapping":
   * {"embedding": {...}}}}}}}, with {@code "mappings": {}} for an index without the field. Only the
   * type and the dimensions are read, so options the engine adds later cannot fail it.
   *
   * @param vectorType the engine's vector type, {@code dense_vector} or {@code knn_vector}
   * @param dimensionsKey where that type keeps its dimensions, {@code dims} or {@code dimension}
   */
  public static LiveEmbeddingField fromFieldMapping(
      String name, JsonNode reply, String vectorType, String dimensionsKey) {
    Set<String> indexes = new HashSet<>();
    Map<String, Declared> byIndex = new HashMap<>();
    reply
        .properties()
        .forEach(
            index -> {
              indexes.add(index.getKey());
              JsonNode field =
                  index.getValue().path("mappings").path(FIELD).path("mapping").path(FIELD);
              if (field.isObject()) {
                byIndex.put(index.getKey(), declared(field, vectorType, dimensionsKey));
              }
            });
    return new LiveEmbeddingField(name, indexes, byIndex, Map.of(), Set.of(), null);
  }

  private static Declared declared(JsonNode field, String vectorType, String dimensionsKey) {
    String type = field.path("type").asText();
    JsonNode dimensions = field.path(dimensionsKey);
    boolean vector = vectorType.equals(type) && dimensions.canConvertToInt();
    return new Declared(type, vector ? Integer.valueOf(dimensions.asInt()) : null);
  }

  /**
   * This field with the models its indexes record, from the reply of {@code GET
   * <name>/_mapping?filter_path=*.mappings._meta.embedding_model}: {@code {"<index>": {"mappings":
   * {"_meta": {"embedding_model": "..."}}}}}, without the indexes that record none.
   */
  public LiveEmbeddingField withRecordedModels(JsonNode reply) {
    Map<String, String> models = new HashMap<>();
    reply
        .properties()
        .forEach(
            index -> {
              JsonNode model =
                  index.getValue().path("mappings").path(META).path(META_EMBEDDING_MODEL);
              if (model.isTextual()) {
                models.put(index.getKey(), model.asText());
              }
            });
    return new LiveEmbeddingField(
        name, indexes, byIndex, models, withoutVectorSupport, readFailure);
  }

  /** This field, knowing that only {@code supporting} of its indexes can take a new vector field. */
  public LiveEmbeddingField withVectorSupportOnlyIn(Set<String> supporting) {
    Set<String> unsupported = new HashSet<>(indexes);
    unsupported.removeAll(supporting);
    return new LiveEmbeddingField(name, indexes, byIndex, recordedModels, unsupported, readFailure);
  }

  public boolean readable() {
    return readFailure == null;
  }

  public boolean mapped() {
    return !byIndex.isEmpty();
  }

  /**
   * Whether every index that maps the field maps it as a vector of the model's dimension and
   * records no other model. An index that records no model at all is judged by its dimension.
   */
  public boolean holds(EmbeddingModel model) {
    return byIndex.keySet().stream().allMatch(index -> whyCannotHold(index, model).isEmpty());
  }

  public boolean acceptsNewVectorField() {
    return withoutVectorSupport.isEmpty();
  }

  /**
   * Whether every index behind the name maps the field as a vector of the model's dimension,
   * whatever model it records: what {@code reembed} needs to replace its vectors in place.
   */
  public boolean takesVectorsOf(EmbeddingModel model) {
    return readable()
        && !indexes.isEmpty()
        && indexes.stream()
            .allMatch(
                index -> byIndex.containsKey(index) && byIndex.get(index).holds(model.dimension()));
  }

  /** The indexes behind the name that cannot hold the model's vectors. */
  public Set<String> indexesThatCannotHold(EmbeddingModel model) {
    Set<String> blocking = new TreeSet<>(withoutVectorSupport);
    byIndex.keySet().stream()
        .filter(index -> whyCannotHold(index, model).isPresent())
        .forEach(blocking::add);
    return blocking;
  }

  /** Why the model's vectors cannot go there, index by index and sorted, for an operator to read. */
  public String describe(EmbeddingModel model) {
    return indexesThatCannotHold(model).stream()
        .map(
            index ->
                whyCannotHold(index, model).orElse(index + " was created without vector support"))
        .collect(Collectors.joining(", "));
  }

  private Optional<String> whyCannotHold(String index, EmbeddingModel model) {
    Declared declared = byIndex.get(index);
    String recorded = recordedModels.get(index);
    Optional<String> reason = Optional.empty();
    if (declared != null && !declared.holds(model.dimension())) {
      reason = Optional.of(index + " has " + declared);
    } else if (declared != null && recorded != null && !Objects.equals(recorded, model.id())) {
      reason = Optional.of(index + " holds vectors of model " + recorded);
    }
    return reason;
  }
}
