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

package org.openmetadata.service.rdf;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.io.IOException;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import org.openmetadata.service.Entity;

/** Application service for RDF entity, graph, lineage, and glossary representations. */
public final class RdfGraphService {

  private static final int MIN_GRAPH_DEPTH = 1;
  private static final int MAX_GRAPH_DEPTH = 5;
  private static final String SPARQL_JSON = "application/sparql-results+json";
  private final RdfRepository repository;
  private final Predicate<String> knownEntityType;

  public RdfGraphService(RdfRepository repository) {
    this(repository, Entity::hasEntityRepository);
  }

  RdfGraphService(RdfRepository repository, Predicate<String> knownEntityType) {
    this.repository = Objects.requireNonNull(repository);
    this.knownEntityType = Objects.requireNonNull(knownEntityType);
  }

  public Representation entity(String entityType, UUID entityId, String requestedFormat)
      throws IOException {
    String validatedEntityType = requireKnownEntityType(entityType);
    Objects.requireNonNull(entityId, "entityId must not be null");
    RdfSerializationFormat format =
        RdfSerializationFormat.parseOrDefault(requestedFormat, RdfSerializationFormat.JSON_LD);
    String body =
        format == RdfSerializationFormat.JSON_LD
            ? repository.getEntityAsJsonLd(validatedEntityType, entityId)
            : repository.getEntityAsRdf(validatedEntityType, entityId, format.externalName());
    return new Representation(body, format.mediaType());
  }

  public String explore(GraphRequest request) throws IOException {
    String entityType = requireKnownEntityType(request.entityType());
    return repository.getEntityGraph(
        request.entityId(),
        entityType,
        request.depth(),
        request.entityTypes(),
        request.relationshipTypes());
  }

  public Representation export(GraphExportRequest request) throws IOException {
    GraphRequest graph = request.graph();
    String entityType = requireKnownEntityType(graph.entityType());
    String body =
        repository.exportEntityGraph(
            graph.entityId(),
            entityType,
            graph.depth(),
            graph.entityTypes(),
            graph.relationshipTypes(),
            request.repositoryFormat());
    String mediaType =
        "JSON-LD".equals(request.repositoryFormat())
            ? RdfSerializationFormat.JSON_LD.mediaType()
            : RdfSerializationFormat.TURTLE.mediaType();
    return new Representation(body, mediaType);
  }

  public String fullLineage(LineageRequest request) {
    String entityType = requireKnownEntityType(request.entityType());
    String query =
        buildLineageQuery(
            request.entityId(), entityType, request.direction(), repository.getBaseUri());
    return repository.executeSparqlQueryWithInference(query, SPARQL_JSON, "custom");
  }

  public String glossaryGraph(GlossaryGraphRequest request) throws IOException {
    return repository.getGlossaryTermGraph(
        request.glossaryId(),
        request.glossaryTermId(),
        request.relationTypes(),
        request.limit(),
        request.offset(),
        request.includeIsolated());
  }

  public Download exportGlossary(UUID glossaryId, String requestedFormat, boolean includeRelations)
      throws IOException {
    Objects.requireNonNull(glossaryId, "glossaryId must not be null");
    RdfSerializationFormat format = RdfSerializationFormat.parse(requestedFormat);
    String body =
        repository.exportGlossaryAsOntology(glossaryId, format.externalName(), includeRelations);
    return new Download(
        body, format.mediaType(), "glossary-" + glossaryId + "." + format.extension());
  }

  public String debugGlossaryRelations() {
    return repository.debugGlossaryTermRelations();
  }

  private String requireKnownEntityType(String entityType) {
    return RdfEntityTypeValidator.requireKnown(entityType, knownEntityType);
  }

  static int clampGraphDepth(int depth) {
    return Math.min(Math.max(depth, MIN_GRAPH_DEPTH), MAX_GRAPH_DEPTH);
  }

