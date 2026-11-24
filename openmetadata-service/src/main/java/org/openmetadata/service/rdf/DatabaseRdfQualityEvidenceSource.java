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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.jdbi3.TimeSeriesDAOs.ProfilerDataTimeSeriesDAO.TABLE_COLUMN_PROFILE_EXTENSION;
import static org.openmetadata.service.jdbi3.TimeSeriesDAOs.ProfilerDataTimeSeriesDAO.TABLE_PROFILE_EXTENSION;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnProfile;
import org.openmetadata.schema.type.EntityProfile;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TableProfile;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityProfileRepository;
import org.openmetadata.service.jdbi3.TimeSeriesDAOs.LatestRecordWithFQNHash;
import org.openmetadata.service.jdbi3.TimeSeriesDAOs.ProfilerDataTimeSeriesDAO.LatestExtensionRecord;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;

/** Reads the newest profile and result rows in batches, as the table and test case APIs do. */
final class DatabaseRdfQualityEvidenceSource implements RdfQualityEvidenceSource {
  private static final String TESTED_TABLE_FIELDS = "columns,tags";

  @Override
  public Map<String, TableProfile> latestTableProfiles(final List<String> tableFqns) {
    return latestProfiles(tableFqns, TABLE_PROFILE_EXTENSION, TableProfile.class);
  }

  @Override
  public Map<String, ColumnProfile> latestColumnProfiles(final List<String> columnFqns) {
    return latestProfiles(columnFqns, TABLE_COLUMN_PROFILE_EXTENSION, ColumnProfile.class);
  }

  @Override
  public Map<String, TestCaseResult> latestTestCaseResults(final List<String> testCaseFqns) {
    return latestTestRecords(
        testCaseFqns,
        fqns -> Entity.getCollectionDAO().dataQualityDataTimeSeriesDao().getLatestRecordBatch(fqns),
        TestCaseResult.class);
  }

  /** The tags a table read with tags gives each column, derived glossary tags included. */
  @Override
  public Map<String, List<TagLabel>> columnTags(final Table table) {
    final List<Column> columns = JsonUtils.deepCopyList(table.getColumns(), Column.class);
    Entity.populateEntityFieldTags(Entity.TABLE, columns, table.getFullyQualifiedName(), true);
    final Map<String, List<TagLabel>> tags = new HashMap<>();
    EntityUtil.getFlattenedEntityField(columns)
        .forEach(column -> tags.put(column.getFullyQualifiedName(), listOrEmpty(column.getTags())));
    return tags;
  }

  @Override
  public Map<String, TestCaseResolutionStatus> latestIncidentStatuses(
      final List<String> testCaseFqns) {
    return latestTestRecords(
        testCaseFqns,
        fqns ->
            Entity.getCollectionDAO()
                .testCaseResolutionStatusTimeSeriesDao()
                .getLatestRecordBatch(fqns),
        TestCaseResolutionStatus.class);
  }

  @Override
  public Optional<Table> liveTable(final String tableFqn) {
    try {
      return Optional.of(
          Entity.getEntityByName(Entity.TABLE, tableFqn, TESTED_TABLE_FIELDS, Include.NON_DELETED));
    } catch (EntityNotFoundException missing) {
      return Optional.empty();
    }
  }

  private static <T> Map<String, T> latestTestRecords(
      final List<String> fqns,
      final Function<List<String>, List<LatestRecordWithFQNHash>> batchRead,
      final Class<T> recordType) {
    if (fqns.isEmpty()) {
      return Map.of();
    }
    final Map<String, String> jsonByHash = new HashMap<>();
    batchRead.apply(fqns).forEach(row -> jsonByHash.put(row.getEntityFQNHash(), row.getJson()));
    return byFqn(fqns, jsonByHash, json -> JsonUtils.readValue(json, recordType));
  }

  private static <T> Map<String, T> latestProfiles(
      final List<String> fqns, final String extension, final Class<T> profileType) {
    final List<LatestExtensionRecord> records =
        EntityDAO.queryInChunks(
            fqns,
            chunk ->
                Entity.getCollectionDAO()
                    .profilerDataTimeSeriesDao()
                    .getLatestExtensionsBatch(chunk, extension));
    final Map<String, String> jsonByHash = new HashMap<>();
    records.forEach(row -> jsonByHash.put(row.entityFQNHash(), row.json()));
    return byFqn(fqns, jsonByHash, json -> profileData(json, profileType));
  }

  private static <T> T profileData(final String json, final Class<T> profileType) {
    final EntityProfile stored = JsonUtils.readValue(json, EntityProfile.class);
    return profileType.cast(
        EntityProfileRepository.deserializeProfileData(stored).getProfileData());
  }

  private static <T> Map<String, T> byFqn(
      final List<String> fqns,
      final Map<String, String> jsonByHash,
      final Function<String, T> reader) {
    final Map<String, T> values = new HashMap<>();
    for (final String fqn : fqns) {
      final String json = jsonByHash.get(FullyQualifiedName.buildHash(fqn));
      if (json != null) {
        values.put(fqn, reader.apply(json));
      }
    }
    return values;
  }
}
