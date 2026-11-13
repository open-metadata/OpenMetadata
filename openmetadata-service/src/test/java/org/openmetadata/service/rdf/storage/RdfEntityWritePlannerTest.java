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

package org.openmetadata.service.rdf.storage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.apache.jena.datatypes.xsd.XSDDatatype;
import org.apache.jena.query.Dataset;
import org.apache.jena.query.DatasetFactory;
import org.apache.jena.query.QueryExecution;
import org.apache.jena.query.QueryExecutionFactory;
import org.apache.jena.rdf.model.Literal;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.RDFList;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.rdf.model.ResourceFactory;
import org.apache.jena.rdf.model.Statement;
import org.apache.jena.update.UpdateAction;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.topic.CleanupPolicy;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.rdf.translator.JsonLdTranslator;
import org.openmetadata.service.rdf.translator.ReferenceScope;

/**
 * Runs the planned updates against an in-memory dataset with Jena's own SPARQL engine. Every
 * sequence of versions is also written through the full replacement, the write the planner
 * replaces, and both must leave the same graph.
 */
class RdfEntityWritePlannerTest {
  private static final String BASE = "https://open-metadata.org/";
  private static final String OM = BASE + "ontology/";
  private static final String GRAPH = BASE + "graph/knowledge";
  private static final String TABLE_FQN = "service.db.schema.orders";
  private static final UUID TABLE_ID = UUID.fromString("00000000-0000-0000-0000-0000000000a1");
  private static final String TABLE_URI = BASE + "entity/table/" + TABLE_ID;
  private static final UUID TOPIC_ID = UUID.fromString("00000000-0000-0000-0000-0000000000b2");
  private static final String TOPIC_URI = BASE + "entity/topic/" + TOPIC_ID;
  private static final String CLEANUP_POLICY = OM + "hasCleanupPolicy";

  private final JsonLdTranslator translator =
      new JsonLdTranslator(
          JsonUtils.getObjectMapper(), BASE, (type, fqns) -> Map.of(), ReferenceScope.ALL);
  private final Store diff = new Store();
  private final Store replace = new Store();

  @BeforeAll
  static void registerEntityTypes() {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("table", "table");
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("topic", "topic");
  }

  @AfterEach
  void close() {
    diff.close();
    replace.close();
  }

  @Test
  void anUnchangedProjectionSendsNothing() {
    final Table table = table(List.of(column("id"), column("amount")));
    final RdfEntityWriteResult first = diff.write(TABLE_URI, translator.toRdf(table));
    assertEquals(RdfEntityWriteResult.Outcome.CHANGED_TRIPLES, first.outcome());
    assertFalse(diff.updates.getFirst().contains("DELETE"), "a new entity only inserts");

    assertEquals(RdfEntityWriteResult.UNCHANGED, diff.write(TABLE_URI, translator.toRdf(table)));
    assertEquals(1, diff.updates.size(), "the unchanged write must not reach the store");
  }

  @Test
  void aSmallEditSendsOnlyTheTriplesThatDiffer() {
    final Table table = table(List.of(column("id"), column("amount"), column("placed_at")));
    final Model before = translator.toRdf(table);
    diff.write(TABLE_URI, before);
    table.setDescription("Orders placed online");
    final Model after = translator.toRdf(table);

    final RdfEntityWriteResult result = diff.write(TABLE_URI, after);

    assertEquals(
        RdfEntityWriteResult.changedTriples(
            before.difference(after).size(), after.difference(before).size()),
        result);
    assertTrue(result.deletedTriples() + result.insertedTriples() < after.size() / 4);
    assertFalse(diff.updates.getLast().contains("WHERE"), diff.updates.getLast());
    assertTrue(diff.graph().containsAll(after));
  }

  @Test
  void successiveVersionsEndInTheGraphAFullReplacementLeaves() {
    final Table table = table(List.of());
    seedRelationships(diff);
    seedRelationships(replace);
    for (Table version : versionsOf(table)) {
      writeBoth(TABLE_URI, version);
      assertSameGraph();
      assertRelationshipsSurvive(diff.graph());
    }
  }

  @Test
  void literalsTheStoreReturnsInCanonicalFormCountAsUnchanged() {
    final Table table = table(List.of(column("id"))).withUpdatedAt(1_700_000_000_120L);
    table.setVersion(0.1);
    diff.write(TABLE_URI, translator.toRdf(table));
    rewriteStoredLexicalForm(
        "http://purl.org/dc/terms/modified", XSDDatatype.XSDdateTime, "2023-11-14T22:13:20.12Z");
    rewriteStoredLexicalForm("http://www.w3.org/ns/dcat#version", XSDDatatype.XSDdouble, "0.10");

    assertEquals(RdfEntityWriteResult.UNCHANGED, diff.write(TABLE_URI, translator.toRdf(table)));
  }

