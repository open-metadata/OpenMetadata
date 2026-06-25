package org.openmetadata.service.migration.utils.v1131;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.List;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.function.ToIntFunction;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.data.Worksheet;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.MlFeature;
import org.openmetadata.schema.type.MlFeatureSource;
import org.openmetadata.schema.type.SearchIndexField;
import org.openmetadata.schema.type.Task;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.Workflow;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Repairs nested child FQNs that were persisted in an unparseable form before double-quote
 * escaping was supported in the FQN grammar.
 *
 * <p>Nested child FQNs (table, dashboard data model and worksheet columns, container data-model
 * columns, topic and API-endpoint schema fields, search-index fields, ML model features and
 * feature sources, pipeline tasks) are derived from the child {@code name} but are not
 * hash-validated at insert time, so a child whose name contained a {@code "} was stored with a
 * corrupt segment that could not be parsed or hashed, making later tag/owner reads fail with a
 * 500. This one-time migration re-derives any unparseable child FQN from its parent FQN and the
 * child name and persists the corrected value, so the corruption leaves the stored data and reads
 * pay no per-request cost.
 *
 * <p>Each entity table is scanned in pages (no per-row query), only changed rows are written, and
 * any entity that cannot be repaired is counted and sampled in the completion log so operators
 * have a concrete remediation list. Repaired FQNs reach the search index on the standard
 * post-upgrade reindex.
 */
@Slf4j
public class MigrationUtil {

  private static final int PAGE_SIZE = 1000;
  private static final int MAX_REPORTED_FAILURES = 100;
  // Mirrors the literal segments APIEndpointRepository#setFullyQualifiedName inserts between the
  // endpoint FQN and its request/response schema fields.
  private static final String REQUEST_SCHEMA_FQN_SEGMENT = ".requestSchema";
  private static final String RESPONSE_SCHEMA_FQN_SEGMENT = ".responseSchema";

  private static final FqnAccessor<Column> COLUMN_ACCESSOR =
      new FqnAccessor<>(
          Column::getName,
          Column::getFullyQualifiedName,
          Column::setFullyQualifiedName,
          Column::getChildren);
  private static final FqnAccessor<Field> FIELD_ACCESSOR =
      new FqnAccessor<>(
          Field::getName,
          Field::getFullyQualifiedName,
          Field::setFullyQualifiedName,
          Field::getChildren);
  private static final FqnAccessor<SearchIndexField> SEARCH_INDEX_FIELD_ACCESSOR =
      new FqnAccessor<>(
          SearchIndexField::getName,
          SearchIndexField::getFullyQualifiedName,
          SearchIndexField::setFullyQualifiedName,
          SearchIndexField::getChildren);
  private static final FqnAccessor<Task> TASK_ACCESSOR =
      new FqnAccessor<>(
          Task::getName, Task::getFullyQualifiedName, Task::setFullyQualifiedName, task -> null);
  private static final FqnAccessor<MlFeature> ML_FEATURE_ACCESSOR =
      new FqnAccessor<>(
          MlFeature::getName,
          MlFeature::getFullyQualifiedName,
          MlFeature::setFullyQualifiedName,
          feature -> null);

  private MigrationUtil() {}

  /**
   * Regenerate and redeploy every governance workflow's BPMN from the current code.
   *
   * <p>Seeded workflow definitions are deployed to Flowable only when first created
   * ({@code initializeEntity} is create-only), so a jar upgrade that changes the generated BPMN —
   * e.g. adding the {@code global_relatedEntityId} CallActivity InParameter that lets approval nodes
   * resolve the entity by its immutable id after a move/rename — never reaches already-installed
   * environments. Their Flowable process definition stays on the old BPMN, so newly started
   * instances never receive {@code relatedEntityId}, fall back to the now-stale FQN, and throw
   * {@code EntityNotFoundException} on resolve. Redeploying each definition here makes the deployed
   * BPMN track the code again. In-flight instances keep their old definition version (Flowable
   * preserves deployments that still have running instances); only newly started instances use the
   * regenerated definition.
   */
  public static void redeployGovernanceWorkflows() {
    WorkflowDefinitionRepository repository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
    List<WorkflowDefinition> workflows =
        repository.listAll(EntityUtil.Fields.EMPTY_FIELDS, new ListFilter());
    WorkflowHandler workflowHandler = WorkflowHandler.getInstance();
    int redeployed = 0;
    for (WorkflowDefinition workflow : workflows) {
      try {
        workflowHandler.deploy(new Workflow(workflow));
        redeployed++;
      } catch (Exception e) {
        LOG.warn(
            "[1.13.1] Failed to redeploy workflow definition '{}'; continuing",
            workflow.getFullyQualifiedName(),
            e);
      }
    }
    LOG.info(
        "[1.13.1] Redeployed {} of {} governance workflow definition(s)",
        redeployed,
        workflows.size());
  }

  public static List<RepairSummary> repairChildFqns(CollectionDAO collectionDAO) {
    List<RepairSummary> summaries = new ArrayList<>();
    summaries.add(
        repairEntityType(
            new EntityRepair<>(
                Entity.TABLE, collectionDAO.tableDAO(), Table.class, MigrationUtil::repairTable)));
    summaries.add(
        repairEntityType(
            new EntityRepair<>(
                Entity.DASHBOARD_DATA_MODEL,
                collectionDAO.dashboardDataModelDAO(),
                DashboardDataModel.class,
                MigrationUtil::repairDashboardDataModel)));
    summaries.add(
        repairEntityType(
            new EntityRepair<>(
                Entity.CONTAINER,
                collectionDAO.containerDAO(),
                Container.class,
                MigrationUtil::repairContainer)));
    summaries.add(
        repairEntityType(
            new EntityRepair<>(
                Entity.WORKSHEET,
                collectionDAO.worksheetDAO(),
                Worksheet.class,
                MigrationUtil::repairWorksheet)));
    summaries.add(
        repairEntityType(
            new EntityRepair<>(
                Entity.TOPIC, collectionDAO.topicDAO(), Topic.class, MigrationUtil::repairTopic)));
    summaries.add(
        repairEntityType(
            new EntityRepair<>(
                Entity.SEARCH_INDEX,
                collectionDAO.searchIndexDAO(),
                SearchIndex.class,
                MigrationUtil::repairSearchIndex)));
    summaries.add(
        repairEntityType(
            new EntityRepair<>(
                Entity.API_ENDPOINT,
                collectionDAO.apiEndpointDAO(),
                APIEndpoint.class,
                MigrationUtil::repairApiEndpoint)));
    summaries.add(
        repairEntityType(
            new EntityRepair<>(
                Entity.MLMODEL,
                collectionDAO.mlModelDAO(),
                MlModel.class,
                MigrationUtil::repairMlModel)));
    summaries.add(
        repairEntityType(
            new EntityRepair<>(
                Entity.PIPELINE,
                collectionDAO.pipelineDAO(),
                Pipeline.class,
                MigrationUtil::repairPipeline)));
    return summaries;
  }

  private static <T extends EntityInterface> RepairSummary repairEntityType(
      EntityRepair<T> repair) {
    List<String> failedEntityIds = new ArrayList<>();
    int scanned = 0;
    int repairedChildren = 0;
    int repairedEntities = 0;
    int failedEntities = 0;
    int offset = 0;
    List<String> page = repair.entityDAO().listAfterWithOffset(PAGE_SIZE, offset);
    while (!page.isEmpty()) {
      for (String json : page) {
        scanned++;
        RowRepair rowRepair = repairRow(repair, json, failedEntityIds);
        repairedChildren += rowRepair.childCount();
        repairedEntities += rowRepair.childCount() > 0 ? 1 : 0;
        failedEntities += rowRepair.failed() ? 1 : 0;
      }
      offset += PAGE_SIZE;
      page = repair.entityDAO().listAfterWithOffset(PAGE_SIZE, offset);
    }
    RepairSummary summary =
        new RepairSummary(
            repair.entityType(), scanned, repairedEntities, repairedChildren, failedEntities);
    logSummary(summary, failedEntityIds);
    return summary;
  }

  private static <T extends EntityInterface> RowRepair repairRow(
      EntityRepair<T> repair, String json, List<String> failedEntityIds) {
    int childCount = 0;
    boolean failed = false;
    String entityId = null;
    try {
      T entity = JsonUtils.readValue(json, repair.entityClass());
      entityId = entity.getId().toString();
      childCount = repair.childRepairer().applyAsInt(entity);
      if (childCount > 0) {
        repair.entityDAO().update(entity);
      }
    } catch (Exception e) {
      failed = true;
      // Persistence failed: nothing was written, so this row must not count as repaired.
      childCount = 0;
      recordFailure(failedEntityIds, repair.entityType(), entityId, e);
    }
    return new RowRepair(childCount, failed);
  }

  private static int repairTable(Table table) {
    return repairTree(table.getFullyQualifiedName(), table.getColumns(), COLUMN_ACCESSOR);
  }

  private static int repairDashboardDataModel(DashboardDataModel dataModel) {
    return repairTree(dataModel.getFullyQualifiedName(), dataModel.getColumns(), COLUMN_ACCESSOR);
  }

  private static int repairContainer(Container container) {
    return container.getDataModel() == null
        ? 0
        : repairTree(
            container.getFullyQualifiedName(),
            container.getDataModel().getColumns(),
            COLUMN_ACCESSOR);
  }

  private static int repairWorksheet(Worksheet worksheet) {
    return repairTree(worksheet.getFullyQualifiedName(), worksheet.getColumns(), COLUMN_ACCESSOR);
  }

  private static int repairTopic(Topic topic) {
    return topic.getMessageSchema() == null
        ? 0
        : repairTree(
            topic.getFullyQualifiedName(),
            topic.getMessageSchema().getSchemaFields(),
            FIELD_ACCESSOR);
  }

  private static int repairSearchIndex(SearchIndex searchIndex) {
    return repairTree(
        searchIndex.getFullyQualifiedName(), searchIndex.getFields(), SEARCH_INDEX_FIELD_ACCESSOR);
  }

  private static int repairApiEndpoint(APIEndpoint endpoint) {
    int repaired = 0;
    if (endpoint.getRequestSchema() != null) {
      repaired +=
          repairTree(
              endpoint.getFullyQualifiedName() + REQUEST_SCHEMA_FQN_SEGMENT,
              endpoint.getRequestSchema().getSchemaFields(),
              FIELD_ACCESSOR);
    }
    if (endpoint.getResponseSchema() != null) {
      repaired +=
          repairTree(
              endpoint.getFullyQualifiedName() + RESPONSE_SCHEMA_FQN_SEGMENT,
              endpoint.getResponseSchema().getSchemaFields(),
              FIELD_ACCESSOR);
    }
    return repaired;
  }

  private static int repairMlModel(MlModel mlModel) {
    int repaired =
        repairTree(mlModel.getFullyQualifiedName(), mlModel.getMlFeatures(), ML_FEATURE_ACCESSOR);
    for (MlFeature feature : listOrEmpty(mlModel.getMlFeatures())) {
      repaired += repairFeatureSources(feature.getFeatureSources());
    }
    return repaired;
  }

  private static int repairFeatureSources(List<MlFeatureSource> sources) {
    int repaired = 0;
    for (MlFeatureSource source : listOrEmpty(sources)) {
      repaired +=
          repairChildFqn(
              source.getFullyQualifiedName(),
              () -> deriveFeatureSourceFqn(source),
              source::setFullyQualifiedName);
    }
    return repaired;
  }

  /**
   * Mirrors MlModelRepository#setMlFeatureSourcesFQN except that a source without a data source is
   * encoded with {@link FullyQualifiedName#quoteName(String)}: the write path stores the raw name,
   * which for names containing '"' is exactly the unparseable form this migration removes.
   */
  private static String deriveFeatureSourceFqn(MlFeatureSource source) {
    return source.getDataSource() != null
        ? FullyQualifiedName.add(source.getDataSource().getFullyQualifiedName(), source.getName())
        : FullyQualifiedName.quoteName(source.getName());
  }

  private static int repairPipeline(Pipeline pipeline) {
    return repairTree(pipeline.getFullyQualifiedName(), pipeline.getTasks(), TASK_ACCESSOR);
  }

  private static <T> int repairTree(String parentFqn, List<T> children, FqnAccessor<T> accessor) {
    int repaired = 0;
    for (T child : listOrEmpty(children)) {
      repaired +=
          repairChildFqn(
              accessor.fqn().apply(child),
              () -> FullyQualifiedName.add(parentFqn, accessor.name().apply(child)),
              value -> accessor.setFqn().accept(child, value));
      // Recurse with the (possibly just repaired) child FQN so grandchildren re-derive from it.
      repaired +=
          repairTree(accessor.fqn().apply(child), accessor.children().apply(child), accessor);
    }
    return repaired;
  }

  private static int repairChildFqn(
      String currentFqn, Supplier<String> rederive, Consumer<String> setFqn) {
    int repaired = 0;
    if (!FullyQualifiedName.isValid(currentFqn)) {
      String rederivedFqn = rederive.get();
      if (!FullyQualifiedName.isValid(rederivedFqn)) {
        throw new IllegalArgumentException(
            String.format(
                "Cannot repair child FQN '%s': re-derived FQN '%s' is also unparseable",
                currentFqn, rederivedFqn));
      }
      setFqn.accept(rederivedFqn);
      repaired = 1;
    }
    return repaired;
  }

  private static void recordFailure(
      List<String> failedEntityIds, String entityType, String entityId, Exception e) {
    String id = nullOrEmpty(entityId) ? "<unreadable-" + entityType + "-json>" : entityId;
    LOG.warn("Failed to repair child FQNs for {} {}: {}", entityType, id, e.getMessage());
    if (failedEntityIds.size() < MAX_REPORTED_FAILURES) {
      failedEntityIds.add(id);
    }
  }

  private static void logSummary(RepairSummary summary, List<String> failedEntityIds) {
    LOG.info(
        "{} child FQN repair complete: scanned {} entities, re-derived {} child FQNs across {} entities. "
            + "Repaired FQNs are reflected in search after the standard post-upgrade reindex.",
        summary.entityType(),
        summary.scanned(),
        summary.repairedChildren(),
        summary.repairedEntities());
    if (summary.failedEntities() > 0) {
      LOG.warn(
          "{} child FQN repair could not fix {} entity(ies); they retain unparseable child FQNs "
              + "and need manual remediation. First {} id(s): {}",
          summary.entityType(),
          summary.failedEntities(),
          MAX_REPORTED_FAILURES,
          failedEntityIds);
    }
  }

  private record FqnAccessor<T>(
      Function<T, String> name,
      Function<T, String> fqn,
      BiConsumer<T, String> setFqn,
      Function<T, List<T>> children) {}

  private record EntityRepair<T extends EntityInterface>(
      String entityType,
      EntityDAO<T> entityDAO,
      Class<T> entityClass,
      ToIntFunction<T> childRepairer) {}

  private record RowRepair(int childCount, boolean failed) {}

  public record RepairSummary(
      String entityType,
      int scanned,
      int repairedEntities,
      int repairedChildren,
      int failedEntities) {}
}
