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

package org.openmetadata.it.tests.search.scale;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.factories.EntityLoadSpec;
import org.openmetadata.it.factories.EntityLoadSpec.EntityKind;
import org.openmetadata.it.factories.EntityLoadSummary;
import org.openmetadata.it.factories.SeedData;
import org.openmetadata.it.search.IndexAliasInspector;
import org.openmetadata.it.search.SearchClient;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.GlossaryTermRelationGraph;
import org.openmetadata.sdk.fluent.Apps;
import org.openmetadata.sdk.services.glossary.GlossaryTermRelationGraphOptions;
import org.openmetadata.service.Entity;

@Tag("scale")
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.SAME_THREAD)
@ResourceLock(value = "ONTOLOGY_SCALE", mode = ResourceAccessMode.READ_WRITE)
class OntologyScaleIT {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final int CONCEPT_COUNT = Integer.getInteger("jpw.ontology.concepts", 100_000);
  private static final int LOAD_WORKERS = 32;
  private static final int SEARCH_WARMUPS = 5;
  private static final int SEARCH_SAMPLES = 20;
  private static final int GRAPH_RELATION_COUNT = 75;
  private static final int GRAPH_NODE_LIMIT = 25;
  private static final int GRAPH_EDGE_LIMIT = 50;
  private static final long SEARCH_P95_LIMIT_MILLIS = 1_000;
  private static final long GRAPH_LIMIT_MILLIS = 2_000;
  private static final String RELATED_TO = "relatedTo";

  private static ServerHandle server;
  private static SearchClient search;
  private static String glossaryTermAlias;

