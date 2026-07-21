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
import java.util.LinkedHashSet;
import java.util.List;
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
 */
public final class OpenLineageDatasetNameNormalizer {

  private static final String GLUE_TABLE_PREFIX = "table/";
  private static final String HIVE_WAREHOUSE_DB_SUFFIX = ".db";
  private static final int MAX_SLASH_SEGMENTS = 3;

  private OpenLineageDatasetNameNormalizer() {}

  /**
   * Returns ordered, de-duplicated dot-form table-name candidates for a dataset: every symlink
   * identifier first (in event order), then the dataset name itself. Every candidate is guaranteed
   * to have at least two dot-separated parts; unparsable identifiers are skipped.
   */
  public static List<String> extractCandidates(
      String datasetNamespace, String datasetName, DatasetFacets facets) {
    Set<String> candidates = new LinkedHashSet<>();
    for (SymlinkIdentifier identifier : symlinkIdentifiers(facets)) {
      addCandidate(candidates, normalize(identifier.getNamespace(), identifier.getName()));
    }
    addCandidate(candidates, normalize(datasetNamespace, datasetName));
    return List.copyOf(candidates);
  }

  private static List<SymlinkIdentifier> symlinkIdentifiers(DatasetFacets facets) {
    List<SymlinkIdentifier> result = List.of();
    SymlinksFacet symlinks = facets != null ? facets.getSymlinks() : null;
    if (symlinks != null && !nullOrEmpty(symlinks.getIdentifiers())) {
      result = symlinks.getIdentifiers();
    }
    return result;
  }

  private static void addCandidate(Set<String> candidates, String candidate) {
    if (candidate != null) {
      candidates.add(candidate);
    }
  }

  private static String normalize(String namespace, String name) {
    String result = null;
    if (!nullOrEmpty(name)) {
      String trimmed = name.trim();
      if (isGlueForm(trimmed)) {
        result = normalizeGlueForm(trimmed);
      } else if (trimmed.contains("/")) {
        result = normalizePathForm(trimmed);
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

  private static String normalizePathForm(String name) {
    String[] segments = splitPathSegments(name);
    String result = normalizeHiveWarehousePath(segments);
    if (result == null && isShortSlashForm(name, segments)) {
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
