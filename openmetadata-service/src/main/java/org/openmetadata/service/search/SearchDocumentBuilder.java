package org.openmetadata.service.search;

import static org.openmetadata.service.search.SearchClient.DEFAULT_UPDATE_SCRIPT;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.function.BiFunction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.Column;
import org.openmetadata.service.search.indexes.ColumnSearchIndex;
import org.openmetadata.service.search.indexes.DocBuildContext;
import org.openmetadata.service.search.indexes.PipelineExecutionIndex;
import org.openmetadata.service.search.indexes.SearchIndex;

/** Canonical document preparation; callers own target selection and transport batching. */
public final class SearchDocumentBuilder {
  private final BiFunction<String, Object, SearchIndex> indexes;

  public SearchDocumentBuilder(final BiFunction<String, Object, SearchIndex> indexes) {
    this.indexes = Objects.requireNonNull(indexes);
  }

  public Map<String, Object> build(final String entityType, final Object entity) {
    return new HashMap<>(indexes.apply(entityType, entity).buildSearchIndexDoc());
  }

  public Map<String, Object> buildColumn(final Column column, final Table table) {
    return new ColumnSearchIndex(column, table).buildSearchIndexDoc();
  }

  public Map<String, Object> buildPipelineExecution(
      final Pipeline pipeline, final PipelineStatus status) {
    return new PipelineExecutionIndex(pipeline, status).buildSearchIndexDoc();
  }

  public Map<String, Object> build(
      final String entityType, final Object entity, final DocBuildContext context) {
    return new HashMap<>(indexes.apply(entityType, entity).buildSearchIndexDoc(context));
  }

  public Map<String, Object> build(
      final String entityType,
      final EntityInterface<?> entity,
      final DocBuildContext context,
      final Long relationshipRevision) {
    final DocBuildContext effectiveContext =
        relationshipRevision == null
            ? context
            : DocBuildContext.of(
                context.prefetchedUpstreamLineage(),
                context.serviceStylePrefetch(),
                relationshipRevision);
    final Map<String, Object> document = build(entityType, entity, effectiveContext);
    SearchDocumentUpdates.applyRelationshipRevision(entity, document, relationshipRevision);
    return document;
  }

  public SearchDocumentUpdate prepareUpdate(
      final EntityInterface<?> entity, final Long relationshipRevision) {
    final ChangeDescription changes = SearchDocumentUpdates.getEffectiveChangeDescription(entity);
    final boolean nonVersioned =
        changes != null
            && entity.getChangeDescription() != null
            && Objects.equals(
                entity.getVersion(), entity.getChangeDescription().getPreviousVersion());
    final SearchDocumentUpdate partial =
        relationshipRevision == null
            ? SearchDocumentUpdates.buildScriptedPartialUpdate(entity, changes, nonVersioned)
            : null;
    return partial != null ? partial : prepareDocumentUpdate(entity, relationshipRevision);
  }

  public SearchDocumentUpdate prepareDocumentUpdate(
      final EntityInterface<?> entity, final Long relationshipRevision) {
    final String entityType = entity.getEntityReference().getType();
    final Map<String, Object> document =
        SearchIndexUtils.stripDocMapIfOversized(
            relationshipRevision == null
                ? build(entityType, entity)
                : build(entityType, entity, DocBuildContext.empty(), relationshipRevision),
            SearchClusterMetrics.DEFAULT_BULK_PAYLOAD_SIZE_BYTES,
            entity.getId().toString(),
            entityType);
    SearchDocumentUpdates.includeFieldRemovals(entity, document);
    return relationshipRevision == null
        ? preservingRelationships(entity, document)
        : SearchDocumentUpdates.relationshipReplacement(entity, document, relationshipRevision);
  }

  private SearchDocumentUpdate preservingRelationships(
      final EntityInterface<?> entity, final Map<String, Object> document) {
    final SearchDocumentUpdate preserving =
        SearchDocumentUpdates.buildRelationshipDocumentUpdate(entity, document);
    return preserving != null
        ? preserving
        : new SearchDocumentUpdate(DEFAULT_UPDATE_SCRIPT, document, true);
  }
}
