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
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.io.StringReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.FusekiTestImage;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ColumnProfile;
import org.openmetadata.schema.type.TableConstraint;
import org.openmetadata.schema.type.TableConstraint.ConstraintType;
import org.openmetadata.schema.type.TableProfile;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.topic.CleanupPolicy;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.rdf.storage.JenaFusekiStorage;
import org.openmetadata.service.rdf.storage.RdfEntityWriteResult;
import org.openmetadata.service.rdf.storage.RdfEntityWriteStrategy;
import org.openmetadata.service.rdf.storage.RdfStorageInterface.EntityWriteRequest;
import org.openmetadata.service.rdf.translator.JsonLdTranslator;
import org.openmetadata.service.rdf.translator.ReferenceScope;
import org.testcontainers.containers.GenericContainer;

/**
 * Live entity writes against TDB2 in the published Fuseki image. Each sequence is written twice,
 * applying differences to one dataset and replacing the projection whole in the other, and both
 * must hold the same graph. Fuseki's own request statistics prove what reached the store.
 */
@Tag("rdf")
@EnabledIfSystemProperty(named = "enableRdf", matches = "true")
@Execution(ExecutionMode.SAME_THREAD)
public class RdfEntityDiffWriteIT {
  private static final String BASE = "https://open-metadata.org/";
  private static final String OM = BASE + "ontology/";
  private static final String GRAPH = BASE + "graph/knowledge";
  private static final String DIFF_DATASET = "openmetadata_a";
  private static final String REPLACE_DATASET = "openmetadata_b";
  private static final String TABLE_FQN = "service.db.schema.wide_orders";
  private static final UUID TABLE_ID = UUID.fromString("00000000-0000-0000-0000-00000000d1ff");
  private static final String TABLE_URI = BASE + "entity/table/" + TABLE_ID;
  private static final UUID TOPIC_ID = UUID.fromString("00000000-0000-0000-0000-00000000d2ff");
  private static final String TOPIC_URI = BASE + "entity/topic/" + TOPIC_ID;
  private static final int WIDE_COLUMNS = 200;
  private static final String TABLE = "table";
  private static final String TOPIC = "topic";

  private static GenericContainer<?> fuseki;
  private static String endpoint;
  private static JenaFusekiStorage diff;
  private static JenaFusekiStorage replace;
  private final JsonLdTranslator translator =
      new JsonLdTranslator(
          JsonUtils.getObjectMapper(), BASE, (type, fqns) -> Map.of(), ReferenceScope.ALL);

  @BeforeAll
  static void startFuseki() {
    // Its own server: the request statistics must count this class's writes only.
    fuseki = FusekiTestImage.forOpenMetadata("-Xms512m -Xmx1g");
    fuseki.start();
    endpoint = FusekiTestImage.serverUrl(fuseki);
    diff = storage(DIFF_DATASET);
    replace = storage(REPLACE_DATASET);
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put(TABLE, TABLE);
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put(TOPIC, TOPIC);
  }

  @AfterAll
  static void stopFuseki() {
    if (diff != null) {
      diff.close();
    }
    if (replace != null) {
      replace.close();
    }
    if (fuseki != null) {
      fuseki.close();
    }
  }

  @BeforeEach
  void clearGraphs() {
    diff.clearGraph(GRAPH);
    replace.clearGraph(GRAPH);
  }

  @Test
  void aSecondDeliveryOfAnUnchangedProjectionSendsNoUpdate() throws Exception {
    final Table table = wideTable();
    final long before = updateRequests(DIFF_DATASET);

    final RdfEntityWriteResult first = diff.storeEntity(TABLE, TABLE_ID, translator.toRdf(table));
    final RdfEntityWriteResult second = diff.storeEntity(TABLE, TABLE_ID, translator.toRdf(table));

    assertEquals(RdfEntityWriteResult.Outcome.CHANGED_TRIPLES, first.outcome());
    assertEquals(
        RdfEntityWriteResult.UNCHANGED,
        second,
        "the projection TDB2 returns, canonical literals included, must read as unchanged");
    assertEquals(before + 1, updateRequests(DIFF_DATASET));
  }

  @Test
  void oneTagChangeOnAWideTableWritesOnlyItsTriples() throws Exception {
    final Table table = wideTable();
    writeBoth(TABLE, table);
    final Column tagged = table.getColumns().get(10);
    assertEquals("PII.Sensitive", tagged.getTags().getFirst().getTagFQN());
    tagged.setTags(List.of(tag("PII.None")));
    final Model projection = translator.toRdf(table);
    final long before = updateRequests(DIFF_DATASET);

    final RdfEntityWriteResult result = writeBoth(TABLE, table);

    assertEquals(RdfEntityWriteResult.Outcome.CHANGED_TRIPLES, result.outcome());
    assertEquals(1, result.deletedTriples(), "only the column's link to the removed tag goes");
    assertTrue(
        result.deletedTriples() + result.insertedTriples() < projection.size() / 50,
        () -> result + " for a projection of " + projection.size() + " triples");
    assertEquals(before + 1, updateRequests(DIFF_DATASET));
    assertSameGraph();
  }

