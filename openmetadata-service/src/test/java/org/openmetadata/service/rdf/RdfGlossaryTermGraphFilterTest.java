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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.apache.jena.query.QueryFactory;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;

class RdfGlossaryTermGraphFilterTest {

  private static final String BASE_URI = "https://open-metadata.org/";

  @Test
  void glossaryTermFilterQueriesSelectedTermAndDirectNeighbors() throws Exception {
    RdfStorageInterface storage = mock(RdfStorageInterface.class);
    RdfRepository repository = new RdfRepository(config(), storage, null);
    UUID glossaryId = UUID.randomUUID();
    UUID glossaryTermId = UUID.randomUUID();

    when(storage.executeSparqlQuery(anyString(), eq("application/sparql-results+json")))
        .thenReturn(sparqlResponse(glossaryTermId));

    repository.getGlossaryTermGraph(glossaryId, glossaryTermId, null, 500, 0, true);

    ArgumentCaptor<String> queryCaptor = ArgumentCaptor.forClass(String.class);
    verify(storage)
        .executeSparqlQuery(queryCaptor.capture(), eq("application/sparql-results+json"));
    String query = queryCaptor.getValue();
    String glossaryTermUri = BASE_URI + "entity/glossaryTerm/" + glossaryTermId;
    String glossaryUri = BASE_URI + "entity/glossary/" + glossaryId;

    assertTrue(query.contains("VALUES ?selectedTerm { <" + glossaryTermUri + "> }"));
    assertTrue(query.contains("?selectedTerm ?candidateRelation ?term1"));
    assertTrue(query.contains("?term1 ?candidateRelation ?selectedTerm"));
    assertTrue(query.contains("?selectedTerm om:belongsToGlossary <" + glossaryUri + "> ."));
    assertTrue(query.contains("FILTER(?term1 = ?selectedTerm || ?term2 = ?selectedTerm)"));
    assertTrue(query.contains("<https://open-metadata.org/ontology/seeAlso>"));
    QueryFactory.create(query);
  }

  @Test
  void relationTypeFilterIncludesConfiguredAndFallbackPredicateUris() throws Exception {
    RdfStorageInterface storage = mock(RdfStorageInterface.class);
    RdfRepository repository = new RdfRepository(config(), storage, null);
    UUID glossaryTermId = UUID.randomUUID();

    when(storage.executeSparqlQuery(anyString(), eq("application/sparql-results+json")))
        .thenReturn(sparqlResponse(glossaryTermId));

    repository.getGlossaryTermGraph(null, glossaryTermId, "seeAlso", 500, 0, true);

    ArgumentCaptor<String> queryCaptor = ArgumentCaptor.forClass(String.class);
    verify(storage)
        .executeSparqlQuery(queryCaptor.capture(), eq("application/sparql-results+json"));
    String query = queryCaptor.getValue();

    assertTrue(query.contains("rdfs:seeAlso"));
    assertTrue(query.contains("<https://open-metadata.org/ontology/seeAlso>"));
    QueryFactory.create(query);
  }

  @Test
  void glossaryTermGraphResponseAppliesTermAndIsolatedFilters() throws Exception {
    RdfStorageInterface storage = mock(RdfStorageInterface.class);
    RdfRepository repository = new RdfRepository(config(), storage, null);
    UUID selectedId = UUID.randomUUID();
    UUID relatedId = UUID.randomUUID();
    UUID unrelatedId = UUID.randomUUID();
    UUID unrelatedTargetId = UUID.randomUUID();
    UUID isolatedId = UUID.randomUUID();

    when(storage.executeSparqlQuery(anyString(), eq("application/sparql-results+json")))
        .thenReturn(
            sparqlGraphResponse(selectedId, relatedId, unrelatedId, unrelatedTargetId, isolatedId));

    JsonNode graph =
        JsonUtils.readTree(repository.getGlossaryTermGraph(null, selectedId, null, 500, 0, false));

    Set<String> nodeIds =
        graph.get("nodes").findValues("id").stream()
            .map(JsonNode::asText)
            .collect(Collectors.toSet());

    assertEquals(Set.of(selectedId.toString(), relatedId.toString()), nodeIds);
    assertEquals(1, graph.get("edges").size());
    assertEquals(selectedId.toString(), graph.get("edges").get(0).get("from").asText());
    assertEquals(relatedId.toString(), graph.get("edges").get(0).get("to").asText());
  }

