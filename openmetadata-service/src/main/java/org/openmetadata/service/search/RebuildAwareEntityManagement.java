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
package org.openmetadata.service.search;

import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.schema.api.entityRelationship.SearchSchemaEntityRelationshipResult;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;

/**
 * Sends every live write to the serving index and, while a rebuild stages a new index for it, to
 * the staged index too. The serving index stays current during the rebuild, and a rebuild that is
 * discarded, or whose server dies, loses no live write. A document write reaches the staged index
 * of exactly its own index; a write by query on a shared alias reaches every staged index.
 */
public final class RebuildAwareEntityManagement implements EntityManagementClient {
  private final EntityManagementClient delegate;
  private final Function<String, List<String>> documentTargets;
  private final Function<List<String>, List<String>> queryTargets;

  RebuildAwareEntityManagement(
      final EntityManagementClient delegate,
      final Function<String, List<String>> documentTargets,
      final Function<List<String>, List<String>> queryTargets) {
    this.delegate = delegate;
    this.documentTargets = documentTargets;
    this.queryTargets = queryTargets;
  }

  /** Routes {@code delegate}'s writes through the server's live rebuild routes. */
  public static EntityManagementClient around(final EntityManagementClient delegate) {
    return new RebuildAwareEntityManagement(
        delegate,
        RebuildAwareEntityManagement::liveDocumentTargets,
        RebuildAwareEntityManagement::liveQueryTargets);
  }

  private static List<String> liveDocumentTargets(final String index) {
    final SearchRepository repository = Entity.getSearchRepository();
    return repository == null ? List.of(index) : repository.getDocumentWriteTargets(index);
  }

  private static List<String> liveQueryTargets(final List<String> indexes) {
    final SearchRepository repository = Entity.getSearchRepository();
    return repository == null ? indexes : repository.getWriteFanoutTargets(indexes);
  }

  @FunctionalInterface
  private interface IndexWrite {
    void apply(String index) throws IOException;
  }

  private void toEachDocumentTarget(final String index, final IndexWrite write) throws IOException {
    for (final String target : documentTargets.apply(index)) {
      write.apply(target);
    }
  }

  private void toEachQueryTarget(final String index, final IndexWrite write) throws IOException {
    for (final String target : queryTargets.apply(List.of(index))) {
      write.apply(target);
    }
  }

  @Override
  public void createEntity(final String indexName, final String docId, final String doc)
      throws IOException {
    toEachDocumentTarget(indexName, target -> delegate.createEntity(target, docId, doc));
  }

  @Override
  public void createEntities(final String indexName, final List<Map<String, String>> docsAndIds)
      throws IOException {
    toEachDocumentTarget(indexName, target -> delegate.createEntities(target, docsAndIds));
  }

  @Override
  public void createTimeSeriesEntity(final String indexName, final String docId, final String doc)
      throws IOException {
    toEachDocumentTarget(indexName, target -> delegate.createTimeSeriesEntity(target, docId, doc));
  }

  @Override
  public void deleteEntity(final String indexName, final String docId) throws IOException {
    toEachDocumentTarget(indexName, target -> delegate.deleteEntity(target, docId));
  }

  @Override
  public void deleteEntityByFields(
      final List<String> indexNames, final List<Pair<String, String>> fieldAndValue)
      throws IOException {
    delegate.deleteEntityByFields(queryTargets.apply(indexNames), fieldAndValue);
  }

  @Override
  public void deleteEntityByFQNPrefix(final String indexName, final String fqnPrefix)
      throws IOException {
    toEachQueryTarget(indexName, target -> delegate.deleteEntityByFQNPrefix(target, fqnPrefix));
  }

  @Override
  public void deleteByScript(
      final String indexName, final String scriptTxt, final Map<String, Object> params)
      throws IOException {
    toEachQueryTarget(indexName, target -> delegate.deleteByScript(target, scriptTxt, params));
  }

  @Override
  public void softDeleteOrRestoreEntity(
      final String indexName,
      final String docId,
      final String scriptTxt,
      final Map<String, Object> params)
      throws IOException {
    toEachDocumentTarget(
        indexName, target -> delegate.softDeleteOrRestoreEntity(target, docId, scriptTxt, params));
  }

  @Override
  public void softDeleteOrRestoreChildren(
      final List<String> indexNames,
      final String scriptTxt,
      final List<Pair<String, String>> fieldAndValue)
      throws IOException {
    delegate.softDeleteOrRestoreChildren(queryTargets.apply(indexNames), scriptTxt, fieldAndValue);
  }

  @Override
  public void updateEntity(
      final String indexName,
      final String docId,
      final Map<String, Object> doc,
      final String scriptTxt) {
    documentTargets
        .apply(indexName)
        .forEach(target -> delegate.updateEntity(target, docId, doc, scriptTxt));
  }

  @Override
  public void updateEntity(
      final String indexName,
      final String docId,
      final Map<String, Object> doc,
      final String scriptTxt,
      final String entityType) {
    documentTargets
        .apply(indexName)
        .forEach(target -> delegate.updateEntity(target, docId, doc, scriptTxt, entityType));
  }

  @Override
  public void updateChildren(
      final String indexName,
      final Pair<String, String> fieldAndValue,
      final Pair<String, Map<String, Object>> updates) {
    delegate.updateChildren(indexName, fieldAndValue, updates);
  }

  @Override
  public void updateChildren(
      final List<String> indexNames,
      final Pair<String, String> fieldAndValue,
      final Pair<String, Map<String, Object>> updates)
      throws IOException {
    delegate.updateChildren(indexNames, fieldAndValue, updates);
  }

  @Override
  public void updateChildren(
      final List<String> indexNames,
      final String field,
      final List<String> values,
      final Pair<String, Map<String, Object>> updates)
      throws IOException {
    delegate.updateChildren(indexNames, field, values, updates);
  }

