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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.openmetadata.it.util.RdfGraphAssertions.BASE_URI;
import static org.openmetadata.it.util.RdfGraphAssertions.count;
import static org.openmetadata.it.util.RdfGraphAssertions.iri;
import static org.openmetadata.it.util.RdfGraphAssertions.mentions;
import static org.openmetadata.it.util.RdfGraphAssertions.om;

import java.net.URI;
import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.RdfTestUtils;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.api.data.CreateChart;
import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.domains.CreateDomain.DomainType;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.type.ChartType;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ConflictException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.rdf.RdfUpdater;

/**
 * A reindex projects the live catalog only (#36277), so a graph built before soft-deleted entities
 * left it is cleaned by the next Recreate run. Recreate clears the shared graph, so this class runs
 * alone and reindexes every entity type.
 */
@Execution(ExecutionMode.SAME_THREAD)
@Isolated
@ExtendWith(TestNamespaceExtension.class)
public class RdfSoftDeleteReindexIT {
  private static final String APP_NAME = "RdfIndexApp";
  private static final String RUN_LATEST = "/v1/apps/name/" + APP_NAME + "/runs/latest";

  @BeforeAll
  static void enableLiveProjection() {
    assumeTrue(RdfTestUtils.isRdfEnabled(), "Run with the RDF integration-test profile");
    assumeFalse(
        TestSuiteBootstrap.isK8sEnabled(), "App trigger is not compatible with K8s pipelines");
    if (!RdfUpdater.isEnabled()) {
      RdfUpdater.initialize(
          new RdfConfiguration()
              .withEnabled(true)
              .withBaseUri(URI.create(BASE_URI))
              .withStorageType(RdfConfiguration.StorageType.FUSEKI)
              .withRemoteEndpoint(URI.create(TestSuiteBootstrap.getFusekiEndpoint()))
              .withDataset("openmetadata")
              .withUsername("admin")
              .withPassword("test-admin"));
    }
  }

  @Test
  void aRecreateReindexLeavesOutSoftDeletedEntitiesAndTheEdgesToThem(
      final TestNamespace namespace) {
    final OpenMetadataClient client = SdkClients.adminClient();
    final DatabaseSchema schema =
        DatabaseSchemaTestFactory.createSimple(
            namespace, DatabaseServiceTestFactory.createPostgres(namespace));
    final Table live =
        TableTestFactory.createWithName(namespace, schema.getFullyQualifiedName(), "live");
    final Table deleted =
        TableTestFactory.createWithName(namespace, schema.getFullyQualifiedName(), "deleted");
    client
        .lineage()
        .addLineage(
            new AddLineage()
                .withEdge(
                    new EntitiesEdge()
                        .withFromEntity(deleted.getEntityReference())
                        .withToEntity(live.getEntityReference())));
    final DashboardService service = DashboardServiceTestFactory.createMetabase(namespace);
    final Chart keptChart = chart(client, namespace, service, "keptChart");
    final Chart deletedChart = chart(client, namespace, service, "deletedChart");
    final Dashboard dashboard =
        client
            .dashboards()
            .create(
                new CreateDashboard()
                    .withName(namespace.prefix("reindexed"))
                    .withService(service.getFullyQualifiedName())
                    .withCharts(
                        List.of(
                            keptChart.getFullyQualifiedName(),
                            deletedChart.getFullyQualifiedName())));
    // Domains have no deleted column: the reindex must read them without a deleted filter.
    final Domain domain =
        client
            .domains()
            .create(
                new CreateDomain()
                    .withName(namespace.prefix("reindexedDomain"))
                    .withDomainType(DomainType.AGGREGATE)
                    .withDescription("RDF soft-delete reindex fixture"));
    client.tables().delete(deleted.getId().toString());
    client.charts().delete(deletedChart.getId().toString());

    final HttpClient http = client.getHttpClient();
    awaitNoRunInFlight(http);
    triggerRecreateAndWait(http, latestRunStart(http));

    assertEquals(0, count(mentions(iri("table", deleted))));
    assertEquals(0, count(mentions(iri("chart", deletedChart))));
    assertTrue(
        count(iri("databaseSchema", schema) + " " + om("contains") + " " + iri("table", live)) > 0);
    assertTrue(count(iri("dashboard", dashboard) + " ?p " + iri("chart", keptChart)) > 0);
    assertTrue(count(mentions(iri("domain", domain))) > 0);
  }

  private static Chart chart(
      final OpenMetadataClient client,
      final TestNamespace namespace,
      final DashboardService service,
      final String name) {
    return client
        .charts()
        .create(
            new CreateChart()
                .withName(namespace.prefix(name))
                .withService(service.getFullyQualifiedName())
                .withChartType(ChartType.Bar));
  }

  private static void triggerRecreateAndWait(final HttpClient http, final Long previousStart) {
    // Recreate clears the shared graph; reindexing every type rebuilds it for later classes.
    final Map<String, Object> config =
        Map.of("entities", List.of("all"), "recreateIndex", true, "batchSize", 100);
    Awaitility.await("trigger " + APP_NAME)
        .atMost(Duration.ofMinutes(2))
        .pollInterval(Duration.ofSeconds(3))
        .ignoreException(ConflictException.class)
        .until(
            () -> {
              http.execute(HttpMethod.POST, "/v1/apps/trigger/" + APP_NAME, config, Void.class);
              return true;
            });
    final AppRunRecord[] completed = new AppRunRecord[1];
    Awaitility.await(APP_NAME + " completion")
        .atMost(Duration.ofMinutes(10))
        .pollInterval(Duration.ofSeconds(5))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              final AppRunRecord run =
                  http.execute(HttpMethod.GET, RUN_LATEST, null, AppRunRecord.class);
              assertNotNull(run.getStartTime());
              assertTrue(previousStart == null || run.getStartTime() > previousStart);
              assertTrue(isTerminal(run));
              completed[0] = run;
            });
    final String status = completed[0].getStatus().value();
    assertTrue(
        "completed".equalsIgnoreCase(status) || "success".equalsIgnoreCase(status),
        () -> "RDF reindex failed: " + completed[0]);
  }

  private static void awaitNoRunInFlight(final HttpClient http) {
    Awaitility.await("no " + APP_NAME + " in flight")
        .atMost(Duration.ofMinutes(10))
        .pollInterval(Duration.ofSeconds(3))
        .ignoreExceptions()
        .until(
            () -> {
              final AppRunRecord run =
                  http.execute(HttpMethod.GET, RUN_LATEST, null, AppRunRecord.class);
              return run == null || run.getStatus() == null || isTerminal(run);
            });
  }

  private static Long latestRunStart(final HttpClient http) {
    try {
      final AppRunRecord run = http.execute(HttpMethod.GET, RUN_LATEST, null, AppRunRecord.class);
      return run == null ? null : run.getStartTime();
    } catch (RuntimeException noRunYet) {
      return null;
    }
  }

  private static boolean isTerminal(final AppRunRecord run) {
    return run.getStatus() != null
        && List.of("completed", "success", "failed", "activeerror", "stopped")
            .contains(run.getStatus().value().toLowerCase(Locale.ROOT));
  }
}
