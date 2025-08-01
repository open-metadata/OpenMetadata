package org.openmetadata.service.apps.bundles.insights;

import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.EMAIL;
import static org.openmetadata.service.Entity.KPI;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.apps.scheduler.AppScheduler.APP_NAME;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.APP_CONFIG;
import static org.openmetadata.service.util.SubscriptionUtil.getAdminsData;
import static org.openmetadata.service.util.Utilities.getMonthAndDateFromEpoch;
import static org.openmetadata.service.util.email.TemplateConstants.DATA_INSIGHT_REPORT_TEMPLATE;

import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResultList;
import org.openmetadata.schema.dataInsight.kpi.Kpi;
import org.openmetadata.schema.dataInsight.type.KpiResult;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.applications.configuration.internal.DataInsightsReportAppConfig;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils;
import org.openmetadata.service.events.scheduled.template.DataInsightDescriptionAndOwnerTemplate;
import org.openmetadata.service.events.scheduled.template.DataInsightTotalAssetTemplate;
import org.openmetadata.service.exception.AppException;
import org.openmetadata.service.exception.EventSubscriptionJobException;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.DataInsightSystemChartRepository;
import org.openmetadata.service.jdbi3.KpiRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.Utilities;
import org.openmetadata.service.util.email.EmailUtil;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntitiesSource;
import org.quartz.JobExecutionContext;

@Slf4j
@SuppressWarnings("unused")
public class DataInsightsReportApp extends AbstractNativeApplication {
  private static final String KPI_NOT_SET = "No Kpi Set";
  private static final String PREVIOUS_TOTAL_ASSET_COUNT = "PreviousTotalAssetCount";
  private static final String CURRENT_TOTAL_ASSET_COUNT = "CurrentTotalAssetCount";
  private final DataInsightSystemChartRepository systemChartRepository =
      new DataInsightSystemChartRepository();

  private record TimeConfig(
      Long startTime, Long endTime, String startDay, String endDay, int numberOfDaysChange) {}

  public DataInsightsReportApp(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
  }

  @Override
  public void execute(JobExecutionContext jobExecutionContext) {
    String appName = (String) jobExecutionContext.getJobDetail().getJobDataMap().get(APP_NAME);
    App app = collectionDAO.applicationDAO().findEntityByName(appName);
    app.setAppConfiguration(
        JsonUtils.getMapFromJson(
            (String) jobExecutionContext.getJobDetail().getJobDataMap().get(APP_CONFIG)));

    // Calculate time config
    long currentTime = System.currentTimeMillis();
    long startTime =
        TimestampUtils.getStartOfDayTimestamp(TimestampUtils.subtractDays(currentTime, 6));
    long endTime = TimestampUtils.getStartOfDayTimestamp(currentTime);
    TimeConfig timeConfig =
        new TimeConfig(
            startTime,
            endTime,
            TimestampUtils.timestampToString(startTime, "dd"),
            TimestampUtils.timestampToString(endTime, "dd"),
            7);

    try {
      DataInsightsReportAppConfig insightAlertConfig =
          JsonUtils.convertValue(app.getAppConfiguration(), DataInsightsReportAppConfig.class);
      // Send to Admins
      if (Boolean.TRUE.equals(insightAlertConfig.getSendToAdmins())) {
        sendToAdmins(searchRepository.getSearchClient(), timeConfig);
      }

      // Send to Teams
      if (Boolean.TRUE.equals(insightAlertConfig.getSendToTeams())) {
        sendReportsToTeams(searchRepository.getSearchClient(), timeConfig);
      }
    } catch (Exception e) {
      LOG.error("[DIReport] Failed in sending report due to", e);
      throw new EventSubscriptionJobException(e);
    }
  }

  @Override
  protected void validateConfig(Map<String, Object> config) {
    try {
      JsonUtils.convertValue(config, DataInsightsReportAppConfig.class);
    } catch (IllegalArgumentException e) {
      throw AppException.byMessage(
          Response.Status.BAD_REQUEST,
          "Invalid DataInsightsReportAppConfig configuration: " + e.getMessage());
    }
  }

