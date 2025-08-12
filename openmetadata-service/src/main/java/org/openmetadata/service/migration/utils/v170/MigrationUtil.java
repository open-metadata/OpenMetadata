package org.openmetadata.service.migration.utils.v170;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.LineChart;
import org.openmetadata.schema.dataInsight.custom.LineChartMetric;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.governance.workflows.WorkflowConfiguration;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.EntityInterfaceUtil;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.governance.workflows.flowable.MainWorkflow;
import org.openmetadata.service.jdbi3.AppMarketPlaceRepository;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.DataInsightSystemChartRepository;
import org.openmetadata.service.jdbi3.DataProductRepository;
import org.openmetadata.service.jdbi3.DomainRepository;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.PolicyRepository;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.resources.databases.DatasourceConfig;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class MigrationUtil {
  static final Map<String, List<String>> SERVICE_TYPE_ENTITY_MAP = new HashMap<>();

  static {
    SERVICE_TYPE_ENTITY_MAP.put(Entity.DATABASE_SERVICE, List.of("table_entity"));
    SERVICE_TYPE_ENTITY_MAP.put(Entity.MESSAGING_SERVICE, List.of("topic_entity"));
    SERVICE_TYPE_ENTITY_MAP.put(
        Entity.DASHBOARD_SERVICE, List.of("dashboard_entity", "dashboard_data_model_entity"));
    SERVICE_TYPE_ENTITY_MAP.put(Entity.PIPELINE_SERVICE, List.of("pipeline_entity"));
    SERVICE_TYPE_ENTITY_MAP.put(Entity.MLMODEL_SERVICE, List.of("ml_model_entity"));
    SERVICE_TYPE_ENTITY_MAP.put(Entity.STORAGE_SERVICE, List.of("storage_container_entity"));
    SERVICE_TYPE_ENTITY_MAP.put(Entity.SEARCH_SERVICE, List.of("search_index_entity"));
    SERVICE_TYPE_ENTITY_MAP.put(Entity.API_SERVICE, List.of("api_endpoint_entity"));
  }

  private MigrationUtil() {}

  public static final String DOMAIN_AND_PRODUCTS_LINEAGE =
      "select count(*) from entity_relationship where fromId in (select toId from entity_relationship where fromId = '%s' and relation = 10) AND toId in (select toId from entity_relationship where fromId = '%s' and relation = 10) and relation = 13";

  public static final String SERVICE_ENTITY_MIGRATION =
      "SELECT COUNT(*) FROM entity_relationship er JOIN %s f ON er.fromID = f.id JOIN %s t ON er.toID = t.id WHERE er.relation = 13 AND f.fqnHash LIKE '%s.%%' AND t.fqnHash LIKE '%s.%%'";
  private static final String UPDATE_NULL_JSON_MYSQL =
      "UPDATE entity_relationship SET json = :json WHERE json IS NULL AND relation = 13";
  private static final String UPDATE_NULL_JSON_POSTGRESQL =
      "UPDATE entity_relationship SET json = :json::jsonb WHERE json IS NULL AND relation = 13";
  private static final String UPDATE_NON_NULL_MYSQL_JSON =
      "UPDATE entity_relationship SET json = JSON_SET(json, '$.createdAt', IFNULL(CAST(json->>'$.createdAt' AS UNSIGNED), :currTime), '$.createdBy', IFNULL(JSON_UNQUOTE(json->>'$.createdBy'), 'admin'), '$.updatedAt', IFNULL(CAST(json->>'$.updatedAt' AS UNSIGNED), :currTime), '$.updatedBy', IFNULL(JSON_UNQUOTE(json->>'$.updatedBy'), 'admin')) WHERE "
          + "relation = 13 AND json IS NOT NULL AND (json->>'$.createdAt' IS NULL OR JSON_UNQUOTE(json->>'$.createdBy') IS NULL OR json->>'$.updatedAt' IS NULL OR JSON_UNQUOTE(json->>'$.updatedBy') IS NULL)";

  private static final String UPDATE_NON_NULL_POSTGRES_JSON =
      "UPDATE entity_relationship SET json = jsonb_set(jsonb_set(jsonb_set(jsonb_set(json, '{createdAt}', COALESCE((json->>'createdAt')::bigint, :currTime)::text::jsonb, true), '{createdBy}', COALESCE(json->>'createdBy', '\"admin\"')::jsonb, true), '{updatedAt}', COALESCE((json->>'updatedAt')::bigint, :currTime)::text::jsonb, true), '{updatedBy}', COALESCE(json->>'updatedBy', '\"admin\"')::jsonb, true) WHERE relation = 13 AND json IS NOT NULL AND (json->>'createdAt' IS NULL OR json->>'createdBy' IS NULL OR json->>'updatedAt' IS NULL OR json->>'updatedBy' IS NULL)";

  public static void runLineageMigrationForNullColumn(Handle handle) {
    try {
      LOG.info("MIGRATION 1.7.0 - STARTING MIGRATION FOR NULL JSON");
      long currentTime = System.currentTimeMillis();
      LineageDetails lineageDetails =
          new LineageDetails()
              .withCreatedAt(currentTime)
              .withUpdatedAt(currentTime)
              .withCreatedBy(ADMIN_USER_NAME)
              .withUpdatedBy(ADMIN_USER_NAME);
      String updateSql =
          Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())
              ? UPDATE_NULL_JSON_MYSQL
              : UPDATE_NULL_JSON_POSTGRESQL;
      int result =
          handle
              .createUpdate(updateSql)
              .bind("json", JsonUtils.pojoToJson(lineageDetails))
              .execute();
      if (result <= 0) {
        LOG.info("No null json rows to get updated createdAt, createdBy, updatedAt and updatedBy");
      }
    } catch (Exception ex) {
      LOG.error(
          "Error while updating null json rows with createdAt, createdBy, updatedAt and updatedBy for lineage.",
          ex);
    }
  }

  public static void runLineageMigrationForNonNullColumn(Handle handle) {
    try {
      LOG.info("MIGRATION 1.7.0 - STARTING MIGRATION FOR NON NULL JSON");
      long currentTime = System.currentTimeMillis();
      String updateSql =
          Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())
              ? UPDATE_NON_NULL_MYSQL_JSON
              : UPDATE_NON_NULL_POSTGRES_JSON;
      int result = handle.createUpdate(updateSql).bind("currTime", currentTime).execute();
      if (result <= 0) {
        LOG.info(
            "No non null json rows to get updated createdAt, createdBy, updatedAt and updatedBy");
      }
    } catch (Exception ex) {
      LOG.error(
          "Error while updating non null json rows with createdAt, createdBy, updatedAt and updatedBy for lineage.",
          ex);
    }
  }

  public static void updateDataInsightsApplication() {
    try {
      // Delete DataInsightsApplication - It will be recreated on AppStart
      AppRepository appRepository = (AppRepository) Entity.getEntityRepository(Entity.APPLICATION);

      try {
        appRepository.deleteByName("admin", "DataInsightsApplication", true, true);
      } catch (EntityNotFoundException ex) {
        LOG.debug("DataInsights Application not found.");
      } catch (UnableToExecuteStatementException ex) {
        // Note: Due to a change in the code this delete fails on a postDelete step that is not
        LOG.debug("[UnableToExecuteStatementException]: {}", ex.getMessage());
      }

      // Update DataInsightsApplication MarketplaceDefinition - It will be recreated on AppStart
      AppMarketPlaceRepository marketPlaceRepository =
          (AppMarketPlaceRepository) Entity.getEntityRepository(Entity.APP_MARKET_PLACE_DEF);

      try {
        marketPlaceRepository.deleteByName("admin", "DataInsightsApplication", true, true);
      } catch (EntityNotFoundException ex) {
        LOG.debug("DataInsights Application Marketplace Definition not found.");
      } catch (UnableToExecuteStatementException ex) {
        // Note: Due to a change in the code this delete fails on a postDelete step that is not
        LOG.debug("[UnableToExecuteStatementException]: {}", ex.getMessage());
      }
    } catch (Exception ex) {
      LOG.error("Error while updating DataInsightsApplication", ex);
    }
  }

  @SneakyThrows
  private static void setDefaultInputNamespaceMap(WorkflowNodeDefinitionInterface nodeDefinition) {
    try {
      Class<?> clazz = nodeDefinition.getClass();
      var field = clazz.getDeclaredField("inputNamespaceMap");

      field.setAccessible(true);

      Object fieldValue = field.get(nodeDefinition);

      if (fieldValue == null) {
        Class<?> fieldType = field.getType();

        Object newValue = fieldType.getDeclaredConstructor().newInstance();

        field.set(nodeDefinition, newValue);
      }
    } catch (NoSuchFieldException ignored) {

    }
  }

  @SneakyThrows
  private static void updateInputNamespaceMap(
      WorkflowNodeDefinitionInterface nodeDefinition, Map<String, String> inputNamespaceMap) {
    try {
      Class<?> clazz = nodeDefinition.getClass();
      var field = clazz.getDeclaredField("inputNamespaceMap");
      field.setAccessible(true);
      Object inputNamespaceMapObj = field.get(nodeDefinition);

      if (inputNamespaceMapObj != null) {
        Class<?> fieldType = field.getType();

        Field[] inputNamespaceMapFields = fieldType.getDeclaredFields();

        for (Field inputNamespaceMapField : inputNamespaceMapFields) {
          inputNamespaceMapField.setAccessible(true);
          String fieldName = inputNamespaceMapField.getName();

          if (inputNamespaceMap.containsKey(fieldName)) {
            inputNamespaceMapField.set(inputNamespaceMapObj, inputNamespaceMap.get(fieldName));
          }
        }
      }
    } catch (NoSuchFieldException ignored) {

    }
  }

  public static void updateGovernanceWorkflowDefinitions() {
    try {
      WorkflowDefinitionRepository repository =
          (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
      List<WorkflowDefinition> workflowDefinitions =
          repository.listAll(EntityUtil.Fields.EMPTY_FIELDS, new ListFilter());

      for (WorkflowDefinition workflowDefinition : workflowDefinitions) {
        MainWorkflow.WorkflowGraph graph = new MainWorkflow.WorkflowGraph(workflowDefinition);

        for (WorkflowNodeDefinitionInterface nodeDefinition : workflowDefinition.getNodes()) {
          setDefaultInputNamespaceMap(nodeDefinition);

          Map<String, String> nodeInputNamespaceMap =
              (Map<String, String>)
                  JsonUtils.readOrConvertValue(nodeDefinition.getInputNamespaceMap(), Map.class);

          if (nodeInputNamespaceMap == null) {
            continue;
          }

          if (nodeDefinition.getInput().contains(UPDATED_BY_VARIABLE)
              && nodeInputNamespaceMap.get(UPDATED_BY_VARIABLE) == null) {
            if (graph.getIncomingEdgesMap().containsKey(nodeDefinition.getName())) {
              for (String incomeNodeName :
                  graph.getIncomingEdgesMap().get(nodeDefinition.getName())) {
                List<String> incomeNodeOutput = graph.getNodeMap().get(incomeNodeName).getOutput();
                if (incomeNodeOutput != null && incomeNodeOutput.contains(UPDATED_BY_VARIABLE)) {
                  nodeInputNamespaceMap.put(UPDATED_BY_VARIABLE, incomeNodeName);
                  updateInputNamespaceMap(nodeDefinition, nodeInputNamespaceMap);
                  break;
                }
              }
            }
          }
        }
        workflowDefinition.withConfig(new WorkflowConfiguration());
        repository.createOrUpdate(null, workflowDefinition, ADMIN_USER_NAME);
      }
    } catch (Exception ex) {
      LOG.error("Error while updating workflow definitions", ex);
    }
  }

  static DataInsightSystemChartRepository dataInsightSystemChartRepository =
      new DataInsightSystemChartRepository();

  public static void createChart(String chartName, Object chartObject) {
    createChart(chartName, chartObject, DataInsightCustomChart.ChartType.LINE_CHART);
  }

  public static void createChart(
      String chartName, Object chartObject, DataInsightCustomChart.ChartType chartType) {
    DataInsightCustomChart chart =
        new DataInsightCustomChart()
            .withId(UUID.randomUUID())
            .withName(chartName)
            .withChartDetails(chartObject)
            .withUpdatedAt(System.currentTimeMillis())
            .withUpdatedBy("ingestion-bot")
            .withDeleted(false)
            .withChartType(chartType)
            .withIsSystemChart(true);
    dataInsightSystemChartRepository.prepareInternal(chart, false);
    try {
      dataInsightSystemChartRepository
          .getDao()
          .insert("fqnHash", chart, chart.getFullyQualifiedName());
    } catch (Exception ex) {
      LOG.warn(ex.toString());
      LOG.warn(String.format("Chart %s exists", chart));
    }
  }

  public static void createServiceCharts() {
    dataInsightSystemChartRepository = new DataInsightSystemChartRepository();
    createChart(
        "assets_with_pii_bar",
        new LineChart()
            .withMetrics(List.of(new LineChartMetric().withFormula("count(k='id.keyword')")))
            .withxAxisField("columns.tags.tagFQN")
            .withIncludeXAxisFiled("PII.*")
            .withGroupBy("columns.tags.name.keyword"),
        DataInsightCustomChart.ChartType.BAR_CHART);

    createChart(
        "assets_with_tier_bar",
        new LineChart()
            .withMetrics(List.of(new LineChartMetric().withFormula("count(k='id.keyword')")))
            .withxAxisField("tags.tagFQN")
            .withIncludeXAxisFiled("tier.*")
            .withGroupBy("tags.name.keyword"),
        DataInsightCustomChart.ChartType.BAR_CHART);

    createChart(
        "assets_with_description",
        new LineChart()
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withFormula(
                            "(count(k='id.keyword',q='hasDescription: 1')/count(k='id.keyword'))*100"))));

    createChart(
        "assets_with_owners",
        new LineChart()
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withFormula(
                            "(count(k='id.keyword',q='owners.name.keyword: *')/count(k='id.keyword'))*100"))));

    createChart(
        "assets_with_pii",
        new LineChart()
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withFormula(
                            "(count(q='columns.tags.tagFQN: pii.*')/count(k='id.keyword'))*100"))));

    createChart(
        "assets_with_tier",
        new LineChart()
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withFormula(
                            "(count(q='tags.tagFQN: tier.*')/count(k='id.keyword'))*100"))));

    createChart(
        "description_source_breakdown",
        new LineChart()
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withFormula(
                            "sum(k='descriptionSources.Ingested')+"
                                + "sum(k='descriptionSources.Manual')+"
                                + "sum(k='descriptionSources.Propagated')+"
                                + "sum(k='descriptionSources.Automated')")
                        .withName("manual"),
                    new LineChartMetric()
                        .withFormula("sum(k='descriptionSources.Suggested')")
                        .withName("ai"))));

    createChart(
        "tag_source_breakdown",
        new LineChart()
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withFormula(
                            "sum(k='tagSources.Ingested')+"
                                + "sum(k='tagSources.Manual')+"
                                + "sum(k='tagSources.Propagated')")
                        .withName("manual"),
                    new LineChartMetric()
                        .withFormula("sum(k='tagSources.Automated')")
                        .withName("ai"))));

    createChart(
        "tier_source_breakdown",
        new LineChart()
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withFormula(
                            "sum(k='tierSources.Ingested')+"
                                + "sum(k='tierSources.Manual')+"
                                + "sum(k='tierSources.Propagated')")
                        .withName("manual"),
                    new LineChartMetric()
                        .withFormula("sum(k='tierSources.Automated')")
                        .withName("ai"))));
  }

  public static void runMigrationForDomainLineage(Handle handle) {
    try {
      List<Domain> allDomains = getAllDomains();
      for (Domain fromDomain : allDomains) {
        for (Domain toDomain : allDomains) {
          insertDomainAndDataProductLineage(
              handle, fromDomain.getEntityReference(), toDomain.getEntityReference());
        }
      }

    } catch (Exception ex) {
      LOG.error(
          "Error while updating null json rows with createdAt, createdBy, updatedAt and updatedBy for lineage.",
          ex);
    }
  }

  public static void runMigrationForDataProductsLineage(Handle handle) {
    try {
      List<DataProduct> allDataProducts = getAllDataProducts();
      for (DataProduct fromDataProduct : allDataProducts) {
        for (DataProduct toDataProduct : allDataProducts) {
          insertDomainAndDataProductLineage(
              handle, fromDataProduct.getEntityReference(), toDataProduct.getEntityReference());
        }
      }

    } catch (Exception ex) {
      LOG.error(
          "Error while updating null json rows with createdAt, createdBy, updatedAt and updatedBy for lineage.",
          ex);
    }
  }

  private static void insertDomainAndDataProductLineage(
      Handle handle, EntityReference fromRef, EntityReference toRef) {
    LOG.info(
        "MIGRATION 1.7.0 - STARTING MIGRATION FOR DOMAIN/DATA_PRODUCT LINEAGE, FROM: {} TO: {}",
        fromRef.getFullyQualifiedName(),
        toRef.getFullyQualifiedName());
    if (fromRef.getId().equals(toRef.getId())) {
      return;
    }
    String sql =
        String.format(
            DOMAIN_AND_PRODUCTS_LINEAGE, fromRef.getId().toString(), toRef.getId().toString());
    int count = handle.createQuery(sql).mapTo(Integer.class).one();
    if (count > 0) {
      LineageDetails domainLineageDetails =
          new LineageDetails()
              .withCreatedAt(System.currentTimeMillis())
              .withUpdatedAt(System.currentTimeMillis())
              .withCreatedBy(ADMIN_USER_NAME)
              .withUpdatedBy(ADMIN_USER_NAME)
              .withSource(LineageDetails.Source.CHILD_ASSETS)
              .withAssetEdges(count);
      Entity.getCollectionDAO()
          .relationshipDAO()
          .insert(
              fromRef.getId(),
              toRef.getId(),
              fromRef.getType(),
              toRef.getType(),
              Relationship.UPSTREAM.ordinal(),
              JsonUtils.pojoToJson(domainLineageDetails));
    }
  }

  public static void runMigrationServiceLineage(Handle handle) {
    try {
      // Get all services except DRIVE which doesn't exist in v1.7.0
      List<ServiceEntityInterface> allServices = getAllServicesForLineageExcludingDrive();
      for (ServiceEntityInterface fromService : allServices) {
        for (ServiceEntityInterface toService : allServices) {
          insertServiceLineageDetails(handle, fromService, toService);
        }
      }
    } catch (Exception ex) {
      LOG.error(
          "Error while updating null json rows with createdAt, createdBy, updatedAt and updatedBy for lineage.",
          ex);
    }
  }

  private static List<ServiceEntityInterface> getAllServicesForLineageExcludingDrive() {
    List<ServiceEntityInterface> allServices = new ArrayList<>();
    Set<ServiceType> serviceTypes = new HashSet<>(List.of(ServiceType.values()));
    serviceTypes.remove(ServiceType.METADATA);
    serviceTypes.remove(ServiceType.DRIVE); // Exclude DRIVE as it doesn't exist in v1.7.0
    serviceTypes.remove(ServiceType.SECURITY); // Exclude SECURITY as it doesn't exist in v1.7.0

    for (ServiceType serviceType : serviceTypes) {
      EntityRepository<? extends EntityInterface> repository =
          Entity.getServiceEntityRepository(serviceType);
      ListFilter filter = new ListFilter(Include.ALL);
      List<ServiceEntityInterface> services =
          (List<ServiceEntityInterface>) repository.listAll(repository.getFields("id"), filter);
      allServices.addAll(services);
    }

    return allServices;
  }

  private static void insertServiceLineageDetails(
      Handle handle, ServiceEntityInterface fromService, ServiceEntityInterface toService) {
    try {
      LOG.info(
          "MIGRATION 1.7.0 - STARTING MIGRATION FOR SERVICES LINEAGE , FROM: {} TO: {}",
          fromService.getFullyQualifiedName(),
          toService.getFullyQualifiedName());

      if (fromService.getId().equals(toService.getId())
          && fromService
              .getEntityReference()
              .getType()
              .equals(toService.getEntityReference().getType())) {
        return;
      }

      String fromServiceHash =
          FullyQualifiedName.buildHash(
              EntityInterfaceUtil.quoteName(fromService.getFullyQualifiedName()));
      String toServiceHash =
          FullyQualifiedName.buildHash(
              EntityInterfaceUtil.quoteName(toService.getFullyQualifiedName()));
      List<String> fromTableNames =
          listOrEmpty(SERVICE_TYPE_ENTITY_MAP.get(fromService.getEntityReference().getType()));
      List<String> toTableNames =
          listOrEmpty(SERVICE_TYPE_ENTITY_MAP.get(toService.getEntityReference().getType()));
      for (String fromTableName : fromTableNames) {
        for (String toTableName : toTableNames) {
          if (!nullOrEmpty(fromTableName) && !nullOrEmpty(toTableName)) {
            String sql =
                String.format(
                    SERVICE_ENTITY_MIGRATION,
                    fromTableName,
                    toTableName,
                    fromServiceHash,
                    toServiceHash);
            int count = handle.createQuery(sql).mapTo(Integer.class).one();

            if (count > 0) {
              LineageDetails serviceLineageDetails =
                  new LineageDetails()
                      .withCreatedAt(System.currentTimeMillis())
                      .withUpdatedAt(System.currentTimeMillis())
                      .withCreatedBy(ADMIN_USER_NAME)
                      .withUpdatedBy(ADMIN_USER_NAME)
                      .withSource(LineageDetails.Source.CHILD_ASSETS)
                      .withAssetEdges(count);
              Entity.getCollectionDAO()
                  .relationshipDAO()
                  .insert(
                      fromService.getId(),
                      toService.getId(),
                      fromService.getEntityReference().getType(),
                      toService.getEntityReference().getType(),
                      Relationship.UPSTREAM.ordinal(),
                      JsonUtils.pojoToJson(serviceLineageDetails));
            }
          }
        }
      }

    } catch (Exception ex) {
      LOG.error(
          "Found issue while updating lineage for service from {} , to: {}",
          fromService.getFullyQualifiedName(),
          toService.getFullyQualifiedName(),
          ex);
    }
  }

  private static List<Domain> getAllDomains() {
    DomainRepository repository = (DomainRepository) Entity.getEntityRepository(Entity.DOMAIN);
    return repository.listAll(repository.getFields("id"), new ListFilter(Include.ALL));
  }

  private static List<DataProduct> getAllDataProducts() {
    DataProductRepository repository =
        (DataProductRepository) Entity.getEntityRepository(Entity.DATA_PRODUCT);
    return repository.listAll(repository.getFields("id"), new ListFilter(Include.ALL));
  }

  public static void updateLineageBotPolicy() {
    PolicyRepository policyRepository =
        (PolicyRepository) Entity.getEntityRepository(Entity.POLICY);
    List<Policy> policies =
        policyRepository.listAll(EntityUtil.Fields.EMPTY_FIELDS, new ListFilter());
    for (Policy policy : policies) {
      if (policy.getName().equals("LineageBotPolicy")) {
        for (Rule rule : policy.getRules()) {
          if (rule.getName().equals("LineageBotRule-Allow")
              && !rule.getOperations().contains(MetadataOperation.EDIT_ALL)) {
            rule.getOperations().add(MetadataOperation.EDIT_ALL);
            policyRepository.createOrUpdate(null, policy, ADMIN_USER_NAME);
          }
        }
      }
    }
  }
}
