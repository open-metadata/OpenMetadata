package org.openmetadata.service.search;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * What the indexes behind one name map as their {@code embedding} field, read live with {@code GET
 * <name>/_mapping/field/embedding}. The name may be an alias over a rebuilt index, so each index
 * behind it is kept apart. A mapping update of an existing index decides from it what to do with
 * the field (ADR:2026-11-26-the-server-reconciles-live-vector-fields-with-the-embedding-model).
 *
 * @param name the index or alias the mapping update targets
 * @param indexes every index behind the name
 * @param byIndex how each index that maps the field declares it
 * @param withoutVectorSupport indexes that cannot take a new vector field until they are rebuilt,
 *     such as an OpenSearch index created without {@code index.knn}
 * @param readFailure why the field could not be read, or {@code null} when it was
 */
public record LiveEmbeddingField(
    String name,
    Set<String> indexes,
    Map<String, Declared> byIndex,
    Set<String> withoutVectorSupport,
    String readFailure) {
  public static final String FIELD = "embedding";

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
    withoutVectorSupport = Set.copyOf(withoutVectorSupport);
  }

  /** An index about to be created, which maps nothing yet. */
  public static LiveEmbeddingField notMapped(String name) {
    return new LiveEmbeddingField(name, Set.of(), Map.of(), Set.of(), null);
  }

  public static LiveEmbeddingField unreadable(String name, String reason) {
    String failure = reason == null ? "no reason given" : reason;
    return new LiveEmbeddingField(name, Set.of(), Map.of(), Set.of(), failure);
  }

  /**
   * Reads the reply of the field mapping API, which has the same shape on Elasticsearch and
   * OpenSearch: {@code {"<index>": {"mappings": {"embedding": {"mapping": {"embedding": {...}}}}}}},
   * with {@code "mappings": {}} for an index without the field. Only the type and the dimensions
   * are read, so options the engine adds later cannot fail it.
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
    return new LiveEmbeddingField(name, indexes, byIndex, Set.of(), null);
  }

  private static Declared declared(JsonNode field, String vectorType, String dimensionsKey) {
    String type = field.path("type").asText();
    JsonNode dimensions = field.path(dimensionsKey);
    boolean vector = vectorType.equals(type) && dimensions.canConvertToInt();
    return new Declared(type, vector ? Integer.valueOf(dimensions.asInt()) : null);
  }

  /** This field, knowing that only {@code supporting} of its indexes can take a new vector field. */
  public LiveEmbeddingField withVectorSupportOnlyIn(Set<String> supporting) {
    Set<String> unsupported = new HashSet<>(indexes);
    unsupported.removeAll(supporting);
    return new LiveEmbeddingField(name, indexes, byIndex, unsupported, readFailure);
  }

  public boolean readable() {
    return readFailure == null;
  }

  public boolean mapped() {
    return !byIndex.isEmpty();
  }

  /** Whether every index that maps the field maps it as a vector of {@code dimension}. */
  public boolean holds(int dimension) {
    return byIndex.values().stream().allMatch(declared -> declared.holds(dimension));
  }

  public boolean acceptsNewVectorField() {
    return withoutVectorSupport.isEmpty();
  }

  /** What stands in the way, index by index and sorted, for an operator to read. */
  public String describe() {
    Stream<String> declared =
        byIndex.entrySet().stream().map(entry -> entry.getKey() + " has " + entry.getValue());
    Stream<String> unsupported =
        withoutVectorSupport.stream().map(index -> index + " was created without vector support");
    return Stream.concat(declared, unsupported).sorted().collect(Collectors.joining(", "));
  }
}
