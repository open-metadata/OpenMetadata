package org.openmetadata.service.lineage;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.Entity.API_ENDPOINT;
import static org.openmetadata.service.Entity.CONTAINER;
import static org.openmetadata.service.Entity.DASHBOARD;
import static org.openmetadata.service.Entity.DASHBOARD_DATA_MODEL;
import static org.openmetadata.service.Entity.METRIC;
import static org.openmetadata.service.Entity.MLMODEL;
import static org.openmetadata.service.Entity.PIPELINE;
import static org.openmetadata.service.Entity.SEARCH_INDEX;
import static org.openmetadata.service.Entity.TABLE;
import static org.openmetadata.service.Entity.TOPIC;

import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MlFeature;
import org.openmetadata.service.Entity;

/**
 * The child names (columns / fields / features / charts) an entity exposes to column-level lineage.
 *
 * <p>This registry is the single source of truth for "which entity types can carry column lineage".
 * Lineage validation uses it to drop mappings naming a child the entity does not have, and {@link
 * #COLUMN_LINEAGE_SEARCH_INDICES} derives the set of search indices to reconcile on a column
 * rename/delete from its key set — so extending column lineage to a type is a single edit here.
 *
 * <p>Kept out of {@code LineageRepository} because that class holds a static search client and
 * cannot be initialized outside a running server.
 */
@Slf4j
public final class ColumnLineageChildren {

  private static final Map<String, Function<EntityReference, Set<String>>> CHILD_RESOLVERS =
      buildChildResolvers();

  /**
   * Entity types that can be the "to" side of a column-lineage edge. {@code upstreamLineage} is
   * stored on the "to" entity's document, so these are exactly the types whose search documents can
   * hold column lineage.
   */
  public static final Set<String> COLUMN_LINEAGE_ENTITY_TYPES = CHILD_RESOLVERS.keySet();

  /**
   * Comma-separated index selector for the column-lineage search reconciliation performed on column
   * rename/delete. Passed to {@code updateColumnsInUpstreamLineage} / {@code
   * deleteColumnsInUpstreamLineage}, which resolve each token through {@code
   * SearchRepository.getIndexOrAliasName}: entity types resolve to their mapped index name and pick
   * up the cluster alias, so this stays correct for Collate index mappings and for a prefixed
   * cluster without restating any index name. Narrower than the global alias, since only these
   * indices can hold {@code upstreamLineage.columns}.
   */
  public static final String COLUMN_LINEAGE_SEARCH_INDICES =
      String.join(",", COLUMN_LINEAGE_ENTITY_TYPES);

  /** Types deliberately excluded from column lineage, logged distinctly from a genuine typo. */
  private static final Set<String> UNSUPPORTED_TYPES = Set.of(METRIC, PIPELINE);

  private ColumnLineageChildren() {}

  private static Map<String, Function<EntityReference, Set<String>>> buildChildResolvers() {
    Map<String, Function<EntityReference, Set<String>>> resolvers = new LinkedHashMap<>();
    resolvers.put(TABLE, ColumnLineageChildren::tableColumnNames);
    resolvers.put(TOPIC, ColumnLineageChildren::topicFieldNames);
    resolvers.put(CONTAINER, ColumnLineageChildren::containerColumnNames);
    resolvers.put(DASHBOARD_DATA_MODEL, ColumnLineageChildren::dashboardDataModelColumnNames);
    resolvers.put(SEARCH_INDEX, ColumnLineageChildren::searchIndexFieldNames);
    resolvers.put(API_ENDPOINT, ColumnLineageChildren::apiEndpointFieldNames);
    resolvers.put(MLMODEL, ColumnLineageChildren::mlModelFeatureNames);
    resolvers.put(DASHBOARD, ColumnLineageChildren::dashboardChartNames);
    return Collections.unmodifiableMap(resolvers);
  }

  public static Set<String> getChildrenNames(EntityReference entityReference) {
    String entityType = entityReference.getType();
    Function<EntityReference, Set<String>> resolver = CHILD_RESOLVERS.get(entityType);
    Set<String> childrenNames;
    if (resolver != null) {
      childrenNames = resolver.apply(entityReference);
    } else {
      childrenNames = new HashSet<>();
      if (UNSUPPORTED_TYPES.contains(entityType)) {
        LOG.info("{} column level lineage is not supported", entityType);
      } else {
        LOG.error("Unsupported Entity Type {} for column lineage", entityType);
      }
    }
    return childrenNames;
  }