  @Test
  void additionsRemovalsAndNestedColumnsEndInTheGraphAReplacementLeaves() {
    seedRelationships(diff);
    seedRelationships(replace);
    for (Table version : tableVersions()) {
      writeBoth(TABLE, version);
      assertSameGraph();
      assertRelationshipsSurvive();
    }
  }

  @Test
  void listsMatchAReplacementAsTheyGrowShrinkAndDisappear() {
    final Topic topic =
        new Topic()
            .withId(TOPIC_ID)
            .withName("events")
            .withFullyQualifiedName("kafka.events")
            .withCleanupPolicies(List.of(CleanupPolicy.DELETE, CleanupPolicy.COMPACT));
    writeBoth(TOPIC, topic);
    assertSameGraph();
    writeBoth(TOPIC, topic.withCleanupPolicies(List.of(CleanupPolicy.COMPACT)));
    assertSameGraph();
    writeBoth(TOPIC, topic.withCleanupPolicies(null));
    assertSameGraph();
    assertFalse(
        graph(diff).listSubjects().toList().stream()
            .anyMatch(subject -> subject.isURIResource() && subject.getURI().contains("/list/")));
  }

  @Test
  void aListStoredWithBlankCellsIsReplacedWithTheCellsItHeld() {
    final Topic topic =
        new Topic()
            .withId(TOPIC_ID)
            .withName("events")
            .withFullyQualifiedName("kafka.events")
            .withCleanupPolicies(List.of(CleanupPolicy.DELETE));
    diff.executeSparqlUpdate(
        "INSERT DATA { GRAPH <"
            + GRAPH
            + "> { <"
            + TOPIC_URI
            + "> <"
            + OM
            + "hasCleanupPolicy> _:cell . _:cell <http://www.w3.org/1999/02/22-rdf-syntax-ns#first>"
            + " \"delete\" ; <http://www.w3.org/1999/02/22-rdf-syntax-ns#rest>"
            + " <http://www.w3.org/1999/02/22-rdf-syntax-ns#nil> } }");

    final RdfEntityWriteResult result = diff.storeEntity(TOPIC, TOPIC_ID, translator.toRdf(topic));
    replace.storeEntity(TOPIC, TOPIC_ID, translator.toRdf(topic), RdfEntityWriteStrategy.REPLACE);

    assertEquals(RdfEntityWriteResult.REPLACED, result);
    assertSameGraph();
  }

  @Test
  void profileCorrectionsAndRemovalsLeaveOnlyTheCurrentProjection() {
    final Column nested =
        child("customer", "id")
            .withProfile(new ColumnProfile().withTimestamp(1000L).withNullCount(12.0));
    final Table table =
        wideTable()
            .withColumns(List.of(column("customer").withChildren(List.of(nested))))
            .withTags(List.of())
            .withProfile(new TableProfile().withTimestamp(1000L).withRowCount(100.0));
    writeBoth(TABLE, table);

    table.getProfile().setRowCount(101.0);
    nested.getProfile().setNullCount(0.0);
    assertEquals(RdfEntityWriteResult.Outcome.CHANGED_TRIPLES, writeBoth(TABLE, table).outcome());
    assertSameGraph();
    assertTrue(graph(diff).isIsomorphicWith(translator.toRdf(table)));
    assertEquals(
        RdfEntityWriteResult.UNCHANGED, diff.storeEntity(TABLE, TABLE_ID, translator.toRdf(table)));

    table.getProfile().setTimestamp(2000L);
    nested.getProfile().setTimestamp(2000L);
    writeBoth(TABLE, table);
    assertSameGraph();
    assertTrue(graph(diff).isIsomorphicWith(translator.toRdf(table)));

    table.setProfile(null);
    nested.setProfile(null);
    writeBoth(TABLE, table);
    assertSameGraph();
    assertTrue(graph(diff).isIsomorphicWith(translator.toRdf(table)));

    table.setColumns(List.of());
    writeBoth(TABLE, table);
    assertSameGraph();
    assertTrue(graph(diff).isIsomorphicWith(translator.toRdf(table)));
  }

