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

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.rdf.storage.JenaFusekiStorage;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;
import org.openmetadata.service.rdf.translator.JsonLdTranslator;

/**
 * Drives the production RDF write path — real translator, real payload chunking, real Fuseki — at
 * a configurable scale and prints throughput. Not a unit test: it needs a running Fuseki and is
 * invoked from scripts/rdf-write-path-benchmark.sh.
 *
 * <p>Usage: {@code RdfWritePathScaleHarness <endpoint> <entities> <wideEvery> <wideColumns>}
 */
public final class RdfWritePathScaleHarness {

  private static final String BASE_URI = "https://open-metadata.org/";

  private RdfWritePathScaleHarness() {}

  public static void main(String[] args) throws Exception {
    String endpoint = args.length > 0 ? args[0] : "http://localhost:3135/openmetadata";
    int entityCount = args.length > 1 ? Integer.parseInt(args[1]) : 10_000;
    int wideEvery = args.length > 2 ? Integer.parseInt(args[2]) : 100;
    int wideColumns = args.length > 3 ? Integer.parseInt(args[3]) : 500;
    boolean streaming = !"false".equals(System.getProperty("streaming"));
    RdfWriteMode writeMode =
        "reconcile".equalsIgnoreCase(System.getProperty("writeMode", "insert"))
            ? RdfWriteMode.RECONCILE
            : RdfWriteMode.INSERT_ONLY;
    boolean gzip = "true".equals(System.getProperty("gzip"));
    int appendBytes = Integer.getInteger("appendBytes", 16 * 1024 * 1024);
    int appendBatch = Integer.getInteger("appendBatch", 1000);

    RdfConfiguration config =
        new RdfConfiguration()
            .withEnabled(true)
            .withBaseUri(URI.create(BASE_URI))
            .withRemoteEndpoint(URI.create(endpoint))
            .withUsername(System.getProperty("fusekiUser", "admin"))
            .withPassword(System.getProperty("fusekiPassword", "admin"))
            .withStreamingAppendEnabled(streaming)
            .withGzipRequests(gzip)
            .withMaxAppendPayloadBytes(appendBytes)
            .withMaxUpdatePayloadBytes(Integer.getInteger("updateBytes", 4 * 1024 * 1024))
            .withBulkAppendEntityBatchSize(appendBatch)
            .withRequestTimeoutMs(300_000)
            .withWriteMaxRetries(0);

    // getEntityReference() resolves the type through this map; the harness does not boot
    // the app, so register just the types it emits.
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("table", "table");
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("databaseschema", "databaseSchema");

    System.out.printf(
        "config: entities=%d wideEvery=%d wideCols=%d mode=%s streaming=%s gzip=%s "
            + "appendBytes=%d appendBatch=%d%n",
        entityCount, wideEvery, wideColumns, writeMode, streaming, gzip, appendBytes, appendBatch);

    JenaFusekiStorage storage = new JenaFusekiStorage(config);
    JsonLdTranslator translator = new JsonLdTranslator(JsonUtils.getObjectMapper(), BASE_URI);
    RdfRepository repository = new RdfRepository(config, storage, translator);

    long before = triples(endpoint);
    List<EntityInterface> batch = new ArrayList<>();
    long translateNanos = 0;
    long writeNanos = 0;
    long triplesWritten = 0;
    int written = 0;
    long startedAt = System.nanoTime();

    for (int i = 0; i < entityCount; i++) {
      batch.add(table(i, wideEvery > 0 && i % wideEvery == 0 ? wideColumns : 7));
      if (batch.size() == appendBatch || i == entityCount - 1) {
        long t0 = System.nanoTime();
        List<RdfStorageInterface.EntityWriteRequest> requests = repository.translateEntities(batch);
        long t1 = System.nanoTime();
        repository.bulkStorePreTranslated(requests, writeMode);
        long t2 = System.nanoTime();

        translateNanos += t1 - t0;
        writeNanos += t2 - t1;
        triplesWritten += requests.stream().mapToLong(r -> r.model().size()).sum();
        written += batch.size();
        batch.clear();
        if (written % (appendBatch * 10) == 0) {
          System.out.printf(
              "  %d/%d entities, %.0f rec/s%n",
              written, entityCount, written / elapsedSeconds(startedAt));
        }
      }
    }

    double seconds = elapsedSeconds(startedAt);
    long after = triples(endpoint);
    System.out.println("---- results ----");
    System.out.printf("entities        : %d%n", written);
    System.out.printf("wall clock      : %.1f s%n", seconds);
    System.out.printf("throughput      : %.0f entities/s%n", written / seconds);
    System.out.printf(
        "triples written : %d (%.0f triples/s)%n", triplesWritten, triplesWritten / seconds);
    System.out.printf(
        "translate time  : %.1f s (%.0f%%)%n",
        nanosToSeconds(translateNanos), 100.0 * translateNanos / (translateNanos + writeNanos));
    System.out.printf(
        "fuseki write    : %.1f s (%.0f%%)%n",
        nanosToSeconds(writeNanos), 100.0 * writeNanos / (translateNanos + writeNanos));
    System.out.printf("store triples   : %d -> %d (delta %d)%n", before, after, after - before);
    long deduped = triplesWritten - (after - before);
    if (deduped != 0) {
      // Entities that share a parent emit identical reference triples; RDF is a set, so
      // TDB2 stores one copy. A delta here is expected, not loss - it only becomes
      // suspicious if it approaches the total.
      System.out.printf(
          "deduplicated  : %d triples (%.1f%% - shared parent references)%n",
          deduped, 100.0 * deduped / triplesWritten);
    }
    storage.close();
  }

