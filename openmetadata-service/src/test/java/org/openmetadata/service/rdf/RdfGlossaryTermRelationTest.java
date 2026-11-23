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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.core.type.TypeReference;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.stream.Stream;
import org.apache.jena.query.Dataset;
import org.apache.jena.query.DatasetFactory;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.update.UpdateAction;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Named;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;
import org.openmetadata.service.ontology.RelationshipTypeResolver;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;

class RdfGlossaryTermRelationTest {
  private static final String API_FORWARD = "apiForward";
  private static final String API_INVERSE = "apiInverse";
  private static final String DANGLING = "danglingInverse";
  private static final String BASE = "https://open-metadata.org/";
  private static final String GRAPH = BASE + "graph/knowledge";
  private static final String RELATION_TYPES = "/json/data/ontology/relationshipTypes.json";
  private final Dataset dataset = DatasetFactory.create();
  private final Model graph = dataset.getNamedModel(GRAPH);
  private final UUID from = UUID.randomUUID();
  private final UUID to = UUID.randomUUID();
  private final List<EntityRelationshipObject> storedGlossaryRelations = new ArrayList<>();
  private RdfRepository repository;

  @BeforeEach
  void setUp() throws IOException {
    final RdfStorageInterface storage = mock(RdfStorageInterface.class);
    doAnswer(
            call -> {
              UpdateAction.parseExecute(call.getArgument(0, String.class), dataset);
              return null;
            })
        .when(storage)
        .executeSparqlUpdate(anyString());
    repository =
        new RdfRepository(
            new RdfConfiguration().withEnabled(true).withBaseUri(URI.create(BASE)),
            storage,
            null,
            resolver(),
            new RdfProjectionLoaders(
                null,
                null,
                (fromId, fromEntity, toId, toEntity, type) -> true,
                (a, b) -> List.copyOf(storedGlossaryRelations),
                null,
                (type, ids) -> Set.copyOf(ids),
                null,
                tableFqn -> {}));
  }

  @AfterEach
  void close() {
    dataset.close();
    RdfProjectionHealth.markReady();
  }

  @ParameterizedTest
  @MethodSource("deletionPerspectives")
  void removesLiveRelationFromEitherSideWithoutChangingOtherEdges(
      final RelationshipType type, final boolean removeFromTarget) {
    repository.addGlossaryTermRelation(from, UUID.randomUUID(), type.getName());
    graph.add(
        graph.createResource(termUri(from)),
        graph.createProperty("urn:unrelated-predicate"),
        graph.createResource(termUri(to)));
    final Model expected = ModelFactory.createDefaultModel().add(graph);
    try {
      storeCanonicalRelation(from, to, type);
      replay(new RdfLiveWrite.GlossaryRelationChange(from, to, type.getName(), false));
      assertEquals(expected.size() + 1, graph.size());
      final RdfLiveWrite removal = removal(type, removeFromTarget);
      replay(removal);
      replay(removal);
      assertTrue(graph.isIsomorphicWith(expected));
    } finally {
      expected.close();
    }
  }

  @ParameterizedTest
  @MethodSource("deletionPerspectives")
  void canonicalReplayProjectsWhenRowExistsAndRemovesWhenDeleted(
      final RelationshipType type, final boolean flipOrder) {
    final UUID first = flipOrder ? largerUuid() : smallerUuid();
    final UUID second = flipOrder ? smallerUuid() : largerUuid();
    storeCanonicalRelation(first, second, type);
    final RdfLiveWrite addition =
        new RdfLiveWrite.GlossaryRelationChange(first, second, type.getName(), false);

    replay(addition);
    assertEquals(1, graph.size());

    storedGlossaryRelations.clear();
    replay(addition);
    assertTrue(graph.isEmpty());
  }

  private void storeCanonicalRelation(
      final UUID source, final UUID target, final RelationshipType type) {
    final boolean swap = source.compareTo(target) > 0;
    final UUID storedFrom = swap ? target : source;
    final UUID storedTo = swap ? source : target;
    final String storedType = swap ? inverseName(type) : type.getName();
    storedGlossaryRelations.add(
        EntityRelationshipObject.builder()
            .fromId(storedFrom.toString())
            .toId(storedTo.toString())
            .fromEntity(Entity.GLOSSARY_TERM)
            .toEntity(Entity.GLOSSARY_TERM)
            .relation(Relationship.RELATED_TO.ordinal())
            .relationType(storedType)
            .build());
  }

  private static UUID smallerUuid() {
    return UUID.fromString("00000000-0000-0000-0000-000000000001");
  }

  private static UUID largerUuid() {
    return UUID.fromString("ffffffff-ffff-ffff-ffff-ffffffffffff");
  }

  @ParameterizedTest
  @MethodSource("deletionPerspectives")
  void removesBothPredicatesAndDirectionsAfterBulkProjection(
      final RelationshipType type, final boolean removeFromTarget) {
    final String inverse = inverseName(type);
    repository.bulkAddGlossaryTermRelations(
        List.of(
            new RdfRepository.GlossaryTermRelationData(from, to, type.getName()),
            new RdfRepository.GlossaryTermRelationData(to, from, type.getName()),
            new RdfRepository.GlossaryTermRelationData(from, to, inverse),
            new RdfRepository.GlossaryTermRelationData(to, from, inverse)));
    assertTrue(graph.size() >= 2);
    replay(removal(type, removeFromTarget));
    assertTrue(graph.isEmpty());
  }

