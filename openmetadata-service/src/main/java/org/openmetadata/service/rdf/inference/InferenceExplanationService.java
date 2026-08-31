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

package org.openmetadata.service.rdf.inference;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.ws.rs.ServiceUnavailableException;
import java.net.URI;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import org.apache.jena.datatypes.TypeMapper;
import org.apache.jena.graph.Node;
import org.apache.jena.graph.NodeFactory;
import org.apache.jena.riot.out.NodeFmtLib;
import org.openmetadata.schema.api.configuration.rdf.InferenceRuleStatus;
import org.openmetadata.schema.api.data.OntologyInferenceExplanation;
import org.openmetadata.schema.api.data.OntologyInferenceExplanationRequest;
import org.openmetadata.schema.api.data.OntologyInferenceRuleExplanation;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.RdfStatement;
import org.openmetadata.schema.utils.JsonUtils;

/** Explains materialized RDF statements without loading the knowledge graph into the JVM. */
public final class InferenceExplanationService {
  static final String KNOWLEDGE_GRAPH = "https://open-metadata.org/graph/knowledge";
  private static final String BELONGS_TO_GLOSSARY =
      "https://open-metadata.org/ontology/belongsToGlossary";
  private static final String INFERRED_GRAPH_PATH = "graph/inferred/";
  private static final String JSON_FORMAT = "application/sparql-results+json";

  private final QueryExecutor queryExecutor;
  private final RuleCatalog ruleCatalog;
  private final String baseUri;

  public InferenceExplanationService(
      final QueryExecutor queryExecutor, final RuleCatalog ruleCatalog, final String baseUri) {
    this.queryExecutor = Objects.requireNonNull(queryExecutor);
    this.ruleCatalog = Objects.requireNonNull(ruleCatalog);
    this.baseUri = normalizeBaseUri(baseUri);
  }

  public OntologyInferenceExplanation explain(
      final Glossary glossary, final OntologyInferenceExplanationRequest request) {
    requireAvailable();
    requireMatchingGlossary(glossary, request);
    final RdfStatement statement = requireValidStatement(request.getStatement());
    final Set<String> graphUris = findGraphUris(glossary.getId().toString(), statement);
    final List<OntologyInferenceRuleExplanation> explanations = explanations(graphUris);
    return result(glossary, statement, graphUris, explanations);
  }

  private Set<String> findGraphUris(final String glossaryId, final RdfStatement statement) {
    final String response = queryExecutor.execute(graphQuery(glossaryId, statement), JSON_FORMAT);
    final GraphQueryResponse parsed = JsonUtils.readValue(response, GraphQueryResponse.class);
    return parsed.results().bindings().stream()
        .map(GraphBinding::graph)
        .map(SparqlValue::value)
        .collect(Collectors.toUnmodifiableSet());
  }

  private List<OntologyInferenceRuleExplanation> explanations(final Set<String> graphUris) {
    return ruleCatalog.list().stream()
        .filter(status -> graphUris.contains(status.getGraphUri().toString()))
        .map(InferenceExplanationService::explanation)
        .toList();
  }

  private static OntologyInferenceRuleExplanation explanation(final InferenceRuleStatus status) {
    return new OntologyInferenceRuleExplanation()
        .withRule(status.getRule())
        .withGraphUri(status.getGraphUri())
        .withLastMaterializedAt(status.getLastMaterializedAt())
        .withTripleCount(status.getTripleCount());
  }

  private OntologyInferenceExplanation result(
      final Glossary glossary,
      final RdfStatement statement,
      final Set<String> graphUris,
      final List<OntologyInferenceRuleExplanation> explanations) {
    final boolean inferred = graphUris.stream().anyMatch(this::isInferredGraph);
    return new OntologyInferenceExplanation()
        .withGlossary(glossary.getEntityReference())
        .withStatement(statement)
        .withAsserted(graphUris.contains(KNOWLEDGE_GRAPH))
        .withInferred(inferred)
        .withExplanations(explanations);
  }

  private String graphQuery(final String glossaryId, final RdfStatement statement) {
    final String triple = statement(statement);
    final String graphFilter = graphFilter();
    final String scopeFilter = scopeFilter(glossaryId, statement);
    return """
        SELECT DISTINCT ?graph WHERE {
          GRAPH ?graph { %s }
          FILTER(%s)
          FILTER(%s)
        }
        """
        .formatted(triple, graphFilter, scopeFilter);
  }

  private String graphFilter() {
    final String inferredPrefix = literal(baseUri + INFERRED_GRAPH_PATH);
    return "?graph = <%s> || STRSTARTS(STR(?graph), %s)".formatted(KNOWLEDGE_GRAPH, inferredPrefix);
  }

