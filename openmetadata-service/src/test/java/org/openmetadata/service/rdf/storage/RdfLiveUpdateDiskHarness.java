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

import com.fasterxml.jackson.databind.JsonNode;
import io.micrometer.core.instrument.DistributionSummary;
import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import java.util.function.BiConsumer;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.rdf.translator.JsonLdTranslator;
import org.openmetadata.service.rdf.translator.ReferenceScope;

/**
 * Measures what live updates of wide tables cost a real Fuseki, written as a full replacement
 * (every write before ADR:2026-11-03-live-rdf-entity-writes-send-only-the-changed-triples) or as a
 * difference. Not a unit test: it needs a running, otherwise idle Fuseki with the OpenMetadata
 * image's storage extension, and it compacts the dataset between scenarios. Run each strategy
 * against a fresh dataset; scripts/rdf-live-update-benchmark.sh does.
 *
 * <p>Usage: {@code RdfLiveUpdateDiskHarness <endpoint> <DIFFERENCE|REPLACE> <tables> <columns>
 * <rounds>}, credentials from {@code -Dusername} and {@code -Dpassword}, and {@code
 * -DdiskUsageCommand}: a shell command whose output starts with the dataset directory's size in KB.
 */
public final class RdfLiveUpdateDiskHarness {
  private static final String BASE = "https://open-metadata.org/";
  private static final String GRAPH = BASE + "graph/knowledge";
  private static final Duration COMPACTION_BUDGET = Duration.ofMinutes(30);

  private final JenaFusekiStorage storage;
  private final RdfEntityWriteStrategy strategy;
  private final String statsUrl;
  private final String authorization;
  private final String diskUsageCommand = requiredProperty("diskUsageCommand");
  private final JsonLdTranslator translator =
      new JsonLdTranslator(
          JsonUtils.getObjectMapper(), BASE, (type, fqns) -> Map.of(), ReferenceScope.ALL);

  private RdfLiveUpdateDiskHarness(
      final String endpoint, final RdfEntityWriteStrategy strategy, final String[] credentials) {
    this.storage =
        new JenaFusekiStorage(
            new RdfConfiguration()
                .withEnabled(true)
                .withStorageType(RdfConfiguration.StorageType.FUSEKI)
                .withBaseUri(URI.create(BASE))
                .withRemoteEndpoint(URI.create(endpoint))
                .withUsername(credentials[0])
                .withPassword(credentials[1]));
    this.strategy = strategy;
    final URI dataset = URI.create(endpoint);
    this.statsUrl = dataset.resolve("/$/stats" + dataset.getPath()).toString();
    this.authorization =
        "Basic "
            + Base64.getEncoder()
                .encodeToString(
                    (credentials[0] + ":" + credentials[1]).getBytes(StandardCharsets.UTF_8));
  }

  public static void main(final String[] args) throws Exception {
    final String endpoint = args.length > 0 ? args[0] : "http://localhost:3030/openmetadata";
    final RdfEntityWriteStrategy strategy =
        RdfEntityWriteStrategy.valueOf(args.length > 1 ? args[1] : "DIFFERENCE");
    final int tableCount = args.length > 2 ? Integer.parseInt(args[2]) : 200;
    final int columnCount = args.length > 3 ? Integer.parseInt(args[3]) : 300;
    final int rounds = args.length > 4 ? Integer.parseInt(args[4]) : 5;
    final String[] credentials = {
      System.getProperty("username", "admin"), System.getProperty("password", "admin")
    };
    Metrics.addRegistry(new SimpleMeterRegistry());
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("table", "table");
    final RdfLiveUpdateDiskHarness harness =
        new RdfLiveUpdateDiskHarness(endpoint, strategy, credentials);
    try {
      harness.run(tableCount, columnCount, rounds);
    } finally {
      harness.storage.close();
    }
  }

  private void run(final int tableCount, final int columnCount, final int rounds)
      throws IOException, InterruptedException {
    final List<Table> tables = new ArrayList<>();
    for (int index = 0; index < tableCount; index++) {
      tables.add(wideTable(index, columnCount));
    }
    storage.clearGraph(GRAPH);
    tables.forEach(this::write);
    System.out.printf(
        "strategy=%s tables=%d columns=%d rounds=%d%n", strategy, tableCount, columnCount, rounds);
    System.out.println(
        "scenario | writes | disk growth MB | KB per write | update requests | payload MB | outcomes");
    measure("unchanged", tables, rounds, (table, round) -> {});
    measure("one tag", tables, rounds, RdfLiveUpdateDiskHarness::moveOneTag);
    measure(
        "description",
        tables,
        rounds,
        (table, round) -> table.setDescription("Revision " + round + " of " + table.getName()));
  }

