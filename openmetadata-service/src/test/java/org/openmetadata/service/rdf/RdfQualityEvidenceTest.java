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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.openmetadata.service.rdf.RdfQualityFixtures.BASE;
import static org.openmetadata.service.rdf.RdfQualityFixtures.GRAPH;
import static org.openmetadata.service.rdf.RdfQualityFixtures.OM;
import static org.openmetadata.service.rdf.RdfQualityFixtures.PROFILED_AT;
import static org.openmetadata.service.rdf.RdfQualityFixtures.TABLE_FQN;
import static org.openmetadata.service.rdf.RdfQualityFixtures.TABLE_ID;
import static org.openmetadata.service.rdf.RdfQualityFixtures.TABLE_URI;
import static org.openmetadata.service.rdf.RdfQualityFixtures.TEST_ID;
import static org.openmetadata.service.rdf.RdfQualityFixtures.TEST_URI;
import static org.openmetadata.service.rdf.RdfQualityFixtures.assignedIncident;
import static org.openmetadata.service.rdf.RdfQualityFixtures.clearProfiles;
import static org.openmetadata.service.rdf.RdfQualityFixtures.column;
import static org.openmetadata.service.rdf.RdfQualityFixtures.columnTest;
import static org.openmetadata.service.rdf.RdfQualityFixtures.failedResult;
import static org.openmetadata.service.rdf.RdfQualityFixtures.nestedColumn;
import static org.openmetadata.service.rdf.RdfQualityFixtures.objects;
import static org.openmetadata.service.rdf.RdfQualityFixtures.profileFacts;
import static org.openmetadata.service.rdf.RdfQualityFixtures.profiledTable;
import static org.openmetadata.service.rdf.RdfQualityFixtures.sensitive;

import java.io.ByteArrayOutputStream;
import java.math.BigInteger;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.BiFunction;
import org.apache.jena.datatypes.xsd.XSDDatatype;
import org.apache.jena.query.Dataset;
import org.apache.jena.query.DatasetFactory;
import org.apache.jena.query.QueryExecution;
import org.apache.jena.query.QueryExecutionFactory;
import org.apache.jena.query.ResultSetFormatter;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.update.UpdateAction;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnProfile;
import org.openmetadata.schema.type.TableConstraint;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.rdf.RdfQualityFixtures.FakeEvidence;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;
import org.openmetadata.service.rdf.translator.JsonLdTranslator;
import org.openmetadata.service.rdf.translator.ReferenceScope;

/** How the latest profiles, results and incidents reach entities before they are projected. */
@Isolated
class RdfQualityEvidenceTest {
  private final JsonLdTranslator translator =
      new JsonLdTranslator(
          JsonUtils.getObjectMapper(),
          BASE,
          (type, fqns) ->
              "table".equals(type) && fqns.contains(TABLE_FQN)
                  ? Map.of(TABLE_FQN, TABLE_ID)
                  : Map.of(),
          ReferenceScope.ALL);
  private final Dataset dataset = DatasetFactory.create();
  private final List<String> requeuedTables = new ArrayList<>();
  private boolean failColumnTagRead;

  @BeforeAll
  static void registerEntityTypes() {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("table", "table");
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("testcase", "testCase");
  }

  @AfterEach
  void close() {
    RdfProjectionHealth.markReady();
    dataset.close();
  }

  @Test
  void theLatestStoredProfilesAreAttachedToTheTableAndItsNestedColumnsInOneRead() {
    final Table table = profiledTable(100.0, 4.0);
    final FakeEvidence evidence = FakeEvidence.storing(table);
    final Column zip = nestedColumn("status", "zip");
    table.getColumns().getLast().withChildren(List.of(zip));
    evidence.columnProfiles.put(
        zip.getFullyQualifiedName(), new ColumnProfile().withNullCount(7.0));
    clearProfiles(table);

    new RdfQualityEvidence(evidence).attach("table", List.of(table));

    assertEquals(100.0, table.getProfile().getRowCount());
    assertEquals(4.0, table.getColumns().getFirst().getProfile().getNullCount());
    assertEquals(7.0, zip.getProfile().getNullCount());
    assertEquals(
        List.of(List.of(TABLE_FQN + ".amount", TABLE_FQN + ".status", zip.getFullyQualifiedName())),
        evidence.columnReads);
  }

