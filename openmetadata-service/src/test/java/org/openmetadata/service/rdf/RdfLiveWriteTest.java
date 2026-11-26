/*
 *  Copyright 2025 Collate
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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.net.URI;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.apache.jena.query.Dataset;
import org.apache.jena.query.DatasetFactory;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.update.UpdateAction;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityRelationship;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;
import org.openmetadata.service.jdbi3.PipelineRepository;
import org.openmetadata.service.ontology.RelationshipTypeResolver;
import org.openmetadata.service.rdf.rebuild.RdfWriteDelivery;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;
import org.openmetadata.service.rdf.translator.JsonLdTranslator;

@Isolated
class RdfLiveWriteTest {
  private static final String BASE = "https://open-metadata.org/";
  private static final String GRAPH = BASE + "graph/knowledge";
  private static final String BROADER = "http://www.w3.org/2004/02/skos/core#broader";
  private static final String NARROWER = "http://www.w3.org/2004/02/skos/core#narrower";
  private static final String SEE_ALSO = "http://www.w3.org/2000/01/rdf-schema#seeAlso";
  private static final String RELATED_TO = BASE + "ontology/relatedTo";
  private static final String RETIRED = "urn:custom:retired";
  private static final String PROV_WAS_DERIVED_FROM = "http://www.w3.org/ns/prov#wasDerivedFrom";
  private final Dataset dataset = DatasetFactory.create();
  private final AtomicBoolean unavailable = new AtomicBoolean();
  private Table currentEntity;
  private LineageDetails currentLineageDetails;
  private boolean lineageEdgeExists = true;
  private final Set<StoredRelationship> storedRelationships = new HashSet<>();
  private List<EntityRelationshipObject> glossaryRelationRows;
  private final Set<UUID> softDeleted = new HashSet<>();
  private final List<EntityReference> boundAssets = new ArrayList<>();
  private UUID unreadableAsset;
  private final List<UUID> refreshedOntologyGraphs = new ArrayList<>();
  private final OntologyActiveGraph ontologyGraphs = ontologyGraphs();
  private final RdfRepository repository = repository();

  @AfterEach
  void close() {
    dataset.close();
    RdfProjectionHealth.markReady();
  }

  @Test
  void replayReadsCurrentMetadataAndDoesNotRestoreAnObsoleteSnapshot() {
    final UUID id = UUID.randomUUID();
    final Table table =
        new Table()
            .withId(id)
            .withName("original")
            .withFullyQualifiedName("service.db.schema.original");
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("table", Entity.TABLE);
    currentEntity = table;
    final RdfLiveWrite update = RdfLiveWrite.EntityUpdate.capture(table);
    table.setName("changed");
    replay(update);
    final Model graph = dataset.getNamedModel(GRAPH);
    assertTrue(graph.contains(graph.createResource(BASE + "entity/table/" + id), null));
    assertFalse(graph.contains(null, null, "original"));
    assertTrue(graph.contains(null, null, "changed"));
    replay(new RdfLiveWrite.EntityDelete(Entity.TABLE, id));
    assertFalse(graph.contains(graph.createResource(BASE + "entity/table/" + id), null));
  }

  @Test
  void replayedGenericRelationshipAdditionAndRemovalChangeTheGraph() {
    final EntityRelationship relationship =
        new EntityRelationship()
            .withFromId(UUID.randomUUID())
            .withToId(UUID.randomUUID())
            .withFromEntity(Entity.TABLE)
            .withToEntity(Entity.TABLE)
            .withRelationshipType(Relationship.CONTAINS);
    storeRelationship(relationship);
    replay(RdfLiveWrite.RelationshipChange.capture(relationship, false));
    assertFalse(dataset.getNamedModel(GRAPH).isEmpty());
    replay(RdfLiveWrite.RelationshipChange.capture(relationship, true));
    assertTrue(dataset.getNamedModel(GRAPH).isEmpty());
  }

  @Test
  void replayedLineageProjectsTheEdgesCurrentColumnLineage() {
    final String sourceColumn = "service.db.schema.customers.email";
    final String targetColumn = "service.db.schema.contacts.email";
    final EntityRelationship lineage = lineage(UUID.randomUUID(), UUID.randomUUID());
    currentLineageDetails =
        new LineageDetails()
            .withColumnsLineage(
                List.of(
                    new ColumnLineage()
                        .withFromColumns(List.of(sourceColumn))
                        .withToColumn(targetColumn)));
    replay(RdfLiveWrite.RelationshipChange.capture(lineage, false));
    final Model graph = dataset.getNamedModel(GRAPH);
    final Property fromColumn = graph.createProperty(BASE + "ontology/fromColumn");
    final Property toColumn = graph.createProperty(BASE + "ontology/toColumn");
    assertTrue(
        graph.contains(
            null, fromColumn, graph.createResource(RdfUtils.columnUri(BASE, sourceColumn))));
    assertTrue(
        graph.contains(
            null, toColumn, graph.createResource(RdfUtils.columnUri(BASE, targetColumn))));
    replay(RdfLiveWrite.RelationshipChange.capture(lineage, true));
    assertTrue(graph.isEmpty());
  }

  @Test
  void replayedLineageWithoutStoredDetailsStillProjectsTheEdge() {
    final UUID from = UUID.randomUUID();
    final UUID to = UUID.randomUUID();
    replay(RdfLiveWrite.RelationshipChange.capture(lineage(from, to), false));
    final Model graph = dataset.getNamedModel(GRAPH);
    assertTrue(
        graph.contains(
            graph.createResource(BASE + "entity/table/" + to),
            graph.createProperty(PROV_WAS_DERIVED_FROM),
            graph.createResource(BASE + "entity/table/" + from)));
  }

  @Test
  void lineageAdditionReplayedAfterTheEdgeWasDeletedDoesNotResurrectIt() {
    final EntityRelationship lineage = lineage(UUID.randomUUID(), UUID.randomUUID());
    final RdfLiveWrite addition = RdfLiveWrite.RelationshipChange.capture(lineage, false);
    replay(addition);
    lineageEdgeExists = false;
    replay(RdfLiveWrite.RelationshipChange.capture(lineage, true));

    replay(addition);

    assertTrue(dataset.getNamedModel(GRAPH).isEmpty());
  }

  @Test
  void additionsReplayedAfterAnEndWasSoftDeletedLeaveTheEdgeOut() {
    final UUID live = UUID.randomUUID();
    final UUID deleted = UUID.randomUUID();
    softDeleted.add(deleted);
    final EntityRelationship contains =
        new EntityRelationship()
            .withFromId(live)
            .withToId(deleted)
            .withFromEntity(Entity.TABLE)
            .withToEntity(Entity.TABLE)
            .withRelationshipType(Relationship.CONTAINS);
    storeRelationship(contains);

    replay(RdfLiveWrite.RelationshipChange.capture(contains, false));
    replay(RdfLiveWrite.RelationshipChange.capture(lineage(deleted, live), false));
    replay(new RdfLiveWrite.GlossaryRelationChange(live, deleted, "broader", false));

    assertTrue(dataset.getNamedModel(GRAPH).isEmpty());
  }

  @Test
  void lineageRefreshedAfterAnEndWasSoftDeletedRemovesTheEdge() {
    final UUID from = UUID.randomUUID();
    final UUID to = UUID.randomUUID();
    final RdfLiveWrite addition = RdfLiveWrite.RelationshipChange.capture(lineage(from, to), false);
    replay(addition);
    assertFalse(dataset.getNamedModel(GRAPH).isEmpty());

    softDeleted.add(to);
    replay(addition);

    assertTrue(dataset.getNamedModel(GRAPH).isEmpty());
  }

  @Test
  void lineageDetailsLeaveOutASoftDeletedPipeline() {
    final UUID pipeline = UUID.randomUUID();
    currentLineageDetails =
        new LineageDetails()
            .withSqlQuery("insert into target select * from source")
            .withPipeline(new EntityReference().withId(pipeline).withType(Entity.PIPELINE));
    softDeleted.add(pipeline);

    replay(
        RdfLiveWrite.RelationshipChange.capture(
            lineage(UUID.randomUUID(), UUID.randomUUID()), false));

    final Model graph = dataset.getNamedModel(GRAPH);
    final Resource pipelineResource = graph.createResource(BASE + "entity/pipeline/" + pipeline);
    assertFalse(graph.isEmpty());
    assertFalse(graph.contains(pipelineResource, null, (RDFNode) null));
    assertFalse(graph.contains(null, null, pipelineResource));
  }

  @Test
  void genericRelationshipAdditionReplayedAfterTheEdgeWasDeletedDoesNotResurrectIt() {
    // Regression test for #36026: replaying an ADD after the SQL row is gone must not resurrect it.
    final EntityRelationship relationship =
        new EntityRelationship()
            .withFromId(UUID.randomUUID())
            .withToId(UUID.randomUUID())
            .withFromEntity(Entity.TABLE)
            .withToEntity(Entity.TABLE)
            .withRelationshipType(Relationship.CONTAINS);
    storeRelationship(relationship);
    final RdfLiveWrite addition = RdfLiveWrite.RelationshipChange.capture(relationship, false);
    replay(addition);
    assertFalse(dataset.getNamedModel(GRAPH).isEmpty());

    storedRelationships.clear();
    // Even if no remove command ran (e.g. bulk SQL delete), replaying ADD reconciles & removes it.
    replay(addition);
    assertTrue(dataset.getNamedModel(GRAPH).isEmpty());

    // Replaying again after an explicit removal also leaves the graph empty.
    replay(RdfLiveWrite.RelationshipChange.capture(relationship, true));
    replay(addition);
    assertTrue(dataset.getNamedModel(GRAPH).isEmpty());
  }

  @Test
  void genericRelationshipRefreshedAfterAnEndWasSoftDeletedRemovesTheEdge() {
    final UUID from = UUID.randomUUID();
    final UUID to = UUID.randomUUID();
    final EntityRelationship contains =
        new EntityRelationship()
            .withFromId(from)
            .withToId(to)
            .withFromEntity(Entity.TABLE)
            .withToEntity(Entity.TABLE)
            .withRelationshipType(Relationship.CONTAINS);
    storeRelationship(contains);
    final RdfLiveWrite addition = RdfLiveWrite.RelationshipChange.capture(contains, false);
    replay(addition);
    assertFalse(dataset.getNamedModel(GRAPH).isEmpty());

    softDeleted.add(to);
    replay(addition);

    assertTrue(dataset.getNamedModel(GRAPH).isEmpty());
  }

  @Test
  void bidirectionalRelatedToWithCanonicalReversedSqlRowProjectsBothDirections() {
    final UUID smaller = UUID.fromString("00000000-0000-0000-0000-000000000001");
    final UUID larger = UUID.fromString("ffffffff-ffff-ffff-ffff-ffffffffffff");
    // EntityRepository.addRelationship(..., true) writes one canonical SQL row (smaller -> larger)
    // and queues RDF adds in both directions (e.g. Metric.relatedMetrics).
    final EntityRelationship canonical =
        new EntityRelationship()
            .withFromId(smaller)
            .withToId(larger)
            .withFromEntity(Entity.METRIC)
            .withToEntity(Entity.METRIC)
            .withRelationshipType(Relationship.RELATED_TO);
    final EntityRelationship reversed =
        new EntityRelationship()
            .withFromId(larger)
            .withToId(smaller)
            .withFromEntity(Entity.METRIC)
            .withToEntity(Entity.METRIC)
            .withRelationshipType(Relationship.RELATED_TO);
    storeRelationship(canonical);

    final RdfLiveWrite canonicalAdd = RdfLiveWrite.RelationshipChange.capture(canonical, false);
    final RdfLiveWrite reversedAdd = RdfLiveWrite.RelationshipChange.capture(reversed, false);
    replay(canonicalAdd);
    replay(reversedAdd);

    final Model graph = dataset.getNamedModel(GRAPH);
    final Resource smallerRes = graph.createResource(BASE + "entity/metric/" + smaller);
    final Resource largerRes = graph.createResource(BASE + "entity/metric/" + larger);
    final Property relatedToProp = graph.createProperty(RELATED_TO);
    assertTrue(graph.contains(smallerRes, relatedToProp, largerRes));
    assertTrue(graph.contains(largerRes, relatedToProp, smallerRes));

    // Once the canonical SQL row is deleted, replaying either direction removes its triple.
    storedRelationships.clear();
    replay(canonicalAdd);
    replay(reversedAdd);
    assertTrue(graph.isEmpty());
  }

  @Test
  void directedAndCrossTypeRelationshipsDoNotMatchReversedSqlRows() {
    final UUID first = UUID.randomUUID();
    final UUID second = UUID.randomUUID();
    final EntityRelationship forwardContains =
        new EntityRelationship()
            .withFromId(first)
            .withToId(second)
            .withFromEntity(Entity.TABLE)
            .withToEntity(Entity.TABLE)
            .withRelationshipType(Relationship.CONTAINS);
    final EntityRelationship reverseContains =
        new EntityRelationship()
            .withFromId(second)
            .withToId(first)
            .withFromEntity(Entity.TABLE)
            .withToEntity(Entity.TABLE)
            .withRelationshipType(Relationship.CONTAINS);
    storeRelationship(forwardContains);
    final RdfLiveWrite staleForwardAdd =
        RdfLiveWrite.RelationshipChange.capture(forwardContains, false);
    replay(staleForwardAdd);

    // Replace SQL with only the reversed CONTAINS row: stale forward add must be removed, not kept.
    storedRelationships.clear();
    storeRelationship(reverseContains);
    replay(RdfLiveWrite.RelationshipChange.capture(reverseContains, false));
    replay(staleForwardAdd);

    final Model graph = dataset.getNamedModel(GRAPH);
    final Resource firstTable = graph.createResource(BASE + "entity/table/" + first);
    final Resource secondTable = graph.createResource(BASE + "entity/table/" + second);
    final Property containsProp = graph.createProperty(BASE + "ontology/contains");
    assertFalse(graph.contains(firstTable, containsProp, secondTable));
    assertTrue(graph.contains(secondTable, containsProp, firstTable));

    // Cross-type RELATED_TO is directed and must not match a reversed SQL row either.
    final EntityRelationship reverseCrossType =
        new EntityRelationship()
            .withFromId(second)
            .withToId(first)
            .withFromEntity(Entity.TABLE)
            .withToEntity(Entity.METRIC)
            .withRelationshipType(Relationship.RELATED_TO);
    final EntityRelationship forwardCrossType =
        new EntityRelationship()
            .withFromId(first)
            .withToId(second)
            .withFromEntity(Entity.METRIC)
            .withToEntity(Entity.TABLE)
            .withRelationshipType(Relationship.RELATED_TO);
    storeRelationship(reverseCrossType);
    replay(RdfLiveWrite.RelationshipChange.capture(forwardCrossType, false));
    assertFalse(
        graph.contains(
            graph.createResource(BASE + "entity/metric/" + first),
            graph.createProperty(RELATED_TO),
            secondTable));
  }

  @Test
  void directedSameTypeRelatedToReplaysOnlyTheStoredDirection() {
    final UUID first = UUID.randomUUID();
    final UUID second = UUID.randomUUID();
    final Model graph = dataset.getNamedModel(GRAPH);
    final Property relatedTo = graph.createProperty(RELATED_TO);
    for (final String directedType : List.of(Entity.TABLE, Entity.PAGE)) {
      final EntityRelationship forwardRelated =
          new EntityRelationship()
              .withFromId(first)
              .withToId(second)
              .withFromEntity(directedType)
              .withToEntity(directedType)
              .withRelationshipType(Relationship.RELATED_TO);
      final EntityRelationship reverseRelated =
          new EntityRelationship()
              .withFromId(second)
              .withToId(first)
              .withFromEntity(directedType)
              .withToEntity(directedType)
              .withRelationshipType(Relationship.RELATED_TO);
      storeRelationship(forwardRelated);
      storeRelationship(reverseRelated);
      final RdfLiveWrite staleRelatedAdd =
          RdfLiveWrite.RelationshipChange.capture(forwardRelated, false);
      replay(staleRelatedAdd);
      replay(RdfLiveWrite.RelationshipChange.capture(reverseRelated, false));

      final Resource firstResource =
          graph.createResource(BASE + "entity/" + directedType + "/" + first);
      final Resource secondResource =
          graph.createResource(BASE + "entity/" + directedType + "/" + second);
      assertTrue(graph.contains(firstResource, relatedTo, secondResource));
      assertTrue(graph.contains(secondResource, relatedTo, firstResource));

      storedRelationships.remove(
          new StoredRelationship(
              first, directedType, second, directedType, Relationship.RELATED_TO));
      replay(staleRelatedAdd);
      assertFalse(graph.contains(firstResource, relatedTo, secondResource));
      assertTrue(graph.contains(secondResource, relatedTo, firstResource));
    }
  }

  @Test
  void glossaryRelationAdditionReplayedAfterTheRelationWasDeletedDoesNotResurrectIt() {
    // Regression test for #36026: replaying a glossary ADD after SQL deletion must not resurrect.
    final UUID from = UUID.randomUUID();
    final UUID to = UUID.randomUUID();
    glossaryRelationRows = List.of(glossaryRow(from, to, "broader", null));
    final RdfLiveWrite addition =
        new RdfLiveWrite.GlossaryRelationChange(from, to, "broader", false);
    replay(addition);
    assertFalse(dataset.getNamedModel(GRAPH).isEmpty());

    glossaryRelationRows = List.of();
    replay(addition);
    assertTrue(dataset.getNamedModel(GRAPH).isEmpty());

    replay(new RdfLiveWrite.GlossaryRelationChange(from, to, "broader", true));
    replay(addition);
    assertTrue(dataset.getNamedModel(GRAPH).isEmpty());
  }

  @Test
  void glossaryRelationRefreshedAfterAnEndWasSoftDeletedRemovesTheEdge() {
    final UUID from = UUID.randomUUID();
    final UUID to = UUID.randomUUID();
    glossaryRelationRows = List.of(glossaryRow(from, to, "broader", null));
    final RdfLiveWrite addition =
        new RdfLiveWrite.GlossaryRelationChange(from, to, "broader", false);
    replay(addition);
    assertFalse(dataset.getNamedModel(GRAPH).isEmpty());

    softDeleted.add(to);
    replay(addition);

    assertTrue(dataset.getNamedModel(GRAPH).isEmpty());
  }

  @Test
  void glossaryRelationReplayedWithCanonicalReversedSqlRowProjectsBothPerspectives() {
    final UUID smaller = UUID.fromString("00000000-0000-0000-0000-000000000001");
    final UUID larger = UUID.fromString("ffffffff-ffff-ffff-ffff-ffffffffffff");
    // GlossaryTermRepository stores (larger --broader--> smaller) canonically as
    // (smaller --narrower--> larger).
    glossaryRelationRows = List.of(glossaryRow(smaller, larger, "narrower", null));

    replay(new RdfLiveWrite.GlossaryRelationChange(larger, smaller, "broader", false));
    replay(new RdfLiveWrite.GlossaryRelationChange(smaller, larger, "narrower", false));

    final Model graph = dataset.getNamedModel(GRAPH);
    assertTrue(
        graph.contains(
            graph.createResource(BASE + "entity/glossaryTerm/" + larger),
            graph.createProperty(BROADER),
            graph.createResource(BASE + "entity/glossaryTerm/" + smaller)));
    assertTrue(
        graph.contains(
            graph.createResource(BASE + "entity/glossaryTerm/" + smaller),
            graph.createProperty(NARROWER),
            graph.createResource(BASE + "entity/glossaryTerm/" + larger)));
  }

  @Test
  void replayingStaleGlossaryAddAfterDirectionFlipRemovesStaleAndPreservesLiveDirection() {
    final UUID termA = UUID.fromString("00000000-0000-0000-0000-000000000001");
    final UUID termB = UUID.fromString("ffffffff-ffff-ffff-ffff-ffffffffffff");
    final RdfLiveWrite staleAdd =
        new RdfLiveWrite.GlossaryRelationChange(termA, termB, "broader", false);
    final RdfLiveWrite liveAdd =
        new RdfLiveWrite.GlossaryRelationChange(termB, termA, "broader", false);

    // Initially termA --broader--> termB was projected.
    glossaryRelationRows = List.of(glossaryRow(termA, termB, "broader", null));
    replay(staleAdd);

    // User flips direction to termB --broader--> termA (stored canonically as termA narrower
    // termB).
    glossaryRelationRows = List.of(glossaryRow(termA, termB, "narrower", null));
    replay(liveAdd);

    // Delayed replay of the old termA --broader--> termB add removes only the stale direction.
    replay(staleAdd);

    final Model graph = dataset.getNamedModel(GRAPH);
    final Resource resourceA = graph.createResource(BASE + "entity/glossaryTerm/" + termA);
    final Resource resourceB = graph.createResource(BASE + "entity/glossaryTerm/" + termB);
    assertFalse(graph.contains(resourceA, graph.createProperty(BROADER), resourceB));
    assertFalse(graph.contains(resourceB, graph.createProperty(NARROWER), resourceA));
    assertTrue(graph.contains(resourceB, graph.createProperty(BROADER), resourceA));
  }

  @Test
  void replayingDeletedGlossaryRelationPreservesOtherRelationTypesBetweenSameTerms() {
    final UUID from = UUID.randomUUID();
    final UUID to = UUID.randomUUID();
    glossaryRelationRows =
        List.of(glossaryRow(from, to, "broader", null), glossaryRow(from, to, "seeAlso", null));
    final RdfLiveWrite broaderAdd =
        new RdfLiveWrite.GlossaryRelationChange(from, to, "broader", false);
    replay(broaderAdd);
    replay(new RdfLiveWrite.GlossaryRelationChange(from, to, "seeAlso", false));

    glossaryRelationRows = List.of(glossaryRow(from, to, "seeAlso", null));
    replay(broaderAdd);

    final Model graph = dataset.getNamedModel(GRAPH);
    final Resource fromResource = graph.createResource(BASE + "entity/glossaryTerm/" + from);
    final Resource toResource = graph.createResource(BASE + "entity/glossaryTerm/" + to);
    assertFalse(graph.contains(fromResource, graph.createProperty(BROADER), toResource));
    assertTrue(graph.contains(fromResource, graph.createProperty(SEE_ALSO), toResource));
  }

  @Test
  void glossaryRelationReplaySupportsLegacyEmptyRelationTypeColumnAndDefaultRelatedTo() {
    final UUID from = UUID.randomUUID();
    final UUID to = UUID.randomUUID();
    glossaryRelationRows =
        List.of(
            glossaryRow(from, to, "", "{\"relationType\":\"broader\"}"),
            glossaryRow(to, from, "", null));

    replay(new RdfLiveWrite.GlossaryRelationChange(from, to, "broader", false));
    replay(new RdfLiveWrite.GlossaryRelationChange(from, to, null, false));

    final Model graph = dataset.getNamedModel(GRAPH);
    final Resource fromResource = graph.createResource(BASE + "entity/glossaryTerm/" + from);
    final Resource toResource = graph.createResource(BASE + "entity/glossaryTerm/" + to);
    assertTrue(graph.contains(fromResource, graph.createProperty(BROADER), toResource));
    assertTrue(graph.contains(fromResource, graph.createProperty(RELATED_TO), toResource));
  }

  @Test
  void replayingDeletedGlossaryRelationWithSoftDeletedTypeCleansUpWithoutFailing() {
    final UUID from = UUID.randomUUID();
    final UUID to = UUID.randomUUID();
    final Model graph = dataset.getNamedModel(GRAPH);
    graph.add(
        graph.createResource(BASE + "entity/glossaryTerm/" + from),
        graph.createProperty(RETIRED),
        graph.createResource(BASE + "entity/glossaryTerm/" + to));
    glossaryRelationRows = List.of();

    replay(new RdfLiveWrite.GlossaryRelationChange(from, to, "retiredType", false));

    assertTrue(graph.isEmpty());
  }

  @Test
  void replayedGlossaryRelationsPreserveTypedPredicatesAndBothDirectionRemoval() {
    final UUID from = UUID.randomUUID();
    final UUID to = UUID.randomUUID();
    replay(new RdfLiveWrite.GlossaryRelationChange(from, to, "broader", false));
    replay(new RdfLiveWrite.GlossaryRelationChange(to, from, "broader", false));
    final Model graph = dataset.getNamedModel(GRAPH);
    assertEquals(2, graph.listObjectsOfProperty(graph.createProperty(BROADER)).toList().size());
    replay(new RdfLiveWrite.GlossaryRelationChange(from, to, "broader", true));
    assertTrue(graph.isEmpty());
  }

  @ParameterizedTest
  @MethodSource("commands")
  void everyStorageFailureRemainsRetryable(final RdfLiveWrite command) {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("table", Entity.TABLE);
    currentEntity = new Table().withId(UUID.randomUUID()).withName("table");
    unavailable.set(true);
    final RuntimeException failure = assertThrows(RuntimeException.class, () -> replay(command));
    assertEquals("storage unavailable", failure.getCause().getMessage());
    assertTrue(RdfProjectionHealth.isDegraded());
  }

  @Test
  void durableFailureDoesNotLeaveAStickyMarkerAfterSuccessfulRecovery() {
    unavailable.set(true);
    final RdfLiveWrite command = new RdfLiveWrite.EntityDelete(Entity.TABLE, UUID.randomUUID());
    assertThrows(
        RuntimeException.class,
        () -> command.apply(repository.forDelivery(RdfWriteDelivery.QUEUED)));
    assertFalse(RdfProjectionHealth.isDegraded());
    RdfProjectionHealth.markDegraded();
    assertTrue(RdfProjectionHealth.isDegraded());
  }

  @Test
  void aPipelineRunIsReplayedFromItsStoredStatus() {
    final UUID pipelineId = UUID.randomUUID();
    final PipelineRepository pipelines = mock(PipelineRepository.class);
    try (MockedStatic<Entity> entity = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      entity.when(() -> Entity.getEntityRepository(Entity.PIPELINE)).thenReturn(pipelines);
      replay(new RdfLiveWrite.PipelineExecution(pipelineId, 1_793_200_000_000L));
    }
    verify(pipelines).writePipelineExecutionToRdf(repository, pipelineId, 1_793_200_000_000L);
  }

  @Test
  void anActiveReleaseChangeReplacesTheGraphAndQueuesEachBoundAssetAsItsOwnWrite()
      throws Exception {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("table", Entity.TABLE);
    final UUID ontologyId = UUID.randomUUID();
    for (int index = 0; index <= RdfProjectionLoaders.BoundAssets.PAGE_SIZE; index++) {
      boundAssets.add(new EntityReference().withType(Entity.TABLE).withId(new UUID(0, index + 1)));
    }
    unreadableAsset = new UUID(0, 2);
    final List<RdfLiveWrite> queued = new ArrayList<>();
    try (final var ignored = RdfUpdater.captureWrites(queued::addAll)) {
      replay(new RdfLiveWrite.OntologyGraph(ontologyId));
    }

    assertEquals(List.of(ontologyId), refreshedOntologyGraphs);
    assertTrue(dataset.getNamedModel(GRAPH).isEmpty(), "the release write projects no asset");
    assertEquals(
        boundAssets.stream()
            .map(asset -> (RdfLiveWrite) new RdfLiveWrite.EntityUpdate(Entity.TABLE, asset.getId()))
            .toList(),
        queued);
    for (RdfLiveWrite write : queued) {
      if (((RdfLiveWrite.EntityUpdate) write).entityId().equals(unreadableAsset)) {
        assertThrows(RuntimeException.class, () -> replay(write));
      } else {
        replay(write);
      }
    }
    final Model graph = dataset.getNamedModel(GRAPH);
    for (EntityReference asset : boundAssets) {
      assertEquals(
          !asset.getId().equals(unreadableAsset),
          graph.contains(graph.createResource(BASE + "entity/table/" + asset.getId()), null),
          () -> "asset " + asset.getId());
    }
  }

  @Test
  void replayAfterHardDeleteRemovesTheOldEntity() {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("table", Entity.TABLE);
    currentEntity = new Table().withId(UUID.randomUUID()).withName("table");
    final RdfLiveWrite update = RdfLiveWrite.EntityUpdate.capture(currentEntity);
    replay(update);
    assertFalse(dataset.getNamedModel(GRAPH).isEmpty());
    currentEntity = null;
    replay(update);
    assertTrue(dataset.getNamedModel(GRAPH).isEmpty());
  }

  private void replay(final RdfLiveWrite command) {
    final RdfLiveWrite restored =
        JsonUtils.readValue(JsonUtils.pojoToJson(command), RdfLiveWrite.class);
    assertEquals(command, restored);
    restored.apply(repository);
  }

  private RdfRepository repository() {
    final RdfStorageInterface storage = mock(RdfStorageInterface.class);
    doAnswer(
            call -> {
              requireAvailable();
              UpdateAction.parseExecute(call.getArgument(0), dataset);
              return null;
            })
        .when(storage)
        .executeSparqlUpdate(anyString());
    doAnswer(
            call -> {
              requireAvailable();
              dataset.getNamedModel(GRAPH).add((Model) call.getArgument(2));
              return null;
            })
        .when(storage)
        .storeEntity(anyString(), any(UUID.class), any(Model.class));
    final CollectionDAO.RelationshipTypeDAO types = mock(CollectionDAO.RelationshipTypeDAO.class);
    final RelationshipType broader =
        new RelationshipType()
            .withName("broader")
            .withRdfPredicate(URI.create(BROADER))
            .withInverse(new EntityReference().withName("narrower"));
    final RelationshipType narrower =
        new RelationshipType()
            .withName("narrower")
            .withRdfPredicate(URI.create(NARROWER))
            .withInverse(new EntityReference().withName("broader"));
    final RelationshipType seeAlso =
        new RelationshipType()
            .withName("seeAlso")
            .withRdfPredicate(URI.create(SEE_ALSO))
            .withInverse(new EntityReference().withName("seeAlso"));
    final RelationshipType relatedTo =
        new RelationshipType()
            .withName("relatedTo")
            .withRdfPredicate(URI.create(RELATED_TO))
            .withInverse(new EntityReference().withName("relatedTo"));
    final RelationshipType retired =
        new RelationshipType()
            .withName("retiredType")
            .withRdfPredicate(URI.create(RETIRED))
            .withDeleted(true);
    final List<RelationshipType> active = List.of(broader, narrower, seeAlso, relatedTo);
    final List<RelationshipType> all = List.of(broader, narrower, seeAlso, relatedTo, retired);
    when(types.listActive()).thenReturn(active.stream().map(JsonUtils::pojoToJson).toList());
    when(types.findEntityByName(anyString(), any(Include.class)))
        .thenAnswer(
            call -> {
              final String name = call.getArgument(0, String.class);
              final Include include = call.getArgument(1, Include.class);
              final List<RelationshipType> pool = include == Include.ALL ? all : active;
              return pool.stream()
                  .filter(type -> type.getName().equals(name))
                  .findFirst()
                  .orElseThrow(() -> new EntityNotFoundException(name));
            });
    return new RdfRepository(
        new RdfConfiguration().withEnabled(true).withBaseUri(URI.create(BASE)),
        storage,
        new JsonLdTranslator(JsonUtils.getObjectMapper(), BASE),
        () -> new RelationshipTypeResolver(types),
        new RdfProjectionLoaders(
            (type, id) -> load(id),
            (fromId, toId) ->
                lineageEdgeExists
                    ? Optional.of(new RdfProjectionLoaders.StoredLineageEdge(currentLineageDetails))
                    : Optional.empty(),
            (fromId, fromEntity, toId, toEntity, type) ->
                storedRelationships.contains(
                    new StoredRelationship(fromId, fromEntity, toId, toEntity, type)),
            (fromId, toId) ->
                glossaryRelationRows != null
                    ? glossaryRelationRows
                    : List.of(glossaryRow(fromId, toId, "broader", null)),
            () -> ontologyGraphs,
            (type, ids) ->
                ids.stream().filter(id -> !softDeleted.contains(id)).collect(Collectors.toSet()),
            (ontologyId, after, limit) ->
                boundAssets.stream()
                    .filter(asset -> asset.getId().toString().compareTo(after) > 0)
                    .limit(limit)
                    .toList(),
            tableFqn -> {}));
  }

  private void storeRelationship(final EntityRelationship relationship) {
    storedRelationships.add(
        new StoredRelationship(
            relationship.getFromId(),
            relationship.getFromEntity(),
            relationship.getToId(),
            relationship.getToEntity(),
            relationship.getRelationshipType()));
  }

  private record StoredRelationship(
      UUID fromId, String fromEntity, UUID toId, String toEntity, Relationship type) {}

  private static EntityRelationshipObject glossaryRow(
      final UUID fromId, final UUID toId, final String relationType, final String json) {
    return EntityRelationshipObject.builder()
        .fromId(fromId.toString())
        .toId(toId.toString())
        .fromEntity(Entity.GLOSSARY_TERM)
        .toEntity(Entity.GLOSSARY_TERM)
        .relation(Relationship.RELATED_TO.ordinal())
        .relationType(relationType)
        .json(json)
        .build();
  }

  private EntityInterface<?> load(final UUID id) {
    if (id.equals(unreadableAsset)) {
      throw new IllegalStateException("asset " + id + " cannot be read");
    }
    final boolean bound = boundAssets.stream().anyMatch(asset -> asset.getId().equals(id));
    if (!bound && currentEntity == null) {
      throw new EntityNotFoundException("Entity was hard deleted");
    }
    return bound ? new Table().withId(id).withName("bound" + id) : currentEntity;
  }

  private OntologyActiveGraph ontologyGraphs() {
    final OntologyActiveGraph graphs = mock(OntologyActiveGraph.class);
    doAnswer(call -> refreshedOntologyGraphs.add(call.getArgument(0)))
        .when(graphs)
        .refresh(any(UUID.class), any(RdfStorageInterface.class));
    return graphs;
  }

  private static EntityRelationship lineage(final UUID fromId, final UUID toId) {
    return new EntityRelationship()
        .withFromId(fromId)
        .withToId(toId)
        .withFromEntity(Entity.TABLE)
        .withToEntity(Entity.TABLE)
        .withRelationshipType(Relationship.UPSTREAM);
  }

  private void requireAvailable() {
    if (unavailable.get()) {
      throw new IllegalStateException("storage unavailable");
    }
  }

  private static Stream<Arguments> commands() {
    final UUID from = UUID.randomUUID();
    final UUID to = UUID.randomUUID();
    final EntityRelationship relationship =
        new EntityRelationship()
            .withFromId(from)
            .withToId(to)
            .withFromEntity(Entity.TABLE)
            .withToEntity(Entity.TABLE)
            .withRelationshipType(Relationship.CONTAINS);
    return Stream.of(
        Arguments.of(new RdfLiveWrite.EntityUpdate(Entity.TABLE, from)),
        Arguments.of(new RdfLiveWrite.EntityDelete(Entity.TABLE, from)),
        Arguments.of(RdfLiveWrite.RelationshipChange.capture(relationship, false)),
        Arguments.of(RdfLiveWrite.RelationshipChange.capture(relationship, true)),
        Arguments.of(RdfLiveWrite.RelationshipChange.capture(lineage(from, to), false)),
        Arguments.of(RdfLiveWrite.RelationshipChange.capture(lineage(from, to), true)),
        Arguments.of(new RdfLiveWrite.GlossaryRelationChange(from, to, "broader", false)),
        Arguments.of(new RdfLiveWrite.GlossaryRelationChange(from, to, "broader", true)));
  }
}
