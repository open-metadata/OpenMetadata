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
package org.openmetadata.service.rdf.translator;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.MissingNode;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.apache.jena.rdf.model.Literal;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.service.Entity;
import org.openmetadata.service.rdf.RdfQualityEvidence;
import org.openmetadata.service.rdf.RdfUtils;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;

/**
 * Emits what a test case tests and its latest result. The result is one node per test case, named
 * {@code <test case>/result/latest}, so a newer result changes it in place and the test case's
 * entity write replaces it exactly; history stays in the time-series store
 * (ADR:2026-11-18-the-rdf-graph-carries-the-latest-quality-evidence). Sample rows are never
 * emitted.
 */
final class RdfTestResultMapper {
  private static final String OM_NS = "https://open-metadata.org/ontology/";
  private static final String DQV_VALUE = "http://www.w3.org/ns/dqv#value";
  private static final String GENERATED_AT = "http://www.w3.org/ns/prov#generatedAtTime";
  private static final String LATEST_RESULT = "/result/latest";
  private static final String OPEN_INCIDENT = "/incident/open";
  private static final String RESOLVED = TestCaseResolutionStatusTypes.Resolved.value();
  private static final List<String> RESULT_NUMBERS =
      List.of("passedRows", "failedRows", "minBound", "maxBound");

  private RdfTestResultMapper() {}

  /** The FQN of the table a test case document's entity link points at. */
  static Optional<String> testedTableFqn(final JsonNode testCase) {
    return entityLink(testCase).map(EntityLink::getEntityFQN);
  }

  static void emit(
      final JsonNode testCase,
      final LiveTagLookup liveTables,
      final MappingTarget target,
      final String baseUri) {
    emitTestedTable(testCase, liveTables, target, baseUri);
    emitTestedColumn(testCase, target, baseUri);
    RdfJsonNode.object(testCase, "testCaseResult").ifPresent(result -> emitResult(result, target));
    RdfJsonNode.object(testCase, "incidentStatus")
        .filter(RdfTestResultMapper::isOpen)
        .ifPresent(incident -> emitIncident(incident, target, baseUri));
  }

  private static void emitTestedTable(
      final JsonNode testCase,
      final LiveTagLookup liveTables,
      final MappingTarget target,
      final String baseUri) {
    testedTableFqn(testCase)
        .map(fqn -> liveTables.liveIds(Entity.TABLE, Set.of(fqn)).get(fqn))
        .ifPresent(id -> target.link("testsEntity", tableIri(baseUri, id)));
  }

  private static void emitTestedColumn(
      final JsonNode testCase, final MappingTarget target, final String baseUri) {
    final boolean columnTest =
        entityLink(testCase).map(link -> link.getFieldName() != null).orElse(false);
    RdfJsonNode.field(testCase, "entityFQN")
        .filter(fqn -> columnTest)
        .ifPresent(fqn -> target.link("testsColumn", RdfUtils.columnUri(baseUri, fqn.asText())));
  }

  private static void emitResult(final JsonNode result, final MappingTarget target) {
    final Model model = target.model();
    final Resource node = model.createResource(target.subject().getURI() + LATEST_RESULT);
    target.subject().addProperty(model.createProperty(OM_NS, "hasTestResult"), node);
    node.addProperty(RDF.type, model.createResource(OM_NS + "TestCaseResult"));
    text(result, "testCaseStatus").ifPresent(status -> literal(node, "testResultStatus", status));
    text(result, "result").ifPresent(message -> literal(node, "testResultMessage", message));
    timestamp(result).ifPresent(time -> node.addProperty(model.createProperty(GENERATED_AT), time));
    emitLatestFacts(result, target.subject());
    emitResultNumbers(result, node);
    emitResultValues(result, node);
  }

  /** The latest status and run time again on the test case, so its own card shows them. */
  private static void emitLatestFacts(final JsonNode result, final Resource testCase) {
    final Model model = testCase.getModel();
    text(result, "testCaseStatus")
        .ifPresent(status -> literal(testCase, "latestResultStatus", status));
    timestamp(result)
        .ifPresent(
            time -> testCase.addProperty(model.createProperty(OM_NS, "latestResultAt"), time));
  }