  @Test
  void maskingReadsTheStoredColumnTagsEvenWhenTheTableWasLoadedWithoutThem() {
    final Table table = profiledTable(100.0, 4.0);
    final FakeEvidence evidence = FakeEvidence.storing(table);
    final Column ssn = nestedColumn("status", "ssn");
    evidence.columnProfiles.put(
        ssn.getFullyQualifiedName(), new ColumnProfile().withNullCount(1.0));
    table.getColumns().getLast().withChildren(List.of(ssn));
    evidence.columnTags.put(TABLE_FQN + ".amount", List.of(sensitive()));
    evidence.columnTags.put(TABLE_FQN + ".status", List.of(sensitive()));
    clearProfiles(table);

    new RdfQualityEvidence(evidence).attach("table", List.of(table));

    assertNull(table.getColumns().getFirst().getProfile());
    assertNull(table.getColumns().getLast().getProfile());
    assertNull(ssn.getProfile());
    assertEquals(
        List.of(), table.getColumns().getFirst().getTags(), "the entity's tags are untouched");
    assertEquals(List.of(), evidence.columnReads.stream().flatMap(List::stream).toList());
    assertEquals(100.0, table.getProfile().getRowCount());
  }

  @Test
  void aNewProfileLeavesOnlyItsValuesInTheGraphAfterTheLiveRefresh() {
    final Table stored = profiledTable(100.0, 4.0);
    final FakeEvidence evidence = FakeEvidence.storing(stored);
    final RdfRepository repository = liveRepository(evidence, stored);

    repository.refreshEntity("table", TABLE_ID);
    final Table corrected = profiledTable(250.0, 9.0);
    evidence.tableProfiles.put(TABLE_FQN, corrected.getProfile());
    evidence.columnProfiles.put(
        TABLE_FQN + ".amount", corrected.getColumns().getFirst().getProfile());
    repository.refreshEntity("table", TABLE_ID);

    final Model graph = dataset.getNamedModel(GRAPH);
    assertEquals(
        "250.0", profileFacts(graph, graph.createResource(TABLE_URI)).get("profileRowCount"));
    assertEquals("9.0", profileFacts(graph, column(graph, "amount")).get("profileNullCount"));
    assertEquals("0.09", profileFacts(graph, column(graph, "amount")).get("profileNullProportion"));
  }

  @Test
  void aColumnTagChangeRequeuesTheTestCasesOfTheTableAndAnUnchangedRefreshDoesNot() {
    final Table stored = profiledTable(100.0, 4.0);
    final RdfRepository repository = liveRepository(FakeEvidence.storing(stored), stored);
    repository.createOrUpdate(stored);
    repository.refreshEntity("table", TABLE_ID);
    assertEquals(List.of(), requeuedTables);

    stored.getColumns().getFirst().withTags(List.of(sensitive()));
    repository.refreshEntity("table", TABLE_ID);

    assertEquals(List.of(TABLE_FQN), requeuedTables);
  }

  @Test
  void droppingAnUntaggedColumnRequeuesItsTestAndRemovesItsColumnLinkAndResult() {
    final Table stored = profiledTable(100.0, 4.0);
    final TestCase testCase = columnTest("amount", null);
    final FakeEvidence evidence = FakeEvidence.storing(stored);
    evidence.results.put(testCase.getFullyQualifiedName(), failedResult(PROFILED_AT, 10L));
    final RdfRepository repository =
        liveRepository(
            evidence,
            (type, id) ->
                Entity.TEST_CASE.equals(type)
                    ? JsonUtils.deepCopy(testCase, TestCase.class)
                    : JsonUtils.deepCopy(stored, Table.class),
            requeuedTables::add);
    repository.createOrUpdate(stored);
    repository.refreshEntity(Entity.TEST_CASE, TEST_ID);

    final Model graph = dataset.getNamedModel(GRAPH);
    final Resource test = graph.createResource(TEST_URI);
    final Resource table = graph.createResource(TABLE_URI);
    final String testsColumn = OM + "testsColumn";
    final String hasTestResult = OM + "hasTestResult";
    assertEquals(Set.of(column(graph, "amount")), objects(graph, test, testsColumn));
    assertEquals(
        Set.of(graph.createResource(TEST_URI + "/result/latest")),
        objects(graph, test, hasTestResult));

    stored.withColumns(List.of(stored.getColumns().getLast()));
    repository.refreshEntity(Entity.TABLE, TABLE_ID);
    if (requeuedTables.contains(TABLE_FQN)) {
      repository.refreshEntity(Entity.TEST_CASE, TEST_ID);
    }

    assertEquals(Set.of(column(graph, "status")), objects(graph, table, OM + "hasColumn"));
    assertEquals(Set.of(), objects(graph, test, testsColumn));
    assertEquals(Set.of(), objects(graph, test, hasTestResult));
    assertEquals(Set.of(table), objects(graph, test, OM + "testsEntity"));
    assertEquals(List.of(TABLE_FQN), requeuedTables);
  }

