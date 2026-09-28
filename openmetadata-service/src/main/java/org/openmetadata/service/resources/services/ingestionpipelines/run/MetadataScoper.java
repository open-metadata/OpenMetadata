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

package org.openmetadata.service.resources.services.ingestionpipelines.run;

import jakarta.ws.rs.BadRequestException;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.Incremental;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Narrows a metadata run to one table. A metadata run marks what it does not see as deleted, and a
 * run scoped to one table sees nothing else: without switching that off, re-ingesting one table
 * would soft-delete every other table, schema, database and stored procedure it no longer saw.
 */
public class MetadataScoper implements SourceConfigScoper {

  private final TableFilterScoper tableFilterScoper;

  public MetadataScoper(TableFilterScoper tableFilterScoper) {
    this.tableFilterScoper = tableFilterScoper;
  }

  /**
   * An incremental pipeline starts each run from its last successful one, and a scoped run is a run
   * of the same pipeline: once it succeeded, the next scheduled run would skip changes made to every
   * other table before it.
   */
  @Override
  public void checkScopable(IngestionPipeline pipeline) {
    if (isIncremental(pipeline)) {
      throw new BadRequestException(
          String.format(
              "Ingestion pipeline '%s' extracts metadata incrementally, and a run scoped to one"
                  + " table would move the point its next scheduled run starts from.",
              pipeline.getFullyQualifiedName()));
    }
  }

  @Override
  public Map<String, Object> sourceConfigOverride(EntityInterface table) {
    Map<String, Object> override = new HashMap<>(tableFilterScoper.sourceConfigOverride(table));
    override.put("markDeletedTables", false);
    override.put("markDeletedSchemas", false);
    override.put("markDeletedDatabases", false);
    override.put("markDeletedStoredProcedures", false);
    // The schema filter still admits the table's whole schema, and stored procedures have no table.
    override.put("includeStoredProcedures", false);
    override.put("includeTables", true);
    return override;
  }

  private static boolean isIncremental(IngestionPipeline pipeline) {
    return Optional.ofNullable(pipeline.getSourceConfig().getConfig())
        .map(config -> JsonUtils.convertValue(config, DatabaseServiceMetadataPipeline.class))
        .map(DatabaseServiceMetadataPipeline::getIncremental)
        .map(Incremental::getEnabled)
        .orElse(false);
  }
}