  private void sendReportsToTeams(SearchClient searchClient, TimeConfig timeConfig)
      throws SearchIndexException {
    PaginatedEntitiesSource teamReader =
        new PaginatedEntitiesSource(TEAM, 10, List.of("name", "email", "users"));
    while (!teamReader.isDone().get()) {
      ResultList<Team> resultList = (ResultList<Team>) teamReader.readNext(null);
      for (Team team : resultList.getData()) {
        Set<String> emails = new HashSet<>();
        String email = team.getEmail();
        if (!CommonUtil.nullOrEmpty(email)) {
          emails.add(email);
        } else {
          for (EntityReference userRef : team.getUsers()) {
            User user = Entity.getEntity(Entity.USER, userRef.getId(), "", Include.NON_DELETED);
            emails.add(user.getEmail());
          }
        }

        Map<String, Object> contextData = new HashMap<>();

        try {
          DataInsightTotalAssetTemplate totalAssetTemplate =
              createTotalAssetTemplate(searchClient, team.getName(), timeConfig, contextData);

          DataInsightDescriptionAndOwnerTemplate descriptionTemplate =
              createDescriptionTemplate(searchClient, team.getName(), timeConfig, contextData);

          DataInsightDescriptionAndOwnerTemplate ownershipTemplate =
              createOwnershipTemplate(searchClient, team.getName(), timeConfig, contextData);

          DataInsightDescriptionAndOwnerTemplate tierTemplate =
              createTierTemplate(searchClient, team.getName(), timeConfig, contextData);

          EmailUtil.sendDataInsightEmailNotificationToUser(
              emails,
              getMonthAndDateFromEpoch(timeConfig.startTime()),
              getMonthAndDateFromEpoch(timeConfig.endTime()),
              totalAssetTemplate,
              descriptionTemplate,
              ownershipTemplate,
              tierTemplate,
              EmailUtil.getDataInsightReportSubject(),
              DATA_INSIGHT_REPORT_TEMPLATE);
        } catch (Exception ex) {
          LOG.error(
              "[DataInsightReport] Failed for Team: {}, Reason : {}",
              team.getName(),
              ex.getMessage());
        }
      }
    }
  }

  private void sendToAdmins(SearchClient searchClient, TimeConfig timeConfig) {
    // Get Admins
    Set<String> emailList = getAdminsData(EMAIL);
    Map<String, Object> contextData = new HashMap<>();

    try {
      // Build Insights Report
      DataInsightTotalAssetTemplate totalAssetTemplate =
          createTotalAssetTemplate(searchClient, null, timeConfig, contextData);
      DataInsightDescriptionAndOwnerTemplate descriptionTemplate =
          createDescriptionTemplate(searchClient, null, timeConfig, contextData);
      DataInsightDescriptionAndOwnerTemplate ownershipTemplate =
          createOwnershipTemplate(searchClient, null, timeConfig, contextData);
      DataInsightDescriptionAndOwnerTemplate tierTemplate =
          createTierTemplate(searchClient, null, timeConfig, contextData);
      EmailUtil.sendDataInsightEmailNotificationToUser(
          emailList,
          getMonthAndDateFromEpoch(timeConfig.startTime()),
          getMonthAndDateFromEpoch(timeConfig.endTime()),
          totalAssetTemplate,
          descriptionTemplate,
          ownershipTemplate,
          tierTemplate,
          EmailUtil.getDataInsightReportSubject(),
          DATA_INSIGHT_REPORT_TEMPLATE);
    } catch (Exception ex) {
      LOG.error("[DataInsightReport] Failed for Admin, Reason : {}", ex.getMessage(), ex);
    }
  }

  private List<Kpi> getAvailableKpi() {
    KpiRepository repository = (KpiRepository) Entity.getEntityRepository(KPI);
    return repository.listAll(
        repository.getFields("dataInsightChart"), new ListFilter(Include.NON_DELETED));
  }

  private KpiResult getKpiResult(String fqn) {
    KpiRepository repository = (KpiRepository) Entity.getEntityRepository(KPI);
    return repository.getKpiResult(fqn);
  }