  private static double elapsedSeconds(long startNanos) {
    return Math.max(1e-9, nanosToSeconds(System.nanoTime() - startNanos));
  }

  private static double nanosToSeconds(long nanos) {
    return nanos / 1_000_000_000.0;
  }

  /** Realistic catalog entity: wide tables are what dominate serialized payload size. */
  private static Table table(int index, int columnCount) {
    List<Column> columns = new ArrayList<>(columnCount);
    for (int c = 0; c < columnCount; c++) {
      columns.add(
          new Column()
              .withName("col_" + c)
              .withDataType(ColumnDataType.VARCHAR)
              .withDataLength(255)
              .withDescription("Benchmark column " + c + " carrying a realistic description string")
              .withFullyQualifiedName("bench.db.schema.table_" + index + ".col_" + c));
    }
    UUID id = UUID.nameUUIDFromBytes(("bench-table-" + index).getBytes());
    return new Table()
        .withId(id)
        .withName("table_" + index)
        .withFullyQualifiedName("bench.db.schema.table_" + index)
        .withDisplayName("Benchmark table " + index)
        .withDescription("Synthetic table for RDF write-path benchmarking")
        .withColumns(columns)
        .withUpdatedAt(System.currentTimeMillis())
        .withUpdatedBy("benchmark")
        .withDatabaseSchema(
            new EntityReference()
                .withId(UUID.nameUUIDFromBytes("bench-schema".getBytes()))
                .withType("databaseSchema")
                .withName("schema")
                .withFullyQualifiedName("bench.db.schema"));
  }

  private static long triples(String endpoint) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(endpoint + "/sparql"))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .header("Accept", "application/sparql-results+json")
            .timeout(java.time.Duration.ofMinutes(5))
            .POST(
                HttpRequest.BodyPublishers.ofString(
                    "query="
                        + java.net.URLEncoder.encode(
                            "SELECT (COUNT(*) AS ?n) WHERE { GRAPH ?g { ?s ?p ?o } }",
                            java.nio.charset.StandardCharsets.UTF_8)))
            .build();
    HttpResponse<String> response =
        HttpClient.newBuilder()
            .connectTimeout(java.time.Duration.ofSeconds(10))
            .build()
            .send(request, HttpResponse.BodyHandlers.ofString());
    java.util.regex.Matcher matcher =
        java.util.regex.Pattern.compile("\"value\"\\s*:\\s*\"(\\d+)\"").matcher(response.body());
    return matcher.find() ? Long.parseLong(matcher.group(1)) : -1;
  }
}