  @Override
  public Response getDocByID(final String indexName, final String entityId) throws IOException {
    return delegate.getDocByID(indexName, entityId);
  }

  @Override
  public void updateEntityRelationship(
      final String indexName,
      final Pair<String, String> fieldAndValue,
      final Map<String, Object> entityRelationshipData) {
    queryTargets
        .apply(List.of(indexName))
        .forEach(
            target ->
                delegate.updateEntityRelationship(target, fieldAndValue, entityRelationshipData));
  }

  @Override
  public void reindexWithEntityIds(
      final List<String> sourceIndices,
      final String destinationIndex,
      final String pipelineName,
      final String entityType,
      final List<UUID> entityIds) {
    delegate.reindexWithEntityIds(
        sourceIndices, destinationIndex, pipelineName, entityType, entityIds);
  }

  @Override
  public void updateByFqnPrefix(
      final String indexName,
      final String oldParentFQN,
      final String newParentFQN,
      final String prefixFieldCondition) {
    queryTargets
        .apply(List.of(indexName))
        .forEach(
            target ->
                delegate.updateByFqnPrefix(
                    target, oldParentFQN, newParentFQN, prefixFieldCondition));
  }

  @Override
  public void updateLineage(
      final String indexName,
      final Pair<String, String> fieldAndValue,
      final EsLineageData lineageData) {
    queryTargets
        .apply(List.of(indexName))
        .forEach(target -> delegate.updateLineage(target, fieldAndValue, lineageData));
  }

  @Override
  public void deleteByRangeQuery(
      final String index,
      final String fieldName,
      final Object gt,
      final Object gte,
      final Object lt,
      final Object lte)
      throws IOException {
    delegate.deleteByRangeQuery(index, fieldName, gt, gte, lt, lte);
  }

  @Override
  public void deleteByRangeAndTerm(
      final String index,
      final String rangeFieldName,
      final Object gt,
      final Object gte,
      final Object lt,
      final Object lte,
      final String termKey,
      final String termValue)
      throws IOException {
    delegate.deleteByRangeAndTerm(index, rangeFieldName, gt, gte, lt, lte, termKey, termValue);
  }

  @Override
  public void updateColumnsInUpstreamLineage(
      final String indexName, final HashMap<String, String> originalUpdatedColumnFqnMap) {
    queryTargets
        .apply(List.of(indexName))
        .forEach(
            target -> delegate.updateColumnsInUpstreamLineage(target, originalUpdatedColumnFqnMap));
  }

  @Override
  public void deleteColumnsInUpstreamLineage(
      final String indexName, final List<String> deletedColumns) {
    queryTargets
        .apply(List.of(indexName))
        .forEach(target -> delegate.deleteColumnsInUpstreamLineage(target, deletedColumns));
  }

  @Override
  public void reconcileColumnsInUpstreamLineage(
      final String indexName,
      final Map<String, String> renamedColumns,
      final List<String> deletedColumns) {
    queryTargets
        .apply(List.of(indexName))
        .forEach(
            target ->
                delegate.reconcileColumnsInUpstreamLineage(target, renamedColumns, deletedColumns));
  }

  @Override
  public void updateGlossaryTermByFqnPrefix(
      final String indexName,
      final String oldFqnPrefix,
      final String newFqnPrefix,
      final String prefixFieldCondition) {
    queryTargets
        .apply(List.of(indexName))
        .forEach(
            target ->
                delegate.updateGlossaryTermByFqnPrefix(
                    target, oldFqnPrefix, newFqnPrefix, prefixFieldCondition));
  }

  @Override
  public void updateClassificationTagByFqnPrefix(
      final String indexName,
      final String oldFqnPrefix,
      final String newFqnPrefix,
      final String prefixFieldCondition) {
    queryTargets
        .apply(List.of(indexName))
        .forEach(
            target ->
                delegate.updateClassificationTagByFqnPrefix(
                    target, oldFqnPrefix, newFqnPrefix, prefixFieldCondition));
  }

  @Override
  public void updateDataProductReferences(final String oldFqn, final String newFqn) {
    delegate.updateDataProductReferences(oldFqn, newFqn);
  }

  @Override
  public void updateAssetDomainsForDataProduct(
      final String dataProductFqn,
      final List<String> oldDomainFqns,
      final List<EntityReference> newDomains) {
    delegate.updateAssetDomainsForDataProduct(dataProductFqn, oldDomainFqns, newDomains);
  }

  @Override
  public void updateAssetDomainsByIds(
      final List<UUID> assetIds,
      final List<String> oldDomainFqns,
      final List<EntityReference> newDomains) {
    delegate.updateAssetDomainsByIds(assetIds, oldDomainFqns, newDomains);
  }

  @Override
  public void updateDomainFqnByPrefix(final String oldFqn, final String newFqn) {
    delegate.updateDomainFqnByPrefix(oldFqn, newFqn);
  }

  @Override
  public void updateAssetDomainFqnByPrefix(final String oldFqn, final String newFqn) {
    delegate.updateAssetDomainFqnByPrefix(oldFqn, newFqn);
  }

  @Override
  public void reindexEntities(final List<EntityReference> entities) throws IOException {
    delegate.reindexEntities(entities);
  }

  @Override
  public SearchSchemaEntityRelationshipResult getSchemaEntityRelationship(
      final String schemaFqn,
      final String queryFilter,
      final String includeSourceFields,
      final int offset,
      final int limit,
      final int from,
      final int size,
      final boolean deleted)
      throws IOException {
    return delegate.getSchemaEntityRelationship(
        schemaFqn, queryFilter, includeSourceFields, offset, limit, from, size, deleted);
  }
}