  @BeforeAll
  static void setup() {
    server = OssTestServer.defaultHandle();
    search = new SearchClient(server);
    glossaryTermAlias = new IndexAliasInspector(server).indexNameFor(Entity.GLOSSARY_TERM);
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void indexedConceptSearchAndRelationGraphStayBounded(final TestNamespace namespace)
      throws Exception {
    final ScaleCohort cohort = seedConcepts(namespace);
    awaitIndexed(cohort.targetName());
    final SearchLatency searchLatency = measureExactSearch(cohort.targetName());
    final GraphMeasurement graphMeasurement = measureBoundedGraph(cohort.namePrefix());

    assertScaleContract(searchLatency, graphMeasurement);
    writeMetrics(cohort, searchLatency, graphMeasurement);
  }

  private static ScaleCohort seedConcepts(final TestNamespace namespace) {
    requireIngestMode();
    final long startedAt = System.nanoTime();
    final EntityLoadSummary summary = SeedData.provision(loadSpec(), namespace, server);
    final long elapsedMillis = elapsedMillis(startedAt);
    assertThat(summary.countOf(EntityKind.GLOSSARY_TERM)).isEqualTo(CONCEPT_COUNT);
    assertThat(namespace.trackedRoots())
        .anyMatch(root -> Entity.GLOSSARY.equals(root.entityType()));
    final String namePrefix = namespace.prefix("term") + "_";
    return new ScaleCohort(namePrefix, namePrefix + (CONCEPT_COUNT / 2), elapsedMillis);
  }

  private static EntityLoadSpec loadSpec() {
    return EntityLoadSpec.builder()
        .count(EntityKind.GLOSSARY_TERM, CONCEPT_COUNT)
        .parallelWorkers(LOAD_WORKERS)
        .build();
  }

  private static void requireIngestMode() {
    if (SeedData.mode() != SeedData.Mode.INGEST) {
      throw new IllegalStateException("Ontology scale verification requires jpw.data.mode=ingest");
    }
  }

  private static void awaitIndexed(final String targetName) {
    Awaitility.await()
        .ignoreExceptions()
        .atMost(Duration.ofMinutes(2))
        .until(() -> exactSearch(targetName).path("hits").path("hits").size() == 1);
  }

  private static SearchLatency measureExactSearch(final String targetName) {
    for (int warmup = 0; warmup < SEARCH_WARMUPS; warmup++) {
      requireExactHit(targetName);
    }
    final long[] samples = new long[SEARCH_SAMPLES];
    for (int sample = 0; sample < SEARCH_SAMPLES; sample++) {
      final long startedAt = System.nanoTime();
      requireExactHit(targetName);
      samples[sample] = elapsedMillis(startedAt);
    }
    Arrays.sort(samples);
    return new SearchLatency(samples[percentileIndex(samples.length)], samples[samples.length - 1]);
  }

  private static int percentileIndex(final int sampleCount) {
    return Math.min(sampleCount - 1, (int) Math.ceil(sampleCount * 0.95) - 1);
  }

  private static UUID requireExactHit(final String name) {
    final JsonNode hits = exactSearch(name).path("hits").path("hits");
    assertThat(hits).hasSize(1);
    assertThat(hits.get(0).path("_source").path("name").asText()).isEqualTo(name);
    return UUID.fromString(hits.get(0).path("_source").path("id").asText());
  }

  private static JsonNode exactSearch(final String name) {
    return search.search(glossaryTermAlias, exactNameQuery(name));
  }

  private static String exactNameQuery(final String name) {
    final ObjectNode body = MAPPER.createObjectNode();
    body.put("size", 1);
    body.putArray("_source").add("id").add("name");
    body.putObject("query").putObject("term").put("name.keyword", name.toLowerCase(Locale.ROOT));
    return body.toString();
  }

  private static GraphMeasurement measureBoundedGraph(final String namePrefix) {
    final List<UUID> termIds = loadTermIds(namePrefix, GRAPH_RELATION_COUNT + 1);
    addRelations(termIds);
    final long startedAt = System.nanoTime();
    final GlossaryTermRelationGraph graph = loadBoundedGraph(termIds.getFirst());
    return new GraphMeasurement(graph, elapsedMillis(startedAt));
  }

  private static List<UUID> loadTermIds(final String namePrefix, final int count) {
    final List<UUID> termIds = new ArrayList<>(count);
    for (int index = 0; index < count; index++) {
      termIds.add(requireExactHit(namePrefix + index));
    }
    return List.copyOf(termIds);
  }

  private static void addRelations(final List<UUID> termIds) {
    final UUID rootId = termIds.getFirst();
    for (int index = 1; index < termIds.size(); index++) {
      SdkClients.adminClient().glossaryTerms().addRelation(rootId, termIds.get(index), RELATED_TO);
    }
  }

  private static GlossaryTermRelationGraph loadBoundedGraph(final UUID rootId) {
    final GlossaryTermRelationGraphOptions options =
        new GlossaryTermRelationGraphOptions(
            1, List.of(RELATED_TO), GRAPH_NODE_LIMIT, GRAPH_EDGE_LIMIT);
    return SdkClients.adminClient().glossaryTerms().relationGraph(rootId, options);
  }

  private static void assertScaleContract(
      final SearchLatency searchLatency, final GraphMeasurement graphMeasurement) {
    final GlossaryTermRelationGraph graph = graphMeasurement.graph();
    assertThat(searchLatency.p95Millis()).isLessThan(SEARCH_P95_LIMIT_MILLIS);
    assertThat(graphMeasurement.elapsedMillis()).isLessThan(GRAPH_LIMIT_MILLIS);
    assertThat(graph.getNodes()).hasSizeLessThanOrEqualTo(GRAPH_NODE_LIMIT);
    assertThat(graph.getEdges()).hasSizeLessThanOrEqualTo(GRAPH_EDGE_LIMIT);
    assertThat(graph.getTruncated()).isTrue();
  }

  private static void writeMetrics(
      final ScaleCohort cohort,
      final SearchLatency searchLatency,
      final GraphMeasurement graphMeasurement)
      throws Exception {
    final GlossaryTermRelationGraph graph = graphMeasurement.graph();
    final OntologyScaleMetrics metrics =
        new OntologyScaleMetrics(
            CONCEPT_COUNT,
            cohort.ingestMillis(),
            searchLatency.p95Millis(),
            searchLatency.maxMillis(),
            graphMeasurement.elapsedMillis(),
            graph.getNodes().size(),
            graph.getEdges().size(),
            graph.getTruncated());
    ReindexBenchmarkIT.writeMetrics(metrics, "ontology-scale-" + CONCEPT_COUNT + ".json");
  }

  private static long elapsedMillis(final long startedAt) {
    return TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedAt);
  }

  private record ScaleCohort(String namePrefix, String targetName, long ingestMillis) {}

  private record SearchLatency(long p95Millis, long maxMillis) {}

  private record GraphMeasurement(GlossaryTermRelationGraph graph, long elapsedMillis) {}

  private record OntologyScaleMetrics(
      int conceptCount,
      long ingestMillis,
      long searchP95Millis,
      long searchMaxMillis,
      long graphMillis,
      int graphNodes,
      int graphEdges,
      boolean graphTruncated) {}
}