  private String scopeFilter(final String glossaryId, final RdfStatement statement) {
    final String glossaryIri = baseUri + "entity/glossary/" + glossaryId;
    return belongsToGlossary(statement.getSubjectIri(), glossaryIri);
  }

  private static String belongsToGlossary(final URI resourceIri, final String glossaryIri) {
    return "EXISTS { GRAPH <%s> { <%s> <%s> <%s> } }"
        .formatted(KNOWLEDGE_GRAPH, resourceIri, BELONGS_TO_GLOSSARY, glossaryIri);
  }

  private static String statement(final RdfStatement statement) {
    final String subject = iri(statement.getSubjectIri());
    final String predicate = iri(statement.getPredicateIri());
    return "%s %s %s .".formatted(subject, predicate, object(statement));
  }

  private static String object(final RdfStatement statement) {
    return switch (statement.getObjectKind()) {
      case IRI -> iri(statement.getObjectIri());
      case LITERAL -> literal(statement);
    };
  }

  private static String iri(final URI value) {
    return NodeFmtLib.strNT(NodeFactory.createURI(value.toString()));
  }

  private static String literal(final String value) {
    return NodeFmtLib.strNT(NodeFactory.createLiteralString(value));
  }

  private static String literal(final RdfStatement statement) {
    final Node node;
    if (!nullOrEmpty(statement.getLanguage())) {
      node = NodeFactory.createLiteralLang(statement.getLiteralValue(), statement.getLanguage());
    } else if (statement.getDatatypeIri() != null) {
      node =
          NodeFactory.createLiteralDT(
              statement.getLiteralValue(),
              TypeMapper.getInstance().getSafeTypeByName(statement.getDatatypeIri().toString()));
    } else {
      node = NodeFactory.createLiteralString(statement.getLiteralValue());
    }
    return NodeFmtLib.strNT(node);
  }

  private static RdfStatement requireValidStatement(final RdfStatement statement) {
    Objects.requireNonNull(statement, "RDF statement is required");
    Objects.requireNonNull(statement.getSubjectIri(), "RDF subject IRI is required");
    Objects.requireNonNull(statement.getPredicateIri(), "RDF predicate IRI is required");
    Objects.requireNonNull(statement.getObjectKind(), "RDF object kind is required");
    switch (statement.getObjectKind()) {
      case IRI -> requireIriObject(statement);
      case LITERAL -> requireLiteralObject(statement);
    }
    return statement;
  }

  private static void requireIriObject(final RdfStatement statement) {
    if (statement.getObjectIri() == null) {
      throw new IllegalArgumentException("RDF IRI object requires objectIri");
    }
    if (statement.getLiteralValue() != null) {
      throw new IllegalArgumentException("RDF IRI object must not define literalValue");
    }
  }

  private static void requireLiteralObject(final RdfStatement statement) {
    if (statement.getLiteralValue() == null) {
      throw new IllegalArgumentException("RDF literal object requires literalValue");
    }
    if (statement.getObjectIri() != null) {
      throw new IllegalArgumentException("RDF literal object must not define objectIri");
    }
    if (statement.getDatatypeIri() != null && !nullOrEmpty(statement.getLanguage())) {
      throw new IllegalArgumentException("RDF literal cannot define both datatypeIri and language");
    }
  }

  private static void requireMatchingGlossary(
      final Glossary glossary, final OntologyInferenceExplanationRequest request) {
    Objects.requireNonNull(glossary, "Glossary is required");
    Objects.requireNonNull(request, "Inference explanation request is required");
    if (!glossary.getId().equals(request.getGlossaryId())) {
      throw new IllegalArgumentException("Inference explanation glossary does not match request");
    }
  }

  private void requireAvailable() {
    if (!queryExecutor.isAvailable()) {
      throw new ServiceUnavailableException("RDF inference explanations require an enabled store");
    }
  }

  private boolean isInferredGraph(final String graphUri) {
    return graphUri.startsWith(baseUri + INFERRED_GRAPH_PATH);
  }

  private static String normalizeBaseUri(final String value) {
    Objects.requireNonNull(value, "RDF base URI is required");
    return value.endsWith("/") ? value : value + "/";
  }

  @FunctionalInterface
  public interface RuleCatalog {
    List<InferenceRuleStatus> list();
  }

  public interface QueryExecutor {
    String execute(String query, String format);

    default boolean isAvailable() {
      return true;
    }
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  private record GraphQueryResponse(GraphResults results) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  private record GraphResults(List<GraphBinding> bindings) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  private record GraphBinding(SparqlValue graph) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  private record SparqlValue(String type, String value) {}
}
