package org.openmetadata.service.apps.bundles.insights.config;

import java.util.Optional;
import java.util.Set;
import org.openmetadata.schema.entity.applications.configuration.internal.AppAnalyticsConfig;
import org.openmetadata.schema.entity.applications.configuration.internal.CostAnalysisConfig;
import org.openmetadata.schema.entity.applications.configuration.internal.DataAssetsConfig;
import org.openmetadata.schema.entity.applications.configuration.internal.DataInsightsAppConfig;
import org.openmetadata.schema.entity.applications.configuration.internal.DataQualityConfig;
import org.openmetadata.schema.entity.applications.configuration.internal.ModuleConfiguration;
import org.openmetadata.service.Entity;

public record InsightsConfig(
    DataAssetsConfig dataAssetsConfig,
    CostAnalysisConfig costAnalysisConfig,
    DataQualityConfig dataQualityConfig,
    AppAnalyticsConfig webAnalyticsConfig,
    int batchSize,
    boolean recreateDataAssetsIndex,
    Optional<ProcessingPeriod> backfillPeriod,
    ProcessingPeriod steadyStatePeriod,
    Set<String> dataAssetTypes,
    Set<String> dataQualityEntities,
    Optional<Set<String>> backfillCompletedTypes,
    Optional<Long> lastRunTimestamp) {

  // Matches the schema default in dataInsightsAppConfig.json. Only used as a fallback when
  // the operator's config is absent or omits the retention field.
  private static final int DEFAULT_RETENTION_DAYS = 90;

  private static final Set<String> DATA_ASSET_TYPES =
      Set.of(
          "table",
          "storedProcedure",
          "databaseSchema",
          "database",
          "chart",
          "dashboard",
          "dashboardDataModel",
          "pipeline",
          "topic",
          "container",
          "searchIndex",
          "mlmodel",
          "dataProduct",
          "glossaryTerm",
          "tag",
          "metric");

  private static final Set<String> DATA_QUALITY_ENTITIES =
      Set.of(Entity.TEST_CASE_RESULT, Entity.TEST_CASE_RESOLUTION_STATUS);

  /**
   * Constructs InsightsConfig from the raw app configuration. Note: {@code backfillCompletedTypes}
   * and {@code lastRunTimestamp} are always empty here — they are runtime-resolved by
   * {@code DataInsightsApp.resolveConfig()} after this method returns.
   */
  public static InsightsConfig from(DataInsightsAppConfig appConfig, long currentTimestamp) {
    ModuleConfiguration moduleConfig = appConfig.getModuleConfiguration();
    DataAssetsConfig dataAssetsConfig = moduleConfig != null ? moduleConfig.getDataAssets() : null;

    boolean recreate =
        appConfig.getRecreateDataAssetsIndex() != null && appConfig.getRecreateDataAssetsIndex();

    int batchSize = appConfig.getBatchSize() != null ? appConfig.getBatchSize() : 1000;

    // Honour the operator-configured retention window when present. V0/V1 read this from
    // DataAssetsConfig.retention; V2 must do the same or customers with non-default retention
    // silently lose their setting on upgrade.
    int retentionDays =
        dataAssetsConfig != null && dataAssetsConfig.getRetention() != null
            ? dataAssetsConfig.getRetention()
            : DEFAULT_RETENTION_DAYS;

    ProcessingPeriod steadyState = ProcessingPeriod.forSteadyState(currentTimestamp, retentionDays);

    Optional<ProcessingPeriod> backfillPeriod = Optional.empty();
    if (appConfig.getBackfillConfiguration() != null) {
      backfillPeriod =
          Optional.of(
              ProcessingPeriod.forBackfill(
                  appConfig.getBackfillConfiguration().getStartDate(),
                  appConfig.getBackfillConfiguration().getEndDate(),
                  currentTimestamp,
                  retentionDays));
    }

    return new InsightsConfig(
        dataAssetsConfig,
        moduleConfig != null ? moduleConfig.getCostAnalysis() : null,
        moduleConfig != null ? moduleConfig.getDataQuality() : null,
        moduleConfig != null ? moduleConfig.getAppAnalytics() : null,
        batchSize,
        recreate,
        backfillPeriod,
        steadyState,
        DATA_ASSET_TYPES,
        DATA_QUALITY_ENTITIES,
        Optional.empty(),
        Optional.empty());
  }

  public boolean shouldRecreateDataAssets() {
    return recreateDataAssetsIndex;
  }
}