  private static Set<String> tableColumnNames(EntityReference entityReference) {
    Table table = Entity.getEntity(TABLE, entityReference.getId(), "columns", Include.NON_DELETED);
    return CommonUtil.getChildrenNames(
        table.getColumns(), "getChildren", table.getFullyQualifiedName());
  }

  private static Set<String> searchIndexFieldNames(EntityReference entityReference) {
    SearchIndex searchIndex =
        Entity.getEntity(SEARCH_INDEX, entityReference.getId(), "fields", Include.NON_DELETED);
    return CommonUtil.getChildrenNames(
        searchIndex.getFields(), "getChildren", searchIndex.getFullyQualifiedName());
  }

  private static Set<String> topicFieldNames(EntityReference entityReference) {
    Topic topic =
        Entity.getEntity(TOPIC, entityReference.getId(), "messageSchema", Include.NON_DELETED);
    Set<String> childrenNames;
    if (topic.getMessageSchema() == null || topic.getMessageSchema().getSchemaFields() == null) {
      childrenNames = new HashSet<>();
    } else {
      childrenNames =
          CommonUtil.getChildrenNames(
              topic.getMessageSchema().getSchemaFields(),
              "getChildren",
              topic.getFullyQualifiedName());
    }
    return childrenNames;
  }

  private static Set<String> containerColumnNames(EntityReference entityReference) {
    Container container =
        Entity.getEntity(CONTAINER, entityReference.getId(), "dataModel", Include.NON_DELETED);
    Set<String> childrenNames;
    if (container.getDataModel() == null || container.getDataModel().getColumns() == null) {
      childrenNames = new HashSet<>();
    } else {
      childrenNames =
          CommonUtil.getChildrenNames(
              container.getDataModel().getColumns(),
              "getChildren",
              container.getFullyQualifiedName());
    }
    return childrenNames;
  }

  private static Set<String> dashboardDataModelColumnNames(EntityReference entityReference) {
    DashboardDataModel dashboardDataModel =
        Entity.getEntity(
            DASHBOARD_DATA_MODEL, entityReference.getId(), "columns", Include.NON_DELETED);
    return CommonUtil.getChildrenNames(
        dashboardDataModel.getColumns(), "getChildren", dashboardDataModel.getFullyQualifiedName());
  }

  private static Set<String> dashboardChartNames(EntityReference entityReference) {
    Dashboard dashboard =
        Entity.getEntity(DASHBOARD, entityReference.getId(), "charts", Include.NON_DELETED);
    Set<String> childrenNames = new HashSet<>();
    for (EntityReference chart : listOrEmpty(dashboard.getCharts())) {
      childrenNames.add(
          chart.getFullyQualifiedName().replace(dashboard.getFullyQualifiedName() + ".", ""));
    }
    return childrenNames;
  }

  private static Set<String> mlModelFeatureNames(EntityReference entityReference) {
    MlModel mlModel = Entity.getEntity(MLMODEL, entityReference.getId(), "", Include.NON_DELETED);
    Set<String> childrenNames = new HashSet<>();
    for (MlFeature feature : listOrEmpty(mlModel.getMlFeatures())) {
      childrenNames.add(
          feature.getFullyQualifiedName().replace(mlModel.getFullyQualifiedName() + ".", ""));
    }
    return childrenNames;
  }

  private static Set<String> apiEndpointFieldNames(EntityReference entityReference) {
    APIEndpoint apiEndpoint =
        Entity.getEntity(
            API_ENDPOINT,
            entityReference.getId(),
            "responseSchema,requestSchema",
            Include.NON_DELETED);
    Set<String> childrenNames = new HashSet<>();
    if (apiEndpoint.getResponseSchema() != null) {
      childrenNames.addAll(
          CommonUtil.getChildrenNames(
              listOrEmpty(apiEndpoint.getResponseSchema().getSchemaFields()),
              "getChildren",
              apiEndpoint.getFullyQualifiedName()));
    }
    if (apiEndpoint.getRequestSchema() != null) {
      childrenNames.addAll(
          CommonUtil.getChildrenNames(
              listOrEmpty(apiEndpoint.getRequestSchema().getSchemaFields()),
              "getChildren",
              apiEndpoint.getFullyQualifiedName()));
    }
    return childrenNames;
  }
}