  private static boolean isOpen(final JsonNode incident) {
    return text(incident, "testCaseResolutionStatusType")
        .filter(state -> !RESOLVED.equals(state))
        .isPresent();
  }

  private static void emitIncident(
      final JsonNode incident, final MappingTarget target, final String baseUri) {
    final Model model = target.model();
    final Resource node = model.createResource(target.subject().getURI() + OPEN_INCIDENT);
    target.subject().addProperty(model.createProperty(OM_NS, "hasOpenIncident"), node);
    node.addProperty(RDF.type, model.createResource(OM_NS + "TestCaseIncident"));
    text(incident, "testCaseResolutionStatusType")
        .ifPresent(state -> literal(node, "incidentState", state));
    text(incident, "severity").ifPresent(severity -> literal(node, "incidentSeverity", severity));
    timestamp(incident)
        .ifPresent(time -> node.addProperty(model.createProperty(GENERATED_AT), time));
    RdfJsonNode.object(incident, "testCaseResolutionStatusDetails")
        .flatMap(details -> RdfJsonNode.object(details, "assignee"))
        .flatMap(assignee -> referenceIri(assignee, baseUri))
        .ifPresent(
            iri ->
                node.addProperty(
                    model.createProperty(OM_NS, "incidentAssignee"), model.createResource(iri)));
  }

  private static Optional<String> referenceIri(final JsonNode reference, final String baseUri) {
    return text(reference, "type")
        .flatMap(type -> text(reference, "id").map(id -> baseUri + "entity/" + type + "/" + id));
  }

  private static Optional<Literal> timestamp(final JsonNode record) {
    return RdfJsonNode.field(record, "timestamp")
        .filter(JsonNode::isNumber)
        .map(RdfJsonNode::epochDateTime);
  }

  private static void emitResultNumbers(final JsonNode result, final Resource resultNode) {
    final Model model = resultNode.getModel();
    for (final String field : RESULT_NUMBERS) {
      RdfJsonNode.field(result, field)
          .filter(JsonNode::isNumber)
          .ifPresent(
              value ->
                  resultNode.addProperty(
                      model.createProperty(OM_NS, field), RdfJsonNode.number(value, model)));
    }
  }

  private static void emitResultValues(final JsonNode result, final Resource resultNode) {
    final JsonNode values =
        RdfJsonNode.array(result, "testResultValue").orElse(MissingNode.getInstance());
    for (int index = 0; index < values.size(); index++) {
      emitResultValue(values.get(index), resultNode, index);
    }
  }

  private static void emitResultValue(
      final JsonNode value, final Resource resultNode, final int index) {
    final Model model = resultNode.getModel();
    final Resource valueNode = model.createResource(resultNode.getURI() + "/value/" + index);
    resultNode.addProperty(model.createProperty(OM_NS, "hasResultValue"), valueNode);
    valueNode.addProperty(RDF.type, model.createResource(OM_NS + "TestResultValue"));
    text(value, "name").ifPresent(name -> valueNode.addProperty(RDFS.label, name));
    text(value, "value")
        .ifPresent(observed -> valueNode.addProperty(model.createProperty(DQV_VALUE), observed));
  }

  private static Optional<EntityLink> entityLink(final JsonNode testCase) {
    return text(testCase, "entityLink").flatMap(RdfQualityEvidence::parseEntityLink);
  }

  private static Optional<String> text(final JsonNode parent, final String field) {
    return RdfJsonNode.field(parent, field).filter(JsonNode::isTextual).map(JsonNode::asText);
  }

  private static void literal(final Resource node, final String predicate, final String value) {
    node.addProperty(node.getModel().createProperty(OM_NS, predicate), value);
  }

  private static String tableIri(final String baseUri, final UUID tableId) {
    return baseUri + "entity/" + Entity.TABLE + "/" + tableId;
  }

  /** The test case resource the triples are written to, and the model it belongs to. */
  record MappingTarget(Resource subject, Model model) {
    void link(final String predicate, final String objectIri) {
      subject.addProperty(model.createProperty(OM_NS, predicate), model.createResource(objectIri));
    }
  }
}
