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

package org.openmetadata.it.factories;

/**
 * Shape of the lineage graph {@link LineageGraphLoader} builds.
 *
 * <p>Deliberately separate from {@link EntityLoadSpec}: that loader puts every table in one schema
 * and wires edges as a ring, which is the right corpus for reindex throughput and the wrong one for
 * the hierarchical lineage scene API. {@code /v1/lineage/scene} drills service → database → schema →
 * asset, so a single-schema corpus makes the service, database and schema lenses trivially cheap;
 * and its expensive path fans out over a focused node's children, which a ring never exercises.
 *
 * <p>Every knob is a {@code jpw.lineage.*} system property so a CI matrix can sweep sizes, matching
 * the {@code jpw.scale.tables} convention the sibling scale ITs use. The defaults put the corpus
 * just past {@code mediumGraphThreshold} (50000) in {@code LineageGraphConfiguration}, which is the
 * smallest size at which the large-graph strategy is the one under test.
 */
public record LineageGraphSpec(
    int tables,
    int edges,
    int services,
    int databasesPerService,
    int schemasPerDatabase,
    int depth,
    int hubCount,
    int hubFanout,
    int columnsPerTable,
    double columnEdgeRatio,
    int parallelWorkers,
    long randomSeed) {

  public static final int DEFAULT_TABLES = 50_000;
  public static final int DEFAULT_EDGES = 50_000;
  public static final int DEFAULT_SERVICES = 20;
  public static final int DEFAULT_DATABASES_PER_SERVICE = 5;
  public static final int DEFAULT_SCHEMAS_PER_DATABASE = 5;
  public static final int DEFAULT_DEPTH = 8;
  public static final int DEFAULT_HUB_COUNT = 10;
  public static final int DEFAULT_HUB_FANOUT = 500;
  public static final int DEFAULT_COLUMNS_PER_TABLE = 5;
  public static final double DEFAULT_COLUMN_EDGE_RATIO = 0.2;
  public static final int DEFAULT_PARALLEL_WORKERS = 32;
  public static final long DEFAULT_RANDOM_SEED = 20260923L;

  public LineageGraphSpec {
    requirePositive(tables, "jpw.lineage.tables");
    requirePositive(services, "jpw.lineage.services");
    requirePositive(databasesPerService, "jpw.lineage.databasesPerService");
    requirePositive(schemasPerDatabase, "jpw.lineage.schemasPerDatabase");
    requirePositive(depth, "jpw.lineage.depth");
    requirePositive(columnsPerTable, "jpw.lineage.columnsPerTable");
  }

  /** Reads every knob from {@code -Djpw.lineage.*}, falling back to the defaults above. */
  public static LineageGraphSpec fromSystemProperties() {
    return new LineageGraphSpec(
        Integer.getInteger("jpw.lineage.tables", DEFAULT_TABLES),
        Integer.getInteger("jpw.lineage.edges", DEFAULT_EDGES),
        Integer.getInteger("jpw.lineage.services", DEFAULT_SERVICES),
        Integer.getInteger("jpw.lineage.databasesPerService", DEFAULT_DATABASES_PER_SERVICE),
        Integer.getInteger("jpw.lineage.schemasPerDatabase", DEFAULT_SCHEMAS_PER_DATABASE),
        Integer.getInteger("jpw.lineage.depth", DEFAULT_DEPTH),
        Integer.getInteger("jpw.lineage.hubCount", DEFAULT_HUB_COUNT),
        Integer.getInteger("jpw.lineage.hubFanout", DEFAULT_HUB_FANOUT),
        Integer.getInteger("jpw.lineage.columnsPerTable", DEFAULT_COLUMNS_PER_TABLE),
        doubleProperty("jpw.lineage.columnEdgeRatio", DEFAULT_COLUMN_EDGE_RATIO),
        Integer.getInteger("jpw.lineage.workers", DEFAULT_PARALLEL_WORKERS),
        Long.getLong("jpw.lineage.seed", DEFAULT_RANDOM_SEED));
  }

  public int databases() {
    return services * databasesPerService;
  }

  public int schemas() {
    return databases() * schemasPerDatabase;
  }

  /** Layer width when {@link #tables} are spread evenly over {@link #depth} layers. */
  public int layerWidth() {
    return Math.max(1, tables / depth);
  }

  private static double doubleProperty(final String key, final double fallback) {
    final String raw = System.getProperty(key);
    return (raw == null || raw.isBlank()) ? fallback : Double.parseDouble(raw);
  }

  private static void requirePositive(final int value, final String key) {
    if (value <= 0) {
      throw new IllegalArgumentException(key + " must be > 0 but was " + value);
    }
  }
}