  @ParameterizedTest
  @NullSource
  @ValueSource(strings = "RELATEDTO")
  void preservesDefaultAndCaseInsensitiveRemoval(final String relationType) {
    repository.addGlossaryTermRelation(from, to, "relatedTo");
    assertEquals(1, graph.size());
    replay(new RdfLiveWrite.GlossaryRelationChange(to, from, relationType, true));
    assertTrue(graph.isEmpty());
  }

  @Test
  void removesAnEdgeWhoseTypeNamesAnInverseThatDoesNotExist() {
    repository.addGlossaryTermRelation(from, to, DANGLING);
    assertEquals(1, graph.size());
    replay(new RdfLiveWrite.GlossaryRelationChange(from, to, DANGLING, true));
    assertTrue(graph.isEmpty());
  }

  private RdfLiveWrite removal(final RelationshipType type, final boolean removeFromTarget) {
    return removeFromTarget
        ? new RdfLiveWrite.GlossaryRelationChange(to, from, inverseName(type), true)
        : new RdfLiveWrite.GlossaryRelationChange(from, to, type.getName(), true);
  }

  private void replay(final RdfLiveWrite command) {
    JsonUtils.readValue(JsonUtils.pojoToJson(command), RdfLiveWrite.class).apply(repository);
  }

  private static String termUri(final UUID id) {
    return BASE + "entity/glossaryTerm/" + id;
  }

  private static String inverseName(final RelationshipType type) {
    final EntityReference inverse = type.getInverse();
    return inverse == null
        ? type.getName()
        : Objects.requireNonNullElse(inverse.getName(), inverse.getFullyQualifiedName());
  }

  private static Supplier<RelationshipTypeResolver> resolver() throws IOException {
    final List<RelationshipType> definitions = new ArrayList<>(relationshipTypes());
    definitions.add(apiType(DANGLING, "urn:custom:dangling", "neverCreated"));
    final CollectionDAO.RelationshipTypeDAO types = mock(CollectionDAO.RelationshipTypeDAO.class);
    when(types.listActive()).thenReturn(definitions.stream().map(JsonUtils::pojoToJson).toList());
    when(types.findEntityByName(anyString(), any(Include.class)))
        .thenAnswer(
            call ->
                definitions.stream()
                    .filter(type -> type.getName().equals(call.getArgument(0)))
                    .findFirst()
                    .orElseThrow(() -> new EntityNotFoundException(call.getArgument(0))));
    when(types.findEntityById(any(UUID.class), any(Include.class)))
        .thenAnswer(
            call ->
                definitions.stream()
                    .filter(type -> call.getArgument(0).equals(type.getId()))
                    .findFirst()
                    .orElseThrow(() -> new EntityNotFoundException("missing")));
    final RelationshipTypeResolver resolver = new RelationshipTypeResolver(types);
    return () -> resolver;
  }

  private static Stream<Arguments> deletionPerspectives() throws IOException {
    return relationshipTypes().stream()
        .flatMap(
            type ->
                Stream.of(
                    Arguments.of(Named.of(type.getName(), type), false),
                    Arguments.of(Named.of(type.getName(), type), true)));
  }

  private static List<RelationshipType> relationshipTypes() throws IOException {
    try (InputStream input =
        RdfGlossaryTermRelationTest.class.getResourceAsStream(RELATION_TYPES)) {
      final List<RelationshipType> types =
          new ArrayList<>(
              JsonUtils.getObjectMapper()
                  .readValue(
                      Objects.requireNonNull(input, RELATION_TYPES),
                      new TypeReference<List<RelationshipType>>() {}));
      types.add(customType("customForward", "urn:custom:forward", "customInverse"));
      types.add(customType("customInverse", "urn:custom:inverse", "customForward"));
      types.add(customType("noInverse", "urn:custom:without-inverse", null));
      types.add(apiType(API_FORWARD, "urn:custom:api-forward", API_INVERSE));
      types.add(apiType(API_INVERSE, "urn:custom:api-inverse", API_FORWARD));
      return types;
    }
  }

  private static RelationshipType customType(
      final String name, final String predicate, final String inverse) {
    return new RelationshipType()
        .withName(name)
        .withRdfPredicate(URI.create(predicate))
        .withInverse(inverse == null ? null : new EntityReference().withName(inverse));
  }

  /** A pair as the REST API stored it before #38113: the inverse names its type by id and FQN. */
  private static RelationshipType apiType(
      final String name, final String predicate, final String inverse) {
    return new RelationshipType()
        .withId(apiId(name))
        .withName(name)
        .withFullyQualifiedName(name)
        .withRdfPredicate(URI.create(predicate))
        .withInverse(
            new EntityReference()
                .withId(apiId(inverse))
                .withType("relationshipType")
                .withFullyQualifiedName(inverse));
  }

  private static UUID apiId(final String name) {
    return UUID.nameUUIDFromBytes(name.getBytes(StandardCharsets.UTF_8));
  }
}