  @Test
  void constraintChangesReplaceMembersAndColumnUniqueness() {
    final TableConstraint primaryKey =
        new TableConstraint()
            .withConstraintType(ConstraintType.PRIMARY_KEY)
            .withColumns(List.of("id", "tenant_id"));
    final Table table =
        wideTable()
            .withColumns(List.of(column("id"), column("tenant_id")))
            .withTags(List.of())
            .withTableConstraints(
                List.of(
                    primaryKey,
                    new TableConstraint()
                        .withConstraintType(ConstraintType.UNIQUE)
                        .withColumns(List.of("id"))));
    writeBoth(TABLE, table);
    assertSameGraph();
    final Model composite = graph(diff);
    assertEquals(
        1,
        composite.listObjectsOfProperty(composite.createProperty(OM + "isUnique")).toList().size());
    assertTrue(graph(diff).isIsomorphicWith(translator.toRdf(table)));

    primaryKey.setColumns(List.of("tenant_id"));
    table.setTableConstraints(List.of(primaryKey));
    writeBoth(TABLE, table);
    assertSameGraph();
    assertTrue(graph(diff).isIsomorphicWith(translator.toRdf(table)));

    table.setTableConstraints(List.of());
    writeBoth(TABLE, table);
    assertSameGraph();
    assertTrue(graph(diff).isIsomorphicWith(translator.toRdf(table)));
  }

  @Test
  void bulkReindexAndDeletionRemoveOwnedProfilesAndConstraints() {
    final Table table =
        wideTable()
            .withColumns(List.of(column("id").withProfile(new ColumnProfile().withNullCount(2.0))))
            .withTags(List.of())
            .withProfile(new TableProfile().withRowCount(100.0))
            .withTableConstraints(
                List.of(
                    new TableConstraint()
                        .withConstraintType(ConstraintType.UNIQUE)
                        .withColumns(List.of("id"))));
    final Model original = translator.toRdf(table);
    diff.storeEntity(TABLE, TABLE_ID, original);

    table.setProfile(null);
    table.getColumns().getFirst().setProfile(null);
    table.setTableConstraints(null);
    final Model current = translator.toRdf(table);
    diff.bulkStoreEntities(List.of(new EntityWriteRequest(TABLE, TABLE_ID, current)));
    assertTrue(graph(diff).isIsomorphicWith(current));

    diff.storeEntity(TABLE, TABLE_ID, original);
    diff.deleteEntity(TABLE, TABLE_ID);
    assertTrue(graph(diff).isEmpty());
  }

  private RdfEntityWriteResult writeBoth(final String type, final EntityInterface<?> entity) {
    replace.storeEntity(
        type, entity.getId(), translator.toRdf(entity), RdfEntityWriteStrategy.REPLACE);
    return diff.storeEntity(type, entity.getId(), translator.toRdf(entity));
  }

  private static void assertSameGraph() {
    final Model diffGraph = graph(diff);
    final Model replaceGraph = graph(replace);
    assertTrue(
        diffGraph.isIsomorphicWith(replaceGraph),
        () ->
            "only after the difference: "
                + diffGraph.difference(replaceGraph).listStatements().toList()
                + "\nonly after the replacement: "
                + replaceGraph.difference(diffGraph).listStatements().toList());
  }

  private static Model graph(final JenaFusekiStorage storage) {
    final String triples =
        storage.executeSparqlQuery(
            "CONSTRUCT { ?s ?p ?o } WHERE { GRAPH <" + GRAPH + "> { ?s ?p ?o } }", "ntriples");
    return ModelFactory.createDefaultModel().read(new StringReader(triples), null, "N-TRIPLES");
  }

  private static void seedRelationships(final JenaFusekiStorage storage) {
    storage.executeSparqlUpdate(
        "INSERT DATA { GRAPH <"
            + GRAPH
            + "> { <"
            + TABLE_URI
            + "> <"
            + OM
            + "upstream> <"
            + BASE
            + "entity/table/upstream> . <"
            + TABLE_URI
            + "> <"
            + OM
            + "downstream> <"
            + BASE
            + "entity/table/downstream> . <"
            + TABLE_URI
            + "> <"
            + OM
            + "contains> <"
            + BASE
            + "entity/table/child> . <"
            + BASE
            + "entity/team/owner> <"
            + OM
            + "owns> <"
            + TABLE_URI
            + "> } }");
  }

  private static void assertRelationshipsSurvive() {
    final String ask =
        "ASK { GRAPH <"
            + GRAPH
            + "> { <"
            + TABLE_URI
            + "> <"
            + OM
            + "upstream> ?u ; <"
            + OM
            + "downstream> ?d ; <"
            + OM
            + "contains> ?c . ?team <"
            + OM
            + "owns> <"
            + TABLE_URI
            + "> } }";
    assertTrue(diff.executeSparqlQuery(ask, "json").contains("true"));
  }

