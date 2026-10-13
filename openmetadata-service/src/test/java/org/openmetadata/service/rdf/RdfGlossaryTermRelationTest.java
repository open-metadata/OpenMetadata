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
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.core.type.TypeReference;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
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
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.ontology.RelationshipTypeResolver;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;

class RdfGlossaryTermRelationTest {
  private static final String BASE = "https://open-metadata.org/";
  private static final String GRAPH = BASE + "graph/knowledge";
  private static final String RELATION_TYPES = "/json/data/ontology/relationshipTypes.json";
  private final Dataset dataset = DatasetFactory.create();
  private final Model graph = dataset.getNamedModel(GRAPH);
  private final UUID from = UUID.randomUUID();
  private final UUID to = UUID.randomUUID();
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
            resolver());
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
    return type.getInverse() == null ? type.getName() : type.getInverse().getName();
  }

  private static Supplier<RelationshipTypeResolver> resolver() throws IOException {
    final List<RelationshipType> definitions = relationshipTypes();
    final CollectionDAO.RelationshipTypeDAO types = mock(CollectionDAO.RelationshipTypeDAO.class);
    when(types.listActive()).thenReturn(definitions.stream().map(JsonUtils::pojoToJson).toList());
    when(types.findEntityByName(anyString(), eq(Include.NON_DELETED)))
        .thenAnswer(
            call ->
                definitions.stream()
                    .filter(type -> type.getName().equals(call.getArgument(0)))
                    .findFirst()
                    .orElseThrow());
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
}