  private DataInsightTotalAssetTemplate createTotalAssetTemplate(
      SearchClient searchClient,
      String team,
      TimeConfig timeConfig,
      Map<String, Object> contextData)
      throws IOException {
    // Create A Date Map
    Map<String, Integer> dateMap = new LinkedHashMap<>();
    Utilities.getLastSevenDays(timeConfig.endTime()).forEach(day -> dateMap.put(day, 0));
    // Get total Assets Data
    Map<String, Double> dateWithCount =
        getDateMapWithCountFromChart(
            "total_data_assets", timeConfig.startTime(), timeConfig.endTime(), team);

    Double previousCount = dateWithCount.getOrDefault(timeConfig.startDay(), 0D);
    Double currentCount = dateWithCount.getOrDefault(timeConfig.endDay(), 0D);

    contextData.put(PREVIOUS_TOTAL_ASSET_COUNT, previousCount);
    contextData.put(CURRENT_TOTAL_ASSET_COUNT, currentCount);

    dateWithCount.forEach((key, value) -> dateMap.put(key, value.intValue()));
    processDateMapToNormalize(dateMap);

    int changeInTotalAssets = (int) Math.abs(currentCount - previousCount);

    if (previousCount == 0D) {
      // it should be undefined
      return new DataInsightTotalAssetTemplate(
          String.valueOf(currentCount.intValue()),
          currentCount.intValue(),
          0d,
          timeConfig.numberOfDaysChange(),
          dateMap);
    } else {
      return new DataInsightTotalAssetTemplate(
          String.valueOf(currentCount.intValue()),
          changeInTotalAssets,
          ((currentCount - previousCount) / previousCount) * 100,
          timeConfig.numberOfDaysChange(),
          dateMap);
    }
  }

  private DataInsightDescriptionAndOwnerTemplate createDescriptionTemplate(
      SearchClient searchClient,
      String team,
      TimeConfig timeConfig,
      Map<String, Object> contextData)
      throws IOException {
    // Create A Date Map
    Map<String, Integer> dateMap = new LinkedHashMap<>();
    Utilities.getLastSevenDays(timeConfig.endTime()).forEach(day -> dateMap.put(day, 0));
    // Get total Assets Data
    // This assumes that on a particular date the correct count per entities are given
    Map<String, Double> dateWithCount =
        getDateMapWithCountFromChart(
            "number_of_data_asset_with_description_kpi",
            timeConfig.startTime(),
            timeConfig.endTime(),
            team);

    Double previousCompletedDescription = dateWithCount.getOrDefault(timeConfig.startDay(), 0D);
    Double currentCompletedDescription = dateWithCount.getOrDefault(timeConfig.endDay(), 0D);

    Double previousTotalAssetCount = (double) contextData.get(PREVIOUS_TOTAL_ASSET_COUNT);
    Double currentTotalAssetCount = (double) contextData.get(CURRENT_TOTAL_ASSET_COUNT);

    dateWithCount.forEach((key, value) -> dateMap.put(key, value.intValue()));
    processDateMapToNormalize(dateMap);

    // Previous Percent
    double previousPercentCompleted = 0D;
    if (previousTotalAssetCount != 0D) {
      previousPercentCompleted = (previousCompletedDescription / previousTotalAssetCount) * 100;
    }
    // Current Percent
    double currentPercentCompleted = 0D;
    if (currentTotalAssetCount != 0D) {
      currentPercentCompleted = (currentCompletedDescription / currentTotalAssetCount) * 100;
    }

    int changeCount = (int) Math.abs(currentCompletedDescription - previousCompletedDescription);

    return getTemplate(
        DataInsightDescriptionAndOwnerTemplate.MetricType.DESCRIPTION,
        "percentage_of_data_asset_with_description_kpi",
        currentPercentCompleted,
        changeCount,
        currentPercentCompleted - previousPercentCompleted,
        currentCompletedDescription.intValue(),
        timeConfig.numberOfDaysChange(),
        dateMap);
  }

  private DataInsightDescriptionAndOwnerTemplate createOwnershipTemplate(
      SearchClient searchClient,
      String team,
      TimeConfig timeConfig,
      Map<String, Object> contextData)
      throws IOException {
    // Create A Date Map
    Map<String, Integer> dateMap = new LinkedHashMap<>();
    Utilities.getLastSevenDays(timeConfig.endTime()).forEach(day -> dateMap.put(day, 0));
    // Get total Assets Data
    // This assumes that on a particular date the correct count per entities are given
    Map<String, Double> dateWithCount =
        getDateMapWithCountFromChart(
            "number_of_data_asset_with_owner_kpi",
            timeConfig.startTime(),
            timeConfig.endTime(),
            team);

    Double previousHasOwner = dateWithCount.getOrDefault(timeConfig.startDay(), 0D);
    Double currentHasOwner = dateWithCount.getOrDefault(timeConfig.endDay(), 0D);

    Double previousTotalAssetCount = (double) contextData.get(PREVIOUS_TOTAL_ASSET_COUNT);
    Double currentTotalAssetCount = (double) contextData.get(CURRENT_TOTAL_ASSET_COUNT);

    dateWithCount.forEach((key, value) -> dateMap.put(key, value.intValue()));
    processDateMapToNormalize(dateMap);

    // Previous Percent
    double previousPercentCompleted = 0D;
    if (previousTotalAssetCount != 0) {
      previousPercentCompleted = (previousHasOwner / previousTotalAssetCount) * 100;
    }
    // Current Percent
    double currentPercentCompleted = 0;
    if (currentTotalAssetCount != 0) {
      currentPercentCompleted = (currentHasOwner / currentTotalAssetCount) * 100;
    }

    int changeCount = (int) Math.abs(currentHasOwner - previousHasOwner);

    return getTemplate(
        DataInsightDescriptionAndOwnerTemplate.MetricType.OWNER,
        "percentage_of_data_asset_with_owner_kpi",
        currentPercentCompleted,
        changeCount,
        currentPercentCompleted - previousPercentCompleted,
        currentHasOwner.intValue(),
        timeConfig.numberOfDaysChange(),
        dateMap);
  }