  /** SPARQL Update requests Fuseki received for {@code dataset}, from its statistics endpoint. */
  private static long updateRequests(final String dataset)
      throws IOException, InterruptedException {
    final HttpResponse<String> response =
        HttpClient.newHttpClient()
            .send(
                HttpRequest.newBuilder(URI.create(endpoint + "/$/stats/" + dataset))
                    .header("Authorization", FusekiTestImage.adminAuthorization())
                    .GET()
                    .build(),
                HttpResponse.BodyHandlers.ofString());
    assertEquals(200, response.statusCode(), response.body());
    long requests = 0;
    boolean found = false;
    for (JsonNode service :
        JsonUtils.readTree(response.body())
            .path("datasets")
            .path("/" + dataset)
            .path("endpoints")) {
      if ("update".equalsIgnoreCase(service.path("operation").asText())) {
        requests += service.path("Requests").asLong();
        found = true;
      }
    }
    assertTrue(found, () -> "no SPARQL Update endpoint in " + response.body());
    return requests;
  }

  private static JenaFusekiStorage storage(final String dataset) {
    return new JenaFusekiStorage(
        new RdfConfiguration()
            .withEnabled(true)
            .withStorageType(RdfConfiguration.StorageType.FUSEKI)
            .withBaseUri(URI.create(BASE))
            .withRemoteEndpoint(URI.create(endpoint + "/" + dataset))
            .withUsername(FusekiTestImage.ADMIN_USER)
            .withPassword(FusekiTestImage.ADMIN_PASSWORD)
            .withWriteMaxRetries(0));
  }

  private static Table wideTable() {
    final List<Column> columns = new ArrayList<>();
    for (int index = 0; index < WIDE_COLUMNS; index++) {
      final Column column =
          column("column_" + index)
              .withOrdinalPosition(index)
              .withDescription("Column " + index + " of the wide table");
      if (index % 10 == 0) {
        column.setTags(List.of(tag("PII.Sensitive")));
      }
      columns.add(column);
    }
    final Table table =
        new Table()
            .withId(TABLE_ID)
            .withName("wide_orders")
            .withFullyQualifiedName(TABLE_FQN)
            .withDescription("Every order, one column per attribute")
            .withUpdatedAt(1_700_000_000_120L)
            .withTags(List.of(tag("Tier.Tier1")))
            .withColumns(columns);
    table.setVersion(0.1);
    return table;
  }

  private static List<Table> tableVersions() {
    final Column customer =
        column("customer")
            .withDataType(ColumnDataType.STRUCT)
            .withChildren(
                List.of(
                    child("customer", "name"),
                    child("customer", "address")
                        .withDataType(ColumnDataType.STRUCT)
                        .withChildren(List.of(child("customer.address", "zip")))));
    final Table first =
        new Table()
            .withId(TABLE_ID)
            .withName("wide_orders")
            .withFullyQualifiedName(TABLE_FQN)
            .withDescription("Orders")
            .withUpdatedAt(1_700_000_000_120L)
            .withTags(List.of(tag("Tier.Tier1")))
            .withExtension(Map.of("costCenter", "finance", "retentionDays", 30))
            .withColumns(List.of(column("id").withTags(List.of(tag("PII.Sensitive"))), customer));
    final Table second =
        new Table()
            .withId(TABLE_ID)
            .withName("wide_orders")
            .withFullyQualifiedName(TABLE_FQN)
            .withUpdatedAt(1_700_000_000_500L)
            .withExtension(Map.of("costCenter", "sales"))
            .withColumns(
                List.of(
                    column("id").withTags(List.of(tag("PII.None"))),
                    column("customer")
                        .withDataType(ColumnDataType.STRUCT)
                        .withChildren(List.of(child("customer", "full_name"))),
                    column("amount")));
    final Table emptied =
        new Table()
            .withId(TABLE_ID)
            .withName("wide_orders")
            .withFullyQualifiedName(TABLE_FQN)
            .withColumns(List.of());
    return List.of(first, second, emptied, first);
  }

  private static Column column(final String name) {
    return new Column()
        .withName(name)
        .withDataType(ColumnDataType.INT)
        .withFullyQualifiedName(TABLE_FQN + "." + name);
  }

  private static Column child(final String parentPath, final String name) {
    return new Column()
        .withName(name)
        .withDataType(ColumnDataType.STRING)
        .withFullyQualifiedName(TABLE_FQN + "." + parentPath + "." + name);
  }

  private static TagLabel tag(final String fqn) {
    return new TagLabel()
        .withTagFQN(fqn)
        .withName(fqn.substring(fqn.indexOf('.') + 1))
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }
}