  static String buildLineageQuery(
      UUID entityId, String entityType, LineageDirection direction, String baseUri) {
    String normalizedBaseUri = baseUri.endsWith("/") ? baseUri : baseUri + "/";
    String entityUri = normalizedBaseUri + "entity/" + entityType + "/" + entityId;
    return switch (direction) {
      case UPSTREAM -> """
          PREFIX om: <https://open-metadata.org/ontology/>
          SELECT DISTINCT ?entity ?name ?type ?distance
          WHERE {
            <%s> om:upstream+ ?entity .
            ?entity om:name ?name .
            ?entity a ?type .
            BIND(1 as ?distance)
          }
          ORDER BY ?distance ?name
          """
          .formatted(entityUri);
      case DOWNSTREAM -> """
          PREFIX om: <https://open-metadata.org/ontology/>
          SELECT DISTINCT ?entity ?name ?type ?distance
          WHERE {
            <%s> om:downstream+ ?entity .
            ?entity om:name ?name .
            ?entity a ?type .
            BIND(1 as ?distance)
          }
          ORDER BY ?distance ?name
          """
          .formatted(entityUri);
      case BOTH -> """
          PREFIX om: <https://open-metadata.org/ontology/>
          SELECT DISTINCT ?entity ?name ?type ?relationship
          WHERE {
            {
              <%s> om:upstream+ ?entity .
              BIND("upstream" as ?relationship)
            } UNION {
              <%s> om:downstream+ ?entity .
              BIND("downstream" as ?relationship)
            }
            ?entity om:name ?name .
            ?entity a ?type .
          }
          ORDER BY ?relationship ?name
          """
          .formatted(entityUri, entityUri);
    };
  }

  private static Set<String> parseCsvFilter(String values) {
    if (nullOrEmpty(values) || values.isBlank()) {
      return Set.of();
    }
    return Arrays.stream(values.split(","))
        .map(String::trim)
        .filter(value -> !value.isEmpty())
        .collect(Collectors.toCollection(LinkedHashSet::new));
  }

  public record Representation(String body, String mediaType) {
    public Representation {
      Objects.requireNonNull(body);
      Objects.requireNonNull(mediaType);
    }
  }

  public record Download(String body, String mediaType, String fileName) {
    public Download {
      Objects.requireNonNull(body);
      Objects.requireNonNull(mediaType);
      Objects.requireNonNull(fileName);
    }
  }

  public record GraphRequest(
      UUID entityId,
      String entityType,
      int depth,
      Set<String> entityTypes,
      Set<String> relationshipTypes) {
    public GraphRequest {
      Objects.requireNonNull(entityId, "entityId must not be null");
      entityType = RdfEntityTypeValidator.validateSyntax(entityType);
      depth = clampGraphDepth(depth);
      entityTypes = Set.copyOf(Objects.requireNonNull(entityTypes));
      relationshipTypes = Set.copyOf(Objects.requireNonNull(relationshipTypes));
    }

    public static GraphRequest from(
        UUID entityId, String entityType, int depth, String entityTypes, String relationshipTypes) {
      return new GraphRequest(
          entityId,
          entityType,
          depth,
          parseCsvFilter(entityTypes),
          parseCsvFilter(relationshipTypes));
    }
  }

  public record GraphExportRequest(GraphRequest graph, String repositoryFormat) {
    public GraphExportRequest {
      Objects.requireNonNull(graph);
      repositoryFormat = RdfRepository.normalizeEntityGraphExportFormat(repositoryFormat);
    }
  }

  public record LineageRequest(UUID entityId, String entityType, LineageDirection direction) {
    public LineageRequest {
      Objects.requireNonNull(entityId, "entityId must not be null");
      entityType = RdfEntityTypeValidator.validateSyntax(entityType);
      Objects.requireNonNull(direction);
    }

    public static LineageRequest from(UUID entityId, String entityType, String direction) {
      return new LineageRequest(entityId, entityType, LineageDirection.parse(direction));
    }
  }

  public enum LineageDirection {
    UPSTREAM,
    DOWNSTREAM,
    BOTH;

    static LineageDirection parse(String direction) {
      if (nullOrEmpty(direction) || direction.isBlank()) {
        return BOTH;
      }
      try {
        return valueOf(direction.trim().toUpperCase(Locale.ROOT));
      } catch (IllegalArgumentException exception) {
        throw new IllegalArgumentException(
            "direction must be one of upstream, downstream, or both", exception);
      }
    }
  }

  public record GlossaryGraphRequest(
      UUID glossaryId,
      UUID glossaryTermId,
      String relationTypes,
      int limit,
      int offset,
      boolean includeIsolated) {}
}