  private DataInsightDescriptionAndOwnerTemplate createTierTemplate(
      SearchClient searchClient,
      String team,
      TimeConfig timeConfig,
      Map<String, Object> contextData)
      throws IOException {
    // Create A Date Map
    Map<String, Integer> dateMap = new LinkedHashMap<>();
    Utilities.getLastSevenDays(timeConfig.endTime()).forEach(day -> dateMap.put(day, 0));

    // Get total Assets Data
    // This assumes that on a particular date the correct count per entities are given
    Map<String, Double> dateWithCount =
        getDateMapWithCountFromTierChart(
            "total_data_assets_by_tier", timeConfig.startTime(), timeConfig.endTime(), team);

    Double previousHasTier = dateWithCount.getOrDefault(timeConfig.startDay(), 0D);
    Double currentHasTier = dateWithCount.getOrDefault(timeConfig.endDay(), 0D);

    Double previousTotalAssetCount = (double) contextData.get(PREVIOUS_TOTAL_ASSET_COUNT);
    Double currentTotalAssetCount = (double) contextData.get(CURRENT_TOTAL_ASSET_COUNT);

    dateWithCount.forEach((key, value) -> dateMap.put(key, value.intValue()));
    processDateMapToNormalize(dateMap);

    // Previous Percent
    double previousPercentCompleted = 0D;
    if (previousTotalAssetCount != 0) {
      previousPercentCompleted = (previousHasTier / previousTotalAssetCount) * 100;
    }
    // Current Percent
    double currentPercentCompleted = 0;
    if (currentTotalAssetCount != 0) {
      currentPercentCompleted = (currentHasTier / currentTotalAssetCount) * 100;
    }

    int changeCount = (int) Math.abs(currentHasTier - previousHasTier);

    // TODO: Understand if we actually use this tierData for anything.
    Map<String, Double> tierData = new HashMap<>();

    return new DataInsightDescriptionAndOwnerTemplate(
        DataInsightDescriptionAndOwnerTemplate.MetricType.TIER,
        null,
        String.valueOf(currentHasTier.intValue()),
        currentPercentCompleted,
        KPI_NOT_SET,
        changeCount,
        currentPercentCompleted - previousPercentCompleted,
        false,
        "",
        timeConfig.numberOfDaysChange(),
        tierData,
        dateMap);
  }

  // Hack: Because on Data Insights when a Tier is not present is set as 'NoTier', this calculation
  // will return 100% of the entities
  // with Tier.
  // This should be fixed by using the .missing() attribute for ElasticSearch aggregations and
  // should be planned for 1.6.
  // Meanwhile this is a workaround.
  private Map<String, Double> getDateMapWithCountFromTierChart(
      String chartName, Long startTime, Long endTime, String team) throws IOException {
    String filter = prepareTeamFilter(team);
    Map<String, DataInsightCustomChartResultList> systemChartMap =
        systemChartRepository.listChartData(chartName, startTime, endTime, filter);
    return systemChartMap.get(chartName).getResults().stream()
        .filter(
            result ->
                !result
                    .getGroup()
                    .equals(
                        "NoTier")) // Workaround to remove Assets without Tiers from the equation
        .map(
            result -> {
              Map<String, Double> dayCount = new HashMap<>();
              dayCount.put(
                  TimestampUtils.timestampToString(result.getDay().longValue(), "dd"),
                  result.getCount());
              return dayCount;
            })
        .flatMap(map -> map.entrySet().stream())
        .collect(
            Collectors.groupingBy(
                Map.Entry::getKey, Collectors.summingDouble(Map.Entry::getValue)));
  }

