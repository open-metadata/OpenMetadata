/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.openlineage;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.api.lineage.openlineage.DatasetFacets;
import org.openmetadata.schema.api.lineage.openlineage.SymlinkIdentifier;
import org.openmetadata.schema.api.lineage.openlineage.SymlinksFacet;

/**
 * Normalizes OpenLineage dataset identifiers from different Spark catalog platforms into the
 * dot-form {@code [catalog.]schema.table} shape the entity resolver matches against.
 *
 * <p>Supported identifier forms (per the OpenLineage naming spec):
 *
 * <ul>
 *   <li>AWS Glue symlinks: {@code table/<database>/<table>} (namespace {@code arn:aws:glue:…})
 *   <li>Hive Metastore / Iceberg REST symlinks: {@code <database>.<table>}
 *   <li>Databricks Unity Catalog / BigQuery: {@code <catalog>.<schema>.<table>}
 *   <li>Hive warehouse paths: {@code …/<database>.db/<table>}
 *   <li>Short slash-form names without dots: {@code <database>/<table>}
 * </ul>
 *
 * <p>Each candidate carries the namespace of the identifier it came from (a symlink's own namespace,
 * e.g. a Glue ARN, or the dataset namespace) so the resolver can scope lookups by that namespace
 * rather than always falling back to the dataset namespace.
 */
public final class OpenLineageDatasetNameNormalizer {

  private static final String GLUE_TABLE_PREFIX = "table/";
  private static final String HIVE_WAREHOUSE_DB_SUFFIX = ".db";
  private static final int MAX_SLASH_SEGMENTS = 3;

  private static final Set<String> STORAGE_URI_SCHEMES =
      Set.of("gs://", "s3://", "s3a://", "abfss://", "abfs://", "wasbs://", "adl://");

  private OpenLineageDatasetNameNormalizer() {}

  /** A dot-form table-name candidate together with the namespace of the identifier it came from. */
  public record DatasetCandidate(String tableName, String namespace) {}

  /** Returns true when the namespace is a cloud object-storage URI (Glue/Iceberg physical path). */
  public static boolean isStorageNamespace(String namespace) {
    boolean result = false;
    if (!nullOrEmpty(namespace)) {
      String lower = namespace.toLowerCase(Locale.ROOT);
      for (String scheme : STORAGE_URI_SCHEMES) {
        if (lower.startsWith(scheme)) {
          result = true;
          break;
        }
      }
    }
    return result;
  }

  /**
   * Returns ordered, de-duplicated dot-form table-name candidates for a dataset: every symlink
   * identifier first (in event order), then the dataset name itself. Every candidate is guaranteed
   * to have at least two dot-separated parts; unparsable identifiers are skipped.
   *
   * <p>Symlink identifiers are a strong table signal, so their short slash-form names are honored.
   * The dataset name is only treated as a short slash-form {@code db/table} when its namespace is
   * not a storage URI — otherwise arbitrary object-storage paths like {@code folder/subfolder} would
   * synthesize spurious {@code folder.subfolder} candidates and risk false-positive edges.
   */
  public static List<DatasetCandidate> extractCandidates(
      String datasetNamespace, String datasetName, DatasetFacets facets) {
    Map<String, DatasetCandidate> candidates = new LinkedHashMap<>();
    for (SymlinkIdentifier identifier : symlinkIdentifiers(facets)) {
      addCandidate(candidates, normalize(identifier.getName(), true), identifier.getNamespace());
    }
    boolean datasetNameIsStrongSignal = !isStorageNamespace(datasetNamespace);
    addCandidate(candidates, normalize(datasetName, datasetNameIsStrongSignal), datasetNamespace);
    return List.copyOf(candidates.values());
  }

  private static List<SymlinkIdentifier> symlinkIdentifiers(DatasetFacets facets) {
    List<SymlinkIdentifier> result = List.of();
    SymlinksFacet symlinks = facets != null ? facets.getSymlinks() : null;
    if (symlinks != null && !nullOrEmpty(symlinks.getIdentifiers())) {
      result = symlinks.getIdentifiers();
    }
    return result;
  }

  private static void addCandidate(
      Map<String, DatasetCandidate> candidates, String tableName, String namespace) {
    if (tableName != null) {
      candidates.putIfAbsent(tableName, new DatasetCandidate(tableName, namespace));
    }
  }

  private static String normalize(String name, boolean allowShortSlash) {
    String result = null;
    if (!nullOrEmpty(name)) {
      String trimmed = name.trim();
      if (isGlueForm(trimmed)) {
        result = normalizeGlueForm(trimmed);
      } else if (trimmed.contains("/")) {
        result = normalizePathForm(trimmed, allowShortSlash);
      } else if (isDotForm(trimmed)) {
        result = trimmed;
      }
    }
    return result;
  }

  private static boolean isGlueForm(String name) {
    return name.startsWith(GLUE_TABLE_PREFIX) && name.split("/").length == 3;
  }

  private static String normalizeGlueForm(String name) {
    String[] segments = name.split("/");
    return segments[1] + "." + segments[2];
  }

  private static String normalizePathForm(String name, boolean allowShortSlash) {
    String[] segments = splitPathSegments(name);
    String result = normalizeHiveWarehousePath(segments);
    if (result == null && allowShortSlash && isShortSlashForm(name, segments)) {
      result = String.join(".", segments);
    }
    return result;
  }

  private static String[] splitPathSegments(String name) {
    return Arrays.stream(name.split("/"))
        .filter(segment -> !segment.isEmpty())
        .toArray(String[]::new);
  }

  private static String normalizeHiveWarehousePath(String[] segments) {
    String result = null;
    for (int i = segments.length - 2; i >= 0 && result == null; i--) {
      if (isHiveDatabaseSegment(segments[i])) {
        String database =
            segments[i].substring(0, segments[i].length() - HIVE_WAREHOUSE_DB_SUFFIX.length());
        result = database + "." + segments[i + 1];
      }
    }
    return result;
  }

  private static boolean isHiveDatabaseSegment(String segment) {
    return segment.endsWith(HIVE_WAREHOUSE_DB_SUFFIX)
        && segment.length() > HIVE_WAREHOUSE_DB_SUFFIX.length();
  }

  private static boolean isShortSlashForm(String name, String[] segments) {
    return !name.contains(".") && segments.length >= 2 && segments.length <= MAX_SLASH_SEGMENTS;
  }

  private static boolean isDotForm(String name) {
    String[] parts = name.split("\\.");
    boolean valid = parts.length >= 2;
    for (String part : parts) {
      valid = valid && !part.isEmpty();
    }
    return valid;
  }
}
