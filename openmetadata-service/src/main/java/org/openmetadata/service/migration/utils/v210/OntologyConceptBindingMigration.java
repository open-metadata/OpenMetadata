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

package org.openmetadata.service.migration.utils.v210;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.PreparedBatch;
import org.openmetadata.schema.type.OntologyAssetBinding;
import org.openmetadata.schema.type.OntologyBindingAssetType;
import org.openmetadata.schema.type.OntologyColumnBinding;
import org.openmetadata.schema.type.OntologyConceptBindings;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.OntologyConceptBindingStore;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/**
 * Copies every {@code ontology.conceptBindings} document into {@code ontology_concept_binding}
 * rows. Rows that already exist are left as they are, so a re-run never undoes an edit made through
 * the row store since the first run, and the documents are kept because they still carry each
 * concept's revision.
 */
@Slf4j
public final class OntologyConceptBindingMigration {
  private static final int DOCUMENT_PAGE_SIZE = 500;
  private static final int LOOKUP_CHUNK_SIZE = 1000;

  private OntologyConceptBindingMigration() {}

  public static void copyConceptBindingsToRows(
      final Handle handle, final ConnectionType connectionType) {
    copyConceptBindingsToRows(
        handle, connectionType, OntologyConceptBindingStore.registeredAssetTables());
  }

  static void copyConceptBindingsToRows(
      final Handle handle,
      final ConnectionType connectionType,
      final Function<OntologyBindingAssetType, String> tables) {
    final var copy = new Copy(handle, connectionType, tables, new Counts());
    List<Document> page = readDocuments(handle, "");
    while (!page.isEmpty()) {
      copy.copy(page);
      page = readDocuments(handle, page.getLast().conceptId());
    }
    copy.counts().log();
  }

  private static List<Document> readDocuments(final Handle handle, final String after) {
    return handle
        .createQuery(
            "SELECT id, json FROM entity_extension WHERE extension = :extension AND id > :after "
                + "ORDER BY id ASC LIMIT :limit")
        .bind("extension", OntologyConceptBindingStore.EXTENSION)
        .bind("after", after)
        .bind("limit", DOCUMENT_PAGE_SIZE)
        .map((rs, ctx) -> new Document(rs.getString("id"), rs.getString("json")))
        .list();
  }

  private static List<Row> rowsOf(final Document document, final Counts counts) {
    final OntologyConceptBindings bindings = parse(document, counts);
    if (bindings == null || bindings.getAssets() == null) {
      return List.of();
    }
    final UUID conceptId = UUID.fromString(document.conceptId());
    final List<Row> rows = new ArrayList<>();
    for (final OntologyAssetBinding binding : bindings.getAssets()) {
      if (binding.getAssetType() != null && binding.getAssetId() != null) {
        rows.add(new Row(conceptId, binding.getAssetId(), binding.getAssetType(), binding));
      }
    }
    return rows;
  }

  private static OntologyConceptBindings parse(final Document document, final Counts counts) {
    try {
      return JsonUtils.readValue(document.json(), OntologyConceptBindings.class);
    } catch (final RuntimeException e) {
      counts.unreadableDocuments++;
      LOG.warn("Skipping concept binding document {}: {}", document.conceptId(), e.getMessage());
      return null;
    }
  }

  private static Map<OntologyBindingAssetType, List<Row>> rowsByType(final List<Row> rows) {
    final Map<OntologyBindingAssetType, List<Row>> byType =
        new EnumMap<>(OntologyBindingAssetType.class);
    for (final Row row : rows) {
      byType.computeIfAbsent(row.assetType(), type -> new ArrayList<>()).add(row);
    }
    return byType;
  }

  private static List<OntologyColumnBinding> columnsOf(final OntologyAssetBinding binding) {
    return binding.getColumns() == null ? List.of() : binding.getColumns();
  }