  @Test
  void retryRequeuesTestCasesAfterTheFirstRequeueFails() {
    final Table stored = profiledTable(100.0, 4.0);
    final AtomicBoolean failOnce = new AtomicBoolean(true);
    final RdfRepository repository =
        liveRepository(
            FakeEvidence.storing(stored),
            stored,
            tableFqn -> {
              if (failOnce.getAndSet(false)) {
                throw new IllegalStateException("requeue unavailable");
              }
              requeuedTables.add(tableFqn);
            });
    repository.createOrUpdate(stored);
    stored.getColumns().getFirst().withTags(List.of(sensitive()));

    final long before = RdfProjectionHealth.failureVersion();
    assertThrows(RuntimeException.class, () -> repository.refreshEntity("table", TABLE_ID));
    final long after = RdfProjectionHealth.failureVersion();
    repository.refreshEntity("table", TABLE_ID);

    assertEquals(List.of(TABLE_FQN), requeuedTables);
    assertEquals(before + 1, after);
  }

  @Test
  void aStoredColumnTagReadFailureIsRecordedInProjectionHealth() {
    final Table stored = profiledTable(100.0, 4.0);
    final RdfRepository repository = liveRepository(FakeEvidence.storing(stored), stored);
    final long before = RdfProjectionHealth.failureVersion();
    failColumnTagRead = true;

    assertThrows(RuntimeException.class, () -> repository.refreshEntity(Entity.TABLE, TABLE_ID));

    assertEquals(before + 1, RdfProjectionHealth.failureVersion());
  }

  @Test
  void aColumnProfilePreservesAnIntegerAboveLongMax() {
    final BigInteger minimum = BigInteger.valueOf(Long.MAX_VALUE).add(BigInteger.ONE);
    final Table table = profiledTable(100.0, 4.0);
    table.getColumns().getFirst().getProfile().setMin(minimum);

    final Model model = translator.toRdf(table);

    final var projected =
        column(model, "amount")
            .getRequiredProperty(model.createProperty(OM, "profileMin"))
            .getLiteral();
    assertEquals(minimum.toString(), projected.getLexicalForm());
    assertEquals(XSDDatatype.XSDinteger.getURI(), projected.getDatatypeURI());
  }

  @Test
  void theColumnTagComparisonIncludesUntaggedColumnsAndIgnoresBindingsAndKeyMembers() {
    final Table table = profiledTable(100.0, 4.0);
    table.getColumns().getFirst().withTags(List.of(sensitive()));
    final Column zip = nestedColumn("status", "zip");
    table.getColumns().getLast().withChildren(List.of(zip));
    table.withTableConstraints(
        List.of(
            new TableConstraint()
                .withConstraintType(TableConstraint.ConstraintType.PRIMARY_KEY)
                .withColumns(List.of("amount"))));
    final Model projection = translator.toRdf(table);
    final Resource amount = column(projection, "amount");
    projection.add(
        projection.createResource(BASE + "ontology/concept/order/amountProperty"),
        projection.createProperty(OM, "boundColumn"),
        amount);
    projection.add(
        projection.createResource(BASE + "ontology/concept/order"),
        projection.createProperty(OM, "boundAsset"),
        projection.createResource(TABLE_URI));

    final Map<String, Set<RDFNode>> tagsByColumn = RdfColumnTags.of(projection, TABLE_URI);

    assertEquals(1, tagsByColumn.get(amount.getURI()).size());
    assertEquals(
        Map.of(
            amount.getURI(),
            objects(projection, amount, OM + "hasTag"),
            column(projection, "status").getURI(),
            Set.of(),
            column(projection, "status.zip").getURI(),
            Set.of()),
        tagsByColumn);
  }

  @Test
  void theLatestResultIsAttachedUnlessTheTestedColumnIsPiiSensitive() {
    final Table table = profiledTable(100.0, 4.0);
    final FakeEvidence evidence = FakeEvidence.storing(table);
    final TestCase onAmount = columnTest("amount", null);
    final TestCase onStatus = columnTest("status", null);
    evidence.results.put(onAmount.getFullyQualifiedName(), failedResult(PROFILED_AT, 10L));
    evidence.results.put(onStatus.getFullyQualifiedName(), failedResult(PROFILED_AT, 1L));
    table.getColumns().getLast().withTags(List.of(sensitive()));

    new RdfQualityEvidence(evidence).attach("testCase", List.of(onAmount, onStatus));

    assertEquals(10L, onAmount.getTestCaseResult().getFailedRows());
    assertNull(onStatus.getTestCaseResult());
  }

  @Test
  void anOpenIncidentIsAttachedAndAResolvedOrMaskedOneIsNot() {
    final Table table = profiledTable(100.0, 4.0);
    final FakeEvidence evidence = FakeEvidence.storing(table);
    final TestCase open = columnTest("amount", null);
    final TestCase masked = columnTest("status", null);
    final TestCase resolved = columnTest("amount", null).withFullyQualifiedName("resolved");
    evidence.incidents.put(open.getFullyQualifiedName(), assignedIncident());
    evidence.incidents.put(masked.getFullyQualifiedName(), assignedIncident());
    evidence.incidents.put(
        "resolved",
        assignedIncident()
            .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.Resolved));
    table.getColumns().getLast().withTags(List.of(sensitive()));