  private void measure(
      final String scenario,
      final List<Table> tables,
      final int rounds,
      final BiConsumer<Table, Integer> edit)
      throws IOException, InterruptedException {
    storage.compactAndAwait(COMPACTION_BUDGET);
    final long usedBefore = usedBytes();
    final long requestsBefore = updateRequests();
    final double payloadBefore = payloadBytes();
    final Map<String, Double> outcomesBefore = outcomes();
    for (int round = 0; round < rounds; round++) {
      for (Table table : tables) {
        edit.accept(table, round);
        write(table);
      }
    }
    final long writes = (long) tables.size() * rounds;
    final long growth = usedBytes() - usedBefore;
    System.out.printf(
        "%s | %d | %.1f | %.1f | %d | %.1f | %s%n",
        scenario,
        writes,
        growth / 1_048_576.0,
        growth / 1024.0 / writes,
        updateRequests() - requestsBefore,
        (payloadBytes() - payloadBefore) / 1_048_576.0,
        difference(outcomes(), outcomesBefore));
  }

  private void write(final Table table) {
    storage.storeEntity("table", table.getId(), translator.toRdf(table), strategy);
  }

  /** The dataset directory's size; the volume's free space also moves with everything else on it. */
  private long usedBytes() throws IOException, InterruptedException {
    final Process process = new ProcessBuilder("sh", "-c", diskUsageCommand).start();
    final String output =
        new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
    if (process.waitFor() != 0) {
      throw new IllegalStateException("Measuring the dataset failed: " + diskUsageCommand);
    }
    return Long.parseLong(output.trim().split("\\s+")[0]) * 1024;
  }

  private long updateRequests() throws IOException, InterruptedException {
    final HttpResponse<String> response =
        HttpClient.newHttpClient()
            .send(
                HttpRequest.newBuilder(URI.create(statsUrl))
                    .header("Authorization", authorization)
                    .GET()
                    .build(),
                HttpResponse.BodyHandlers.ofString());
    long requests = 0;
    for (JsonNode dataset : JsonUtils.readTree(response.body()).path("datasets")) {
      for (JsonNode service : dataset.path("endpoints")) {
        if ("update".equalsIgnoreCase(service.path("operation").asText())) {
          requests += service.path("Requests").asLong();
        }
      }
    }
    return requests;
  }

  private static double payloadBytes() {
    final DistributionSummary summary =
        Metrics.globalRegistry
            .find("rdf.fuseki.payload.bytes")
            .tag("operation", "storeEntity")
            .summary();
    return summary == null ? 0 : summary.totalAmount();
  }

  private static Map<String, Double> outcomes() {
    final Map<String, Double> counts = new TreeMap<>();
    Metrics.globalRegistry
        .find("rdf.fuseki.entity.writes")
        .counters()
        .forEach(counter -> counts.put(counter.getId().getTag("outcome"), counter.count()));
    return counts;
  }

  private static Map<String, Long> difference(
      final Map<String, Double> after, final Map<String, Double> before) {
    final Map<String, Long> delta = new TreeMap<>();
    after.forEach(
        (outcome, count) -> delta.put(outcome, (long) (count - before.getOrDefault(outcome, 0.0))));
    return delta;
  }

  private static void moveOneTag(final Table table, final int round) {
    final List<Column> columns = table.getColumns();
    columns.get(round % columns.size()).setTags(List.of());
    columns.get((round + 1) % columns.size()).setTags(List.of(tag("PII.Sensitive")));
  }

  private static Table wideTable(final int index, final int columnCount) {
    final String fqn = "bench.db.schema.wide_" + index;
    final List<Column> columns = new ArrayList<>();
    for (int column = 0; column < columnCount; column++) {
      columns.add(
          new Column()
              .withName("column_" + column)
              .withFullyQualifiedName(fqn + ".column_" + column)
              .withDataType(ColumnDataType.VARCHAR)
              .withOrdinalPosition(column)
              .withDescription("Column " + column + " of table " + index)
              .withTags(column % 10 == 0 ? List.of(tag("PII.Sensitive")) : List.of()));
    }
    final Table table =
        new Table()
            .withId(UUID.nameUUIDFromBytes(fqn.getBytes(StandardCharsets.UTF_8)))
            .withName("wide_" + index)
            .withFullyQualifiedName(fqn)
            .withDescription("Wide table " + index)
            .withUpdatedAt(1_700_000_000_120L)
            .withTags(List.of(tag("Tier.Tier2")))
            .withColumns(columns);
    table.setVersion(0.1);
    return table;
  }

  private static String requiredProperty(final String name) {
    final String value = System.getProperty(name);
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException("Set -D" + name);
    }
    return value;
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