  @Test
  void listCellsAreNamedAndLeaveWithTheirList() {
    final Topic topic = topic(List.of(CleanupPolicy.DELETE, CleanupPolicy.COMPACT));
    final Model projection = translator.toRdf(topic);
    assertFalse(RdfEntityWritePlanner.hasBlankNode(projection.getGraph()));
    final RDFNode head =
        projection.getProperty(projection.createResource(TOPIC_URI), cleanupPolicy()).getObject();
    assertEquals(
        List.of("delete", "compact"),
        head.as(RDFList.class).iterator().mapWith(item -> item.asLiteral().getString()).toList());

    writeBoth(TOPIC_URI, topic);
    assertEquals(2, listCells(diff.graph()));
    writeBoth(TOPIC_URI, topic.withCleanupPolicies(List.of(CleanupPolicy.COMPACT)));
    assertSameGraph();
    assertEquals(1, listCells(diff.graph()));
    writeBoth(TOPIC_URI, topic.withCleanupPolicies(List.of()));
    assertSameGraph();
    assertTrue(
        diff.graph().contains(diff.graph().createResource(TOPIC_URI), cleanupPolicy(), RDF.nil));
    writeBoth(TOPIC_URI, topic.withCleanupPolicies(null));
    assertSameGraph();
    assertEquals(0, listCells(diff.graph()));
    assertFalse(diff.graph().contains(diff.graph().createResource(TOPIC_URI), cleanupPolicy()));
  }

  @Test
  void aListWrittenWithBlankCellsIsReplacedWithTheCellsItHeld() {
    final Topic topic = topic(List.of(CleanupPolicy.DELETE));
    final Model projection = translator.toRdf(topic);
    final Model stored = diff.graph();
    final Resource entity = stored.createResource(TOPIC_URI);
    stored.add(projection);
    stored.removeAll(entity, cleanupPolicy(), null);
    stored.removeAll(null, RDF.first, null);
    stored.removeAll(null, RDF.rest, null);
    final RDFList attached = stored.createList(stored.createLiteral("delete"));
    stored.add(entity, cleanupPolicy(), attached);
    final RDFList orphan = stored.createList(stored.createLiteral("compact"));

    final RdfEntityWriteResult result = diff.write(TOPIC_URI, projection);

    assertEquals(RdfEntityWriteResult.REPLACED, result);
    assertFalse(stored.contains(attached, RDF.first));
    assertFalse(stored.contains(entity, cleanupPolicy(), attached));
    assertTrue(stored.containsAll(projection));
    assertTrue(
        stored.contains(orphan, RDF.first),
        "cells an earlier rewrite left attached to nothing are a recreate reindex's to remove");
  }

  @Test
  void aReplacementNeitherReadsNorTrustsTheStore() {
    final Table table = table(List.of(column("id")));
    diff.write(TABLE_URI, translator.toRdf(table));
    final int reads = diff.reads.get();

    final RdfEntityWriteResult result =
        diff.write(TABLE_URI, translator.toRdf(table), RdfEntityWriteStrategy.REPLACE);

    assertEquals(RdfEntityWriteResult.REPLACED, result);
    assertEquals(reads, diff.reads.get());
    assertTrue(diff.graph().containsAll(translator.toRdf(table)));
  }

  @Test
  void aDifferenceLargerThanTheProjectionIsSentAsAReplacement() {
    final List<Column> columns = new ArrayList<>();
    for (int index = 0; index < 12; index++) {
      columns.add(column("column_" + index));
    }
    final Table table = table(columns);
    writeBoth(TABLE_URI, table);

    final RdfEntityWriteResult result =
        writeBoth(TABLE_URI, renamedTable(table, "service.db.schema.orders_v2"));

    assertEquals(RdfEntityWriteResult.REPLACED, result);
    assertSameGraph();
  }

  @Test
  void aProjectionWithABlankNodeIsReplacedWithoutReading() {
    final Model projection = ModelFactory.createDefaultModel();
    projection
        .createResource(TABLE_URI)
        .addProperty(RDFS.label, "orders")
        .addProperty(projection.createProperty(OM + "detail"), projection.createResource());

    assertEquals(RdfEntityWriteResult.REPLACED, diff.write(TABLE_URI, projection));
    assertEquals(0, diff.reads.get());
  }