  private static String insertSql(final ConnectionType connectionType) {
    return switch (connectionType) {
      case MYSQL -> "INSERT INTO ontology_concept_binding"
          + "(conceptId, assetId, assetType, assetFqnHash, columnBindings) "
          + "VALUES (:conceptId, :assetId, :assetType, :assetFqnHash, :columnBindings) "
          + "ON DUPLICATE KEY UPDATE conceptId = conceptId";
      case POSTGRES -> "INSERT INTO ontology_concept_binding"
          + "(conceptId, assetId, assetType, assetFqnHash, columnBindings) "
          + "VALUES (:conceptId, :assetId, :assetType, :assetFqnHash, "
          + "CAST(:columnBindings AS jsonb)) ON CONFLICT (conceptId, assetId) DO NOTHING";
    };
  }

  /** One run's connection, dialect, asset-table lookup and tallies. */
  private record Copy(
      Handle handle,
      ConnectionType connectionType,
      Function<OntologyBindingAssetType, String> tables,
      Counts counts) {

    void copy(final List<Document> page) {
      final List<Row> rows = new ArrayList<>();
      for (final Document document : page) {
        rows.addAll(rowsOf(document, counts));
      }
      insert(rows, fqnHashes(rows));
      counts.documents += page.size();
    }

    private void insert(final List<Row> rows, final Map<Row, String> fqnHashes) {
      final PreparedBatch batch = handle.prepareBatch(insertSql(connectionType));
      for (final Row row : rows) {
        final String fqnHash = fqnHashes.get(row);
        if (fqnHash == null) {
          counts.missingAssets++;
        } else {
          bind(batch, row, fqnHash);
          counts.rows++;
        }
      }
      if (batch.size() > 0) {
        batch.execute();
      }
    }

    private static void bind(final PreparedBatch batch, final Row row, final String fqnHash) {
      batch
          .bind("conceptId", row.conceptId().toString())
          .bind("assetId", row.assetId().toString())
          .bind("assetType", row.assetType().value())
          .bind("assetFqnHash", fqnHash)
          .bind("columnBindings", JsonUtils.pojoToJson(columnsOf(row.binding())))
          .add();
    }

    private Map<Row, String> fqnHashes(final List<Row> rows) {
      final Map<Row, String> hashes = new HashMap<>();
      rowsByType(rows)
          .forEach(
              (type, typed) -> {
                final Map<String, String> found = lookupHashes(tables.apply(type), typed);
                for (final Row row : typed) {
                  final String hash = found.get(row.assetId().toString());
                  if (hash != null) {
                    hashes.put(row, hash);
                  }
                }
              });
      return hashes;
    }

    private Map<String, String> lookupHashes(final String table, final List<Row> typed) {
      final Map<String, String> found = new HashMap<>();
      for (int start = 0; start < typed.size(); start += LOOKUP_CHUNK_SIZE) {
        final List<String> ids =
            typed.subList(start, Math.min(start + LOOKUP_CHUNK_SIZE, typed.size())).stream()
                .map(row -> row.assetId().toString())
                .distinct()
                .toList();
        handle
            .createQuery("SELECT id, fqnHash FROM " + table + " WHERE id IN (<ids>)")
            .bindList("ids", ids)
            .map((rs, ctx) -> Map.entry(rs.getString("id"), rs.getString("fqnHash")))
            .forEach(entry -> found.put(entry.getKey(), entry.getValue()));
      }
      return found;
    }
  }

  private record Document(String conceptId, String json) {}

  private record Row(
      UUID conceptId,
      UUID assetId,
      OntologyBindingAssetType assetType,
      OntologyAssetBinding binding) {}

  private static final class Counts {
    private int documents;
    private int rows;
    private int missingAssets;
    private int unreadableDocuments;

    void log() {
      LOG.info(
          "Copied {} concept binding documents into {} rows; skipped {} assets whose entity row is"
              + " gone and {} documents that did not parse",
          documents,
          rows,
          missingAssets,
          unreadableDocuments);
    }
  }
}
