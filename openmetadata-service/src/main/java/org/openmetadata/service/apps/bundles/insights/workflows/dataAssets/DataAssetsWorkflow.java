package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets;

import static org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils.END_TIMESTAMP_KEY;
import static org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils.START_TIMESTAMP_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.ENTITY_TYPE_KEY;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.applications.configuration.internal.DataAssetsConfig;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.insights.config.InsightsConfig;
import org.openmetadata.service.apps.bundles.insights.config.ProcessingPeriod;
import org.openmetadata.service.apps.bundles.insights.search.DailyIndex;
import org.openmetadata.service.apps.bundles.insights.search.DataInsightsSearchInterface;
import org.openmetadata.service.apps.bundles.insights.search.SearchComponentFactory;
import org.openmetadata.service.apps.bundles.insights.workflow.AbstractInsightsWorkflow;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.DataInsightsEntityEnricherProcessor;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.steps.DeltaProcessingStep;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.steps.RetentionCleanupStep;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.steps.RollForwardStep;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.workflows.interfaces.Processor;
import org.openmetadata.service.workflows.interfaces.Sink;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntitiesSource;

@Slf4j
public class DataAssetsWorkflow extends AbstractInsightsWorkflow {

  public static final String DATA_STREAM_KEY = "DataStreamKey";
  public static final String ENTITY_TYPE_FIELDS_KEY = "EnityTypeFields";
  private static final String ALL_ENTITIES = "all";
  private static final int RETENTION_DAYS = 30;

  private final InsightsConfig config;
  private final SearchComponentFactory searchFactory;
  private final CollectionDAO collectionDAO;
  private final SearchRepository searchRepository;

  private DataInsightsSearchInterface searchInterface;
  private DataInsightsEntityEnricherProcessor entityEnricher;
  private Processor entityProcessor;
  private Sink searchIndexSink;

  public DataAssetsWorkflow(
      InsightsConfig config,
      SearchComponentFactory searchFactory,
      CollectionDAO collectionDAO,
      SearchRepository searchRepository) {
    super("DataAssetsWorkflow");
    this.config = config;
    this.searchFactory = searchFactory;
    this.collectionDAO = collectionDAO;
    this.searchRepository = searchRepository;
  }

  @Override
  protected boolean isEnabled() {
    return config.dataAssetsConfig() != null
        && Boolean.TRUE.equals(config.dataAssetsConfig().getEnabled());
  }

  @Override
  protected void initialize() {
    searchInterface = searchFactory.createSearchInterface();
    int totalRecords = config.dataAssetTypes().size() * 1000;
    entityEnricher = new DataInsightsEntityEnricherProcessor(totalRecords);
    entityProcessor = searchFactory.createDataInsightsProcessor(totalRecords);
    searchIndexSink = searchFactory.createIndexSink(totalRecords);
  }

  @Override
  protected void run() throws Exception {
    for (String entityType : getEntityTypesToProcess()) {
      if (stopped) break;
      processEntityType(entityType);
    }
  }

  private void processEntityType(String entityType) throws Exception {
    String clusterAlias = searchInterface.getClusterAlias();
    LocalDate today = LocalDate.now();
    DailyIndex todayIndex = new DailyIndex(clusterAlias, entityType, today);

    new RetentionCleanupStep(searchInterface, RETENTION_DAYS).execute(todayIndex, stats());
    new RollForwardStep(searchInterface).execute(todayIndex, stats());

    ProcessingPeriod period = config.backfillPeriod().orElse(config.steadyStatePeriod());
    List<String> fields = List.of("*");
    ListFilter filter = getListFilter(entityType);
    PaginatedEntitiesSource source =
        new PaginatedEntitiesSource(entityType, config.batchSize(), fields, filter)
            .withName("[DataAssetsWorkflow] " + entityType);

    Map<String, Object> contextData = new HashMap<>();
    contextData.put(DATA_STREAM_KEY, todayIndex.name());
    contextData.put(START_TIMESTAMP_KEY, period.startTimestamp());
    contextData.put(END_TIMESTAMP_KEY, period.endTimestamp());
    contextData.put(ENTITY_TYPE_KEY, entityType);
    contextData.put(
        ENTITY_TYPE_FIELDS_KEY,
        searchInterface.getEntityAttributeFields(
            searchInterface.readDataInsightsSearchConfiguration(), entityType));

    new DeltaProcessingStep(entityEnricher, entityProcessor, searchIndexSink)
        .execute(source, contextData, stats());
  }

  private Set<String> getEntityTypesToProcess() {
    DataAssetsConfig dataAssetsConfig = config.dataAssetsConfig();
    if (dataAssetsConfig == null) return config.dataAssetTypes();

    Set<String> serviceFiltered =
        dataAssetsConfig.getServiceFilter() != null
            ? Entity.getEntityTypeInService(dataAssetsConfig.getServiceFilter().getServiceType())
            : Set.of(ALL_ENTITIES);

    List<String> result = new ArrayList<>();
    for (String entityType : config.dataAssetTypes()) {
      boolean passesEntityFilter =
          dataAssetsConfig.getEntities() == null
              || dataAssetsConfig.getEntities().contains(ALL_ENTITIES)
              || dataAssetsConfig.getEntities().contains(entityType);
      boolean passesServiceFilter =
          serviceFiltered.contains(ALL_ENTITIES) || serviceFiltered.contains(entityType);
      if (passesEntityFilter && passesServiceFilter) {
        result.add(entityType);
      }
    }
    return Set.copyOf(result);
  }

  private ListFilter getListFilter(String entityType) {
    DataAssetsConfig dataAssetsConfig = config.dataAssetsConfig();
    if ("dataProduct".equals(entityType)) {
      return new ListFilter(Include.ALL);
    }
    ListFilter filter = new ListFilter();
    if (dataAssetsConfig != null && dataAssetsConfig.getServiceFilter() != null) {
      filter = filter.addQueryParam("service", dataAssetsConfig.getServiceFilter().getServiceName());
    }
    return filter;
  }
}