    new RdfQualityEvidence(evidence).attach("testCase", List.of(open, masked, resolved));

    assertEquals(
        TestCaseResolutionStatusTypes.Assigned,
        open.getIncidentStatus().getTestCaseResolutionStatusType());
    assertNull(masked.getIncidentStatus());
    assertNull(resolved.getIncidentStatus());
  }

  @Test
  void aColumnTestWhoseColumnNoLongerResolvesLinksTheTableButNoColumn() {
    final FakeEvidence evidence = FakeEvidence.storing(profiledTable(100.0, 4.0));
    final TestCase onDropped = columnTest("dropped", null);

    new RdfQualityEvidence(evidence).attach("testCase", List.of(onDropped));
    final Model model = translator.toRdf(onDropped);

    final Resource test = model.createResource(TEST_URI);
    assertEquals(Set.of(), objects(model, test, OM + "testsColumn"));
    assertEquals(Set.of(model.createResource(TABLE_URI)), objects(model, test, OM + "testsEntity"));
  }

  @Test
  void malformedLinkStillProjectsTheTestCaseWithoutItsEvidenceOrTarget() {
    final FakeEvidence evidence = FakeEvidence.storing(profiledTable(100.0, 4.0));
    final TestCase malformed =
        columnTest("amount", failedResult(PROFILED_AT, 10L))
            .withEntityLink("malformed")
            .withIncidentStatus(assignedIncident());
    evidence.results.put(malformed.getFullyQualifiedName(), malformed.getTestCaseResult());
    evidence.incidents.put(malformed.getFullyQualifiedName(), malformed.getIncidentStatus());

    new RdfQualityEvidence(evidence).attach("testCase", List.of(malformed));
    final Model model = translator.toRdf(malformed);

    final Resource test = model.createResource(TEST_URI);
    assertTrue(model.contains(test, model.createProperty(OM, "fullyQualifiedName")));
    for (final String predicate :
        List.of("testsEntity", "testsColumn", "hasTestResult", "hasOpenIncident")) {
      assertEquals(Set.of(), objects(model, test, OM + predicate));
    }
  }

  private RdfRepository liveRepository(final FakeEvidence evidence, final Table stored) {
    return liveRepository(evidence, stored, requeuedTables::add);
  }

  private RdfRepository liveRepository(
      final FakeEvidence evidence,
      final Table stored,
      final RdfProjectionLoaders.TestCaseRequeue testCaseRequeue) {
    return liveRepository(
        evidence,
        (type, id) -> {
          final Table read = JsonUtils.deepCopy(stored, Table.class);
          clearProfiles(read);
          return read;
        },
        testCaseRequeue);
  }

  private RdfRepository liveRepository(
      final FakeEvidence evidence,
      final BiFunction<String, UUID, EntityInterface<?>> entityRead,
      final RdfProjectionLoaders.TestCaseRequeue testCaseRequeue) {
    final RdfStorageInterface storage = mock(RdfStorageInterface.class);
    doAnswer(
            call -> {
              final String uri = BASE + "entity/" + call.getArgument(0) + "/" + call.getArgument(1);
              UpdateAction.parseExecute(RdfRepository.buildEntityDeleteUpdate(uri), dataset);
              dataset.getNamedModel(GRAPH).add(call.getArgument(2, Model.class));
              return null;
            })
        .when(storage)
        .storeEntity(anyString(), any(UUID.class), any(Model.class));
    doAnswer(
            call -> {
              if (failColumnTagRead) {
                throw new IllegalStateException("stored column tags unavailable");
              }
              return select(call.getArgument(0));
            })
        .when(storage)
        .executeSparqlQuery(anyString(), anyString());
    return new RdfRepository(
        new RdfConfiguration().withEnabled(true).withBaseUri(URI.create(BASE)),
        storage,
        translator,
        () -> null,
        new RdfProjectionLoaders(
            RdfProjectionLoaders.withQualityEvidence(entityRead, new RdfQualityEvidence(evidence)),
            null,
            null,
            null,
            null,
            null,
            null,
            testCaseRequeue));
  }

  private String select(final String query) {
    try (QueryExecution execution = QueryExecutionFactory.create(query, dataset)) {
      final ByteArrayOutputStream json = new ByteArrayOutputStream();
      ResultSetFormatter.outputAsJSON(json, execution.execSelect());
      return json.toString(StandardCharsets.UTF_8);
    }
  }
}