  @Test
  void glossaryTermFallbackFilterKeepsSelectedTermAndDirectNeighborsAcrossGlossaries() {
    UUID glossaryId = UUID.randomUUID();
    UUID otherGlossaryId = UUID.randomUUID();
    UUID selectedId = UUID.randomUUID();
    UUID outgoingId = UUID.randomUUID();
    UUID incomingId = UUID.randomUUID();
    UUID parentId = UUID.randomUUID();
    UUID childId = UUID.randomUUID();
    UUID unrelatedId = UUID.randomUUID();

    GlossaryTerm selectedTerm =
        term(selectedId, glossaryId)
            .withRelatedTerms(List.of(relation(outgoingId)))
            .withParent(ref(parentId))
            .withChildren(List.of(ref(childId)));
    GlossaryTerm incomingTerm =
        term(incomingId, otherGlossaryId).withRelatedTerms(List.of(relation(selectedId)));
    GlossaryTerm outgoingTerm = term(outgoingId, otherGlossaryId);
    GlossaryTerm parentTerm =
        term(parentId, otherGlossaryId).withChildren(List.of(ref(selectedId)));
    GlossaryTerm childTerm = term(childId, otherGlossaryId).withParent(ref(selectedId));
    GlossaryTerm unrelatedTerm =
        term(unrelatedId, glossaryId).withRelatedTerms(List.of(relation(outgoingId)));

    List<GlossaryTerm> filteredTerms =
        RdfRepository.filterTermsByGlossaryTermId(
            List.of(selectedTerm, incomingTerm, outgoingTerm, parentTerm, childTerm, unrelatedTerm),
            selectedId,
            glossaryId);

    assertEquals(
        Set.of(selectedId, outgoingId, incomingId, parentId, childId),
        filteredTerms.stream().map(GlossaryTerm::getId).collect(Collectors.toSet()));
    assertTrue(RdfRepository.isIncidentToGlossaryTermId(selectedId, outgoingId, selectedId));
    assertTrue(RdfRepository.isIncidentToGlossaryTermId(incomingId, selectedId, selectedId));
    assertFalse(RdfRepository.isIncidentToGlossaryTermId(incomingId, outgoingId, selectedId));
  }

  @Test
  void glossaryTermFallbackFilterRequiresSelectedTermInRequestedGlossary() {
    UUID glossaryId = UUID.randomUUID();
    UUID otherGlossaryId = UUID.randomUUID();
    UUID selectedId = UUID.randomUUID();

    List<GlossaryTerm> filteredTerms =
        RdfRepository.filterTermsByGlossaryTermId(
            List.of(term(selectedId, otherGlossaryId)), selectedId, glossaryId);

    assertTrue(filteredTerms.isEmpty());
  }

  private static RdfConfiguration config() {
    return new RdfConfiguration().withEnabled(true).withBaseUri(URI.create(BASE_URI));
  }

  private static GlossaryTerm term(UUID id, UUID glossaryId) {
    return new GlossaryTerm().withId(id).withName(id.toString()).withGlossary(ref(glossaryId));
  }

  private static EntityReference ref(UUID id) {
    return new EntityReference().withId(id);
  }

  private static TermRelation relation(UUID termId) {
    return new TermRelation().withTerm(ref(termId)).withRelationType("relatedTo");
  }

  private static String sparqlResponse(UUID glossaryTermId) {
    String glossaryTermUri = BASE_URI + "entity/glossaryTerm/" + glossaryTermId;
    return """
        {
          "head": {"vars": ["term1", "term1Name"]},
          "results": {
            "bindings": [
              {
                "term1": {"type": "uri", "value": "%s"},
                "term1Name": {"type": "literal", "value": "Customer"}
              }
            ]
          }
        }
        """
        .formatted(glossaryTermUri);
  }

  private static String sparqlGraphResponse(
      UUID selectedId, UUID relatedId, UUID unrelatedId, UUID unrelatedTargetId, UUID isolatedId) {
    return """
        {
          "head": {"vars": ["term1", "term2", "relationType", "term1Name", "term2Name"]},
          "results": {
            "bindings": [
              {
                "term1": {"type": "uri", "value": "%s"},
                "term1Name": {"type": "literal", "value": "Selected"}
              },
              {
                "term1": {"type": "uri", "value": "%s"},
                "term2": {"type": "uri", "value": "%s"},
                "relationType": {"type": "uri", "value": "https://open-metadata.org/ontology/relatedTo"},
                "term1Name": {"type": "literal", "value": "Selected"},
                "term2Name": {"type": "literal", "value": "Related"}
              },
              {
                "term1": {"type": "uri", "value": "%s"},
                "term2": {"type": "uri", "value": "%s"},
                "relationType": {"type": "uri", "value": "https://open-metadata.org/ontology/relatedTo"},
                "term1Name": {"type": "literal", "value": "Unrelated"},
                "term2Name": {"type": "literal", "value": "Unrelated Target"}
              },
              {
                "term1": {"type": "uri", "value": "%s"},
                "term1Name": {"type": "literal", "value": "Isolated"}
              }
            ]
          }
        }
        """
        .formatted(
            termUri(selectedId),
            termUri(selectedId),
            termUri(relatedId),
            termUri(unrelatedId),
            termUri(unrelatedTargetId),
            termUri(isolatedId));
  }

  private static String termUri(UUID termId) {
    return BASE_URI + "entity/glossaryTerm/" + termId;
  }
}
