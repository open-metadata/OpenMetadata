/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.mcp.tools;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.core.type.TypeReference;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Supplier;
import org.apache.jena.query.ParameterizedSparqlString;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

/** Finds entities associated with a tag or glossary-term fully qualified name. */
public class FindByTagTool extends RdfMcpTool<FindByTagTool.Result> {

  private static final String ONTOLOGY_NAMESPACE = "https://open-metadata.org/ontology/";
  private static final int DEFAULT_LIMIT = 50;
  private static final int MAX_LIMIT = 500;
  private static final TypeReference<SparqlResultSet<EntityBinding>> ENTITY_RESULTS =
      new TypeReference<>() {};

  public FindByTagTool() {
    super();
  }

  FindByTagTool(Supplier<RdfRepository> repositorySupplier) {
    super(repositorySupplier);
  }

  @JsonInclude(JsonInclude.Include.NON_NULL)
  public record EntityMatch(
      String entity, String entityType, String fullyQualifiedName, String label) {}

  @JsonInclude(JsonInclude.Include.NON_NULL)
  public record Result(
      String tagFqn,
      String entityTypeFilter,
      int limit,
      int offset,
      List<EntityMatch> results,
      int returnedCount) {

    public Result {
      results = List.copyOf(Objects.requireNonNull(results));
    }

    private static Result of(
        String tagFqn, String entityTypeFilter, int limit, int offset, List<EntityMatch> matches) {
      return new Result(tagFqn, entityTypeFilter, limit, offset, matches, matches.size());
    }
  }

  @Override
  protected Result executeAuthorized(
      final CatalogSecurityContext securityContext, final Map<String, Object> params)
      throws IOException {
    McpToolParameters parameters = McpToolParameters.from(params);
    String tagFqn = parameters.requiredString("tagFqn");
    String entityType = validatedEntityType(parameters.optionalString("entityType"));
    int limit = clamp(parameters.integer("limit", DEFAULT_LIMIT), 1, MAX_LIMIT);
    int offset = Math.max(parameters.integer("offset", 0), 0);
    String json =
        repository()
            .executeSparqlQuery(
                buildSparql(tagFqn, entityType, limit, offset), "application/sparql-results+json");
    List<EntityMatch> matches = parseRows(json);

    return Result.of(tagFqn, entityType, limit, offset, matches);
  }

  /**
   * One row per entity, not one row per {@code rdf:type}.
   *
   * <p>{@code ?entity a ?entityType} with {@code DISTINCT} emitted a separate row for every type an
   * entity carries, and OpenMetadata really does type some entities more than once - three LLM
   * models in a live graph are typed as both {@code om:LlmModel} and {@code om:LLMModel}, two
   * ontology classes differing only in case. That turned 15 matching entities into 18 rows and
   * silently corrupted {@code limit}/{@code offset}: a page could contain the same asset twice while
   * the caller believed it had seen 18 distinct assets. Grouping by {@code ?entity} collapses the
   * duplicates, and {@code MIN} makes the surviving type, FQN and label a deterministic choice
   * rather than an arbitrary one. Multiple FQN or label triples on one entity are collapsed the same
   * way.
   */
  static String buildSparql(String tagFqn, String entityType, int limit, int offset) {
    String typeFilter = entityTypeFilter(entityType);
    ParameterizedSparqlString query =
        new ParameterizedSparqlString(
            """
            PREFIX om: <https://open-metadata.org/ontology/>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            SELECT ?entity
                   (MIN(?typeIri) AS ?entityType)
                   (MIN(?fqnValue) AS ?fqn)
                   (MIN(?labelValue) AS ?label) WHERE {
              { ?tag om:tagFQN ?requestedTag }
              UNION { ?tag om:fullyQualifiedName ?requestedTag }
              { ?entity om:hasTag ?tag }
              UNION { ?entity om:hasGlossaryTerm ?tag }
              ?entity a ?typeIri .
              OPTIONAL { ?entity om:fullyQualifiedName ?fqnValue }
              OPTIONAL { ?entity rdfs:label ?labelValue }
            %s} GROUP BY ?entity ORDER BY ?fqn LIMIT %d OFFSET %d
            """
                .formatted(typeFilter, limit, offset));
    query.setLiteral("requestedTag", tagFqn);
    return query.toString().stripTrailing();
  }

  private static String entityTypeFilter(String entityType) {
    return McpToolParameters.isBlank(entityType)
        ? "  FILTER(STRSTARTS(STR(?typeIri), \"%s\"))\n".formatted(ONTOLOGY_NAMESPACE)
        : "  FILTER(?typeIri = <%s%s>)\n".formatted(ONTOLOGY_NAMESPACE, capitalize(entityType));
  }

  static List<EntityMatch> parseRows(String selectJson) {
    return SparqlResultSet.rows(selectJson, ENTITY_RESULTS).stream()
        .flatMap(binding -> binding.toEntityMatch().stream())
        .toList();
  }

  private static String validatedEntityType(String entityType) {
    return McpToolParameters.isBlank(entityType)
        ? null
        : McpEntityReference.validateType(entityType);
  }

  private static String capitalize(String value) {
    return Character.toUpperCase(value.charAt(0)) + value.substring(1);
  }

  private static int clamp(int value, int minimum, int maximum) {
    return Math.min(Math.max(value, minimum), maximum);
  }

  private record EntityBinding(
      SparqlResultSet.Value entity,
      SparqlResultSet.Value entityType,
      SparqlResultSet.Value fqn,
      SparqlResultSet.Value label) {

    private Optional<EntityMatch> toEntityMatch() {
      return Optional.ofNullable(entity)
          .map(
              ignored ->
                  new EntityMatch(value(entity), value(entityType), value(fqn), value(label)));
    }

    private static String value(SparqlResultSet.Value binding) {
      return binding == null ? null : binding.value();
    }
  }
}
