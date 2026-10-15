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

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.TopicTestFactory;
import org.openmetadata.it.util.RdfRepairPasses;
import org.openmetadata.it.util.RdfTestUtils;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppExtension;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.RdfInfraDAOs.RdfReindexLockDAO;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.repair.RdfProjectedEntities;
import org.openmetadata.service.rdf.repair.RdfRepairJob;

/**
 * The scheduled RDF repair puts back what live RDF writes missed, from the database: a projection
 * the store lost, one left behind by a later change, an entity whose row is gone, and a whole
 * projection that was never built. One server runs each pass.
 */
@Execution(ExecutionMode.SAME_THREAD)
@Isolated("A repair pass re-projects and sweeps entities of every type, and can rebuild the graph")
@ExtendWith(TestNamespaceExtension.class)
class RdfRepairIT {
  private static final Duration PROJECTION_WAIT = Duration.ofMinutes(2);
  private static final String BASE = "https://open-metadata.org/";
  private static final String KNOWLEDGE_GRAPH = "https://open-metadata.org/graph/knowledge";
  private static final String MODIFIED = "<http://purl.org/dc/terms/modified>";
  private static final String RDF_INDEX_APP = "RdfIndexApp";
  private static final String STATUS = AppExtension.ExtensionType.STATUS.toString();

  @BeforeAll
  static void setup() {
    assumeTrue(RdfTestUtils.isRdfEnabled(), "Requires the RDF integration-test profile");
    SdkClients.adminClient();
  }

  @Test
  void aProjectionTheStoreLostIsRebuiltByTheNextPass(final TestNamespace ns) {
    final Topic topic = TopicTestFactory.createSimple(ns);
    awaitProjected(topic.getId(), true);

    update(
        "DELETE WHERE { GRAPH <" + KNOWLEDGE_GRAPH + "> { <" + iri(topic.getId()) + "> ?p ?o } }");
    assertFalse(isProjected(topic.getId()));

    RdfRepairPasses.run(false);

    awaitProjected(topic.getId(), true);
  }

  @Test
  void aStaleProjectionIsRebuiltByTheNextPass(final TestNamespace ns) {
    final Topic topic = TopicTestFactory.createSimple(ns);
    awaitProjected(topic.getId(), true);
    final String subject = "<" + iri(topic.getId()) + ">";

    final String modified = subject + " " + MODIFIED;
    update(
        "DELETE { GRAPH <"
            + KNOWLEDGE_GRAPH
            + "> { "
            + modified
            + " ?m } } "
            + "INSERT { GRAPH <"
            + KNOWLEDGE_GRAPH
            + "> { "
            + modified
            + " \"1000\" } } "
            + "WHERE { GRAPH <"
            + KNOWLEDGE_GRAPH
            + "> { "
            + modified
            + " ?m } }");

    RdfRepairPasses.run(false);

    Awaitility.await("the projection carries the row's updatedAt again")
        .atMost(PROJECTION_WAIT)
        .until(
            () ->
                projected()
                    .modifiedTimes(Entity.TOPIC, List.of(topic.getId().toString()))
                    .getOrDefault(topic.getId().toString(), Set.of())
                    .contains(topic.getUpdatedAt()));
  }

  @Test
  void anEntityWhoseRowIsGoneIsSweptAway() {
    final List<UUID> orphans = new ArrayList<>();
    final long rows = Entity.getEntityRepository(Entity.TOPIC).getDao().listTotalCount();
    final long projections = projected().counts().getOrDefault(Entity.TOPIC, 0L);
    // The sweep lists a type only when the store holds more projections of it than it has rows.
    for (long missing = Math.max(1, rows - projections + 1); missing > 0; missing--) {
      final UUID orphan = UUID.randomUUID();
      orphans.add(orphan);
      update(
          "INSERT DATA { GRAPH <%s> { <%s> %s \"%d\" } }"
              .formatted(KNOWLEDGE_GRAPH, iri(orphan), MODIFIED, System.currentTimeMillis()));
    }

    RdfRepairPasses.run(true);

    orphans.forEach(orphan -> awaitProjected(orphan, false));
  }

  @Test
  void aPassIsLeftToTheServerAlreadyRunningOne() {
    final RdfReindexLockDAO locks = Entity.getCollectionDAO().rdfReindexLockDAO();
    final String otherServersPass = UUID.randomUUID().toString();
    Awaitility.await("another server starts an RDF repair pass")
        .atMost(PROJECTION_WAIT)
        .pollInterval(Duration.ofSeconds(1))
        .until(
            () ->
                locks.tryAcquireLock(
                    RdfRepairJob.LOCK_KEY,
                    otherServersPass,
                    "another-server",
                    System.currentTimeMillis(),
                    System.currentTimeMillis() + PROJECTION_WAIT.toMillis()));
    try {
      assertFalse(RdfRepairPasses.tryRun());
    } finally {
      locks.releaseLock(RdfRepairJob.LOCK_KEY, otherServersPass);
    }
    // The scheduler may take the freed lock first; this server runs one once it is free again.
    RdfRepairPasses.run(false);
  }

  @Test
  void aProjectionNeverBuiltIsBuiltByTheNextPass() {
    final AppRepository apps = (AppRepository) Entity.getEntityRepository(Entity.APPLICATION);
    final App rdfIndexApp = apps.getByName(null, RDF_INDEX_APP, apps.getFields("id"));
    Entity.getCollectionDAO()
        .appExtensionTimeSeriesDao()
        .delete(rdfIndexApp.getId().toString(), STATUS);
    assertFalse(latestRebuild().isPresent());

    RdfRepairPasses.run(false);

    Awaitility.await("the repair builds the whole projection")
        .atMost(Duration.ofMinutes(5))
        .pollInterval(Duration.ofSeconds(2))
        .until(
            () ->
                latestRebuild()
                    .map(AppRunRecord::getStatus)
                    .filter(
                        status ->
                            status == AppRunRecord.Status.SUCCESS
                                || status == AppRunRecord.Status.COMPLETED)
                    .isPresent());
  }

  private static Optional<AppRunRecord> latestRebuild() {
    final List<String> latest =
        Entity.getCollectionDAO()
            .appExtensionTimeSeriesDao()
            .listAppExtensionByName(RDF_INDEX_APP, 1, 0, STATUS);
    return latest.isEmpty()
        ? Optional.empty()
        : Optional.of(JsonUtils.readValue(latest.getFirst(), AppRunRecord.class));
  }

  private static void awaitProjected(final UUID topicId, final boolean expected) {
    Awaitility.await("topic " + topicId + (expected ? " is projected" : " is removed"))
        .atMost(PROJECTION_WAIT)
        .pollInterval(Duration.ofMillis(500))
        .until(() -> isProjected(topicId) == expected);
  }

  private static boolean isProjected(final UUID topicId) {
    return RdfTestUtils.executeSparqlAsk("ASK { <" + iri(topicId) + "> " + MODIFIED + " ?m }");
  }

  private static RdfProjectedEntities projected() {
    return new RdfProjectedEntities(
        query -> RdfRepository.getInstance().executeSparqlQueryDirect(query, "json"), () -> BASE);
  }

  private static void update(final String sparqlUpdate) {
    RdfRepository.getInstance().executeSparqlUpdate(sparqlUpdate);
  }

  private static String iri(final UUID topicId) {
    return BASE + "entity/" + Entity.TOPIC + "/" + topicId;
  }
}