  @Test
  void factsOutsideTheScopeAreCheckedInBoundedReads() {
    final Model projection = ModelFactory.createDefaultModel();
    projection.createResource(TABLE_URI).addProperty(RDFS.label, "orders");
    final int shared = RdfEntityWritePlanner.EXISTENCE_CHECK_CHUNK * 2 + 1;
    for (int index = 0; index < shared; index++) {
      projection.createResource("urn:shared:" + index).addProperty(RDFS.label, "label " + index);
    }

    // A changed write reads its scope and three chunks, then the same again to check what it left.
    diff.write(TABLE_URI, projection);
    assertEquals(8, diff.reads.get());
    assertEquals(RdfEntityWriteResult.UNCHANGED, diff.write(TABLE_URI, projection));
    assertEquals(12, diff.reads.get());
  }

  /**
   * A write already queued for TDB2's writer when the difference was read, such as a reindex chunk
   * OpenMetadata stopped waiting for or a request from a server that died, commits between the read
   * and the update. The update alone would leave that write's description next to the new one.
   */
  @Test
  void aWriteThatCommitsBetweenTheReadAndTheUpdateIsReplacedAway() {
    final Table table = table(List.of(column("id"), column("amount")));
    writeBoth(TABLE_URI, table.withDescription("old"));
    final String queuedAhead =
        JenaFusekiStorage.buildEntityUpsertUpdate(
            TABLE_URI, translator.toRdf(copy(table).withDescription("middle")));
    diff.commitAfterNextRead(queuedAhead);

    final RdfEntityWriteResult result = writeBoth(TABLE_URI, table.withDescription("latest"));

    assertEquals(RdfEntityWriteResult.CORRECTED, result);
    assertSameGraph();
  }

  @Test
  void aChangedWriteNobodyInterferedWithIsNotReplaced() {
    final Table table = table(List.of(column("id"), column("amount")));
    writeBoth(TABLE_URI, table.withDescription("old"));

    final RdfEntityWriteResult result = writeBoth(TABLE_URI, table.withDescription("latest"));

    assertEquals(RdfEntityWriteResult.Outcome.CHANGED_TRIPLES, result.outcome());
    assertEquals(2, diff.updates.size(), "only the first write and the difference were sent");
  }

  private List<Table> versionsOf(final Table table) {
    final List<Table> versions = new ArrayList<>();
    final Column customer =
        column("customer")
            .withDataType(ColumnDataType.STRUCT)
            .withChildren(
                List.of(
                    child("customer", "name"),
                    child("customer", "address")
                        .withDataType(ColumnDataType.STRUCT)
                        .withChildren(List.of(child("customer.address", "zip")))));
    versions.add(
        copy(table)
            .withDescription("Orders")
            .withColumns(List.of(column("id").withTags(List.of(tag("PII.Sensitive"))), customer))
            .withTags(List.of(tag("Tier.Tier1")))
            .withExtension(Map.of("costCenter", "finance")));
    versions.add(
        copy(table)
            .withColumns(
                List.of(
                    column("id").withTags(List.of(tag("PII.None"))),
                    column("customer")
                        .withDataType(ColumnDataType.STRUCT)
                        .withChildren(List.of(child("customer", "full_name"))),
                    column("amount")))
            .withExtension(Map.of("costCenter", "sales", "region", "eu")));
    versions.add(copy(table).withColumns(List.of()));
    versions.add(versions.getFirst());
    return versions;
  }

  private RdfEntityWriteResult writeBoth(final String uri, final EntityInterface<?> entity) {
    replace.write(uri, translator.toRdf(entity), RdfEntityWriteStrategy.REPLACE);
    return diff.write(uri, translator.toRdf(entity));
  }

  private void assertSameGraph() {
    final Model diffGraph = diff.graph();
    final Model replaceGraph = replace.graph();
    assertTrue(
        diffGraph.isIsomorphicWith(replaceGraph),
        () ->
            "only after the difference: "
                + diffGraph.difference(replaceGraph).listStatements().toList()
                + "\nonly after the replacement: "
                + replaceGraph.difference(diffGraph).listStatements().toList());
  }

  private static void seedRelationships(final Store store) {
    final Model graph = store.graph();
    final Resource table = graph.createResource(TABLE_URI);
    table.addProperty(graph.createProperty(OM + "upstream"), graph.createResource(BASE + "u"));
    table.addProperty(graph.createProperty(OM + "downstream"), graph.createResource(BASE + "d"));
    table.addProperty(graph.createProperty(OM + "contains"), graph.createResource(BASE + "c"));
    graph.createResource(BASE + "team").addProperty(graph.createProperty(OM + "owns"), table);
  }