  private Map<String, Double> getDateMapWithCountFromChart(
      String chartName, Long startTime, Long endTime, String team) throws IOException {
    String filter = prepareTeamFilter(team);
    Map<String, DataInsightCustomChartResultList> systemChartMap =
        systemChartRepository.listChartData(chartName, startTime, endTime, filter);
    return systemChartMap.get(chartName).getResults().stream()
        .map(
            result -> {
              Map<String, Double> dayCount = new HashMap<>();
              dayCount.put(
                  TimestampUtils.timestampToString(result.getDay().longValue(), "dd"),
                  result.getCount());
              return dayCount;
            })
        .flatMap(map -> map.entrySet().stream())
        .collect(
            Collectors.groupingBy(
                Map.Entry::getKey, Collectors.summingDouble(Map.Entry::getValue)));
  }

  private String prepareTeamFilter(String team) {
    String filter = null;

    if (!CommonUtil.nullOrEmpty(team)) {
      filter =
          String.format(
              "{\"query\":{\"bool\":{\"must\":[{\"bool\":{\"should\":[{\"term\":{\"owners.displayName.keyword\":\"%s\"}}]}}]}}}",
              team);
    }

    return filter;
  }

  private DataInsightDescriptionAndOwnerTemplate getTemplate(
      DataInsightDescriptionAndOwnerTemplate.MetricType metricType,
      String chartKpiName,
      Double percentCompleted,
      int changeCount,
      Double percentChange,
      int totalAssets,
      int numberOfDaysChange,
      Map<String, Integer> dateMap) {

    List<Kpi> kpiList = getAvailableKpi();
    Kpi validKpi = null;
    boolean isKpiAvailable = false;
    for (Kpi kpiObj : kpiList) {
      if (kpiObj.getDataInsightChart().getName().equals(chartKpiName)) {
        validKpi = kpiObj;
        isKpiAvailable = true;
        break;
      }
    }

    DataInsightDescriptionAndOwnerTemplate.KpiCriteria criteria = null;
    boolean isTargetMet;
    String totalDaysLeft = "";
    String targetKpi = KPI_NOT_SET;

    if (isKpiAvailable) {
      targetKpi = String.format("%.2f", validKpi.getTargetValue());
      KpiResult result = getKpiResult(validKpi.getName());
      if (result != null) {
        isTargetMet = result.getTargetResult().get(0).getTargetMet();
        criteria = DataInsightDescriptionAndOwnerTemplate.KpiCriteria.IN_PROGRESS;
        if (isTargetMet) {
          criteria = DataInsightDescriptionAndOwnerTemplate.KpiCriteria.MET;
        } else {
          long leftDaysInMilli = validKpi.getEndDate() - System.currentTimeMillis();
          if (leftDaysInMilli >= 0) {
            totalDaysLeft = String.valueOf((int) (leftDaysInMilli / (24 * 60 * 60 * 1000)));
          } else {
            criteria = DataInsightDescriptionAndOwnerTemplate.KpiCriteria.NOT_MET;
          }
        }
      }
    }

    return new DataInsightDescriptionAndOwnerTemplate(
        metricType,
        criteria,
        String.valueOf(totalAssets),
        percentCompleted,
        targetKpi,
        changeCount,
        percentChange,
        isKpiAvailable,
        totalDaysLeft,
        numberOfDaysChange,
        null,
        dateMap);
  }

  private void processDateMapToNormalize(Map<String, Integer> dateMap) {
    Pair<Integer, Integer> maxIn = getMinAndMax(dateMap.values().stream().toList());
    dateMap.replaceAll(
        (k, v) ->
            getNormalizedValue(
                    v.doubleValue(), maxIn.getRight().doubleValue(), maxIn.getLeft().doubleValue())
                .intValue());
  }

  private Pair<Integer, Integer> getMinAndMax(List<Integer> integers) {
    Optional<Integer> minOptional = integers.stream().min(Integer::compareTo);
    Optional<Integer> maxOptional = integers.stream().max(Integer::compareTo);
    int min = minOptional.orElseThrow(() -> new IllegalArgumentException("List is empty"));
    int max = maxOptional.orElseThrow(() -> new IllegalArgumentException("List is empty"));

    return Pair.of(min, max);
  }

  private Double getNormalizedValue(Double value, Double max, Double min) {
    if (max - min == 0) {
      return 0d;
    }
    return ((value - min) / (max - min) * 50);
  }
}