  private static void assertRelationshipsSurvive(final Model graph) {
    final Resource table = graph.createResource(TABLE_URI);
    assertTrue(graph.contains(table, graph.createProperty(OM + "upstream")));
    assertTrue(graph.contains(table, graph.createProperty(OM + "downstream")));
    assertTrue(graph.contains(table, graph.createProperty(OM + "contains")));
    assertTrue(graph.contains(null, graph.createProperty(OM + "owns"), table));
  }

  /**
   * Rewrites the entity's well-formed {@code type} values of {@code predicate} the way TDB2 can
   * return them: the same datatype and value in another lexical form.
   */
  private void rewriteStoredLexicalForm(
      final String predicate, final XSDDatatype type, final String sameValue) {
    final Model graph = diff.graph();
    final Literal rewritten = graph.createTypedLiteral(sameValue, type);
    final List<Statement> statements =
        graph
            .listStatements(
                graph.createResource(TABLE_URI), graph.createProperty(predicate), (RDFNode) null)
            .filterKeep(statement -> statement.getObject().isLiteral())
            .filterKeep(statement -> type.getURI().equals(statement.getLiteral().getDatatypeURI()))
            .filterKeep(statement -> type.isValid(statement.getLiteral().getLexicalForm()))
            .toList();
    assertFalse(statements.isEmpty(), () -> "the projection carries no " + type + " " + predicate);
    for (Statement statement : statements) {
      final Literal stored = statement.getLiteral();
      assertNotEquals(stored.getLexicalForm(), sameValue);
      assertTrue(stored.sameValueAs(rewritten), () -> stored + " vs " + rewritten);
      graph.remove(statement);
      graph.add(statement.getSubject(), statement.getPredicate(), rewritten);
    }
  }

  private static int listCells(final Model graph) {
    return graph
        .listSubjects()
        .filterKeep(Resource::isURIResource)
        .filterKeep(subject -> subject.getURI().startsWith(TOPIC_URI + "/list/"))
        .toList()
        .size();
  }

  private static Property cleanupPolicy() {
    return ResourceFactory.createProperty(CLEANUP_POLICY);
  }

  private static Table table(final List<Column> columns) {
    return new Table()
        .withId(TABLE_ID)
        .withName("orders")
        .withFullyQualifiedName(TABLE_FQN)
        .withColumns(columns);
  }

  private static Table copy(final Table table) {
    return JsonUtils.readValue(JsonUtils.pojoToJson(table), Table.class);
  }

  private static Table renamedTable(final Table table, final String fqn) {
    final List<Column> columns = new ArrayList<>();
    for (Column column : table.getColumns()) {
      columns.add(
          new Column()
              .withName(column.getName())
              .withDataType(column.getDataType())
              .withFullyQualifiedName(fqn + "." + column.getName()));
    }
    return copy(table).withFullyQualifiedName(fqn).withColumns(columns);
  }

  private static Topic topic(final List<CleanupPolicy> policies) {
    return new Topic()
        .withId(TOPIC_ID)
        .withName("events")
        .withFullyQualifiedName("kafka.events")
        .withCleanupPolicies(policies);
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

  /** An in-memory knowledge graph that applies the planned updates as Fuseki would. */
  private static final class Store implements AutoCloseable {
    private final Dataset dataset = DatasetFactory.create();
    private final List<String> updates = new ArrayList<>();
    private final AtomicInteger reads = new AtomicInteger();
    private final RdfEntityWritePlanner planner = new RdfEntityWritePlanner(this::construct);
    private String queuedAhead;

    Model graph() {
      return dataset.getNamedModel(GRAPH);
    }

    RdfEntityWriteResult write(final String uri, final Model projection) {
      return write(uri, projection, RdfEntityWriteStrategy.DIFFERENCE);
    }

    RdfEntityWriteResult write(
        final String uri, final Model projection, final RdfEntityWriteStrategy strategy) {
      return planner.write(uri, projection, strategy, this::send);
    }

    /** Commits {@code update} after the next read, as a write queued ahead in TDB2 would. */
    void commitAfterNextRead(final String update) {
      queuedAhead = update;
    }

    private void send(final String update) {
      updates.add(update);
      UpdateAction.parseExecute(update, dataset);
    }

    private Model construct(final String query) {
      reads.incrementAndGet();
      final Model result;
      try (QueryExecution execution = QueryExecutionFactory.create(query, dataset)) {
        result = execution.execConstruct();
      }
      if (queuedAhead != null) {
        UpdateAction.parseExecute(queuedAhead, dataset);
        queuedAhead = null;
      }
      return result;
    }

    @Override
    public void close() {
      dataset.close();
    }
  }
}
