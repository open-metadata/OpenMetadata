package org.openmetadata.service.apps.bundles.insights;

import static org.openmetadata.schema.dataInsight.DataInsightChartResult.DataInsightChartType.PERCENTAGE_OF_ENTITIES_WITH_DESCRIPTION_BY_TYPE;
import static org.openmetadata.schema.dataInsight.DataInsightChartResult.DataInsightChartType.PERCENTAGE_OF_ENTITIES_WITH_OWNER_BY_TYPE;
import static org.openmetadata.schema.dataInsight.DataInsightChartResult.DataInsightChartType.TOTAL_ENTITIES_BY_TIER;
import static org.openmetadata.schema.dataInsight.DataInsightChartResult.DataInsightChartType.TOTAL_ENTITIES_BY_TYPE;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.EMAIL;
import static org.openmetadata.schema.type.DataReportIndex.ENTITY_REPORT_DATA_INDEX;
import static org.openmetadata.service.Entity.KPI;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.apps.scheduler.AppScheduler.APP_INFO_KEY;
import static org.openmetadata.service.apps.scheduler.AppScheduler.SEARCH_CLIENT_KEY;
import static org.openmetadata.service.util.SubscriptionUtil.getAdminsData;

import com.fasterxml.jackson.core.type.TypeReference;
import java.io.IOException;
import java.text.ParseException;
import java.time.Instant;
import java.time.Period;
import java.time.ZoneId;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;
import org.openmetadata.schema.dataInsight.kpi.Kpi;
import org.openmetadata.schema.dataInsight.type.KpiResult;
import org.openmetadata.schema.dataInsight.type.PercentageOfEntitiesWithDescriptionByType;
import org.openmetadata.schema.dataInsight.type.PercentageOfEntitiesWithOwnerByType;
import org.openmetadata.schema.dataInsight.type.TotalEntitiesByTier;
import org.openmetadata.schema.dataInsight.type.TotalEntitiesByType;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppSchedule;
import org.openmetadata.schema.entity.applications.configuration.internal.DataInsightsReportAppConfig;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.events.scheduled.template.DataInsightDescriptionAndOwnerTemplate;
import org.openmetadata.service.events.scheduled.template.DataInsightTotalAssetTemplate;
import org.openmetadata.service.exception.EventSubscriptionJobException;
import org.openmetadata.service.jdbi3.KpiRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.EmailUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntitiesSource;
import org.quartz.CronScheduleBuilder;
import org.quartz.JobExecutionContext;
import org.quartz.Trigger;

@Slf4j
public class DataInsightsReportApp extends AbstractNativeApplication {
  private static final String MISSING_DATA =
      "Data Insight Report Data Unavailable or too short of a span for Reporting.";
  private static final String KPI_NOT_SET = "No Kpi Set";

  @Override
  public void execute(JobExecutionContext jobExecutionContext) {
    SearchRepository searchRepository =
        (SearchRepository)
            jobExecutionContext.getJobDetail().getJobDataMap().get(SEARCH_CLIENT_KEY);
    App app = (App) jobExecutionContext.getJobDetail().getJobDataMap().get(APP_INFO_KEY);
    // Calculate time diff
    long currentTime = Instant.now().toEpochMilli();
    AppSchedule scheduleConfiguration = app.getAppSchedule();
    long scheduleTime =
        currentTime - getTimeFromSchedule(scheduleConfiguration, jobExecutionContext);
    int numberOfDaysChange = getNumberOfDays(scheduleConfiguration);
    try {
      DataInsightsReportAppConfig insightAlertConfig =
          JsonUtils.convertValue(app.getAppConfiguration(), DataInsightsReportAppConfig.class);
      // Send to Admins
      if (Boolean.TRUE.equals(insightAlertConfig.getSendToAdmins())) {
        sendToAdmins(
            searchRepository.getSearchClient(), scheduleTime, currentTime, numberOfDaysChange);
      }

      // Send to Teams
      if (Boolean.TRUE.equals(insightAlertConfig.getSendToTeams())) {
        sendReportsToTeams(
            searchRepository.getSearchClient(), scheduleTime, currentTime, numberOfDaysChange);
      }
    } catch (Exception e) {
      LOG.error("[DIReport] Failed in sending report due to", e);
      throw new EventSubscriptionJobException(e);
    }
  }

  private void sendReportsToTeams(
      SearchClient searchClient, Long scheduleTime, Long currentTime, int numberOfDaysChange)
      throws IOException {
    PaginatedEntitiesSource teamReader =
        new PaginatedEntitiesSource(TEAM, 10, List.of("name", "email", "users"));
    while (!teamReader.isDone()) {
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

        try {
          DataInsightTotalAssetTemplate totalAssetTemplate =
              createTotalAssetTemplate(
                  searchClient, team.getName(), scheduleTime, currentTime, numberOfDaysChange);
          DataInsightDescriptionAndOwnerTemplate descriptionTemplate =
              createDescriptionTemplate(
                  searchClient, team.getName(), scheduleTime, currentTime, numberOfDaysChange);
          DataInsightDescriptionAndOwnerTemplate ownershipTemplate =
              createOwnershipTemplate(
                  searchClient, team.getName(), scheduleTime, currentTime, numberOfDaysChange);
          DataInsightDescriptionAndOwnerTemplate tierTemplate =
              createTierTemplate(
                  searchClient, team.getName(), scheduleTime, currentTime, numberOfDaysChange);
          EmailUtil.sendDataInsightEmailNotificationToUser(
              emails,
              totalAssetTemplate,
              descriptionTemplate,
              ownershipTemplate,
              tierTemplate,
              EmailUtil.getDataInsightReportSubject(),
              EmailUtil.DATA_INSIGHT_REPORT_TEMPLATE);
        } catch (Exception ex) {
          LOG.error(
              "[DataInsightReport] Failed for Team: {}, Reason : {}",
              team.getName(),
              ex.getMessage());
        }
      }
    }
  }

  private void sendToAdmins(
      SearchClient searchClient, Long scheduleTime, Long currentTime, int numberOfDaysChange) {
    // Get Admins
    Set<String> emailList = getAdminsData(EMAIL);
    try {
      // Build Insights Report
      DataInsightTotalAssetTemplate totalAssetTemplate =
          createTotalAssetTemplate(
              searchClient, null, scheduleTime, currentTime, numberOfDaysChange);
      DataInsightDescriptionAndOwnerTemplate descriptionTemplate =
          createDescriptionTemplate(
              searchClient, null, scheduleTime, currentTime, numberOfDaysChange);
      DataInsightDescriptionAndOwnerTemplate ownershipTemplate =
          createOwnershipTemplate(
              searchClient, null, scheduleTime, currentTime, numberOfDaysChange);
      DataInsightDescriptionAndOwnerTemplate tierTemplate =
          createTierTemplate(searchClient, null, scheduleTime, currentTime, numberOfDaysChange);
      EmailUtil.sendDataInsightEmailNotificationToUser(
          emailList,
          totalAssetTemplate,
          descriptionTemplate,
          ownershipTemplate,
          tierTemplate,
          EmailUtil.getDataInsightReportSubject(),
          EmailUtil.DATA_INSIGHT_REPORT_TEMPLATE);
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
      SearchClient searchClient, String team, Long scheduleTime, Long currentTime, int numberOfDays)
      throws ParseException, IOException {
    // Get total Assets Data
    TreeMap<Long, List<Object>> dateWithDataMap =
        searchClient.getSortedDate(
            team,
            scheduleTime,
            currentTime,
            TOTAL_ENTITIES_BY_TYPE,
            ENTITY_REPORT_DATA_INDEX.value());
    if (dateWithDataMap.firstEntry() != null && dateWithDataMap.lastEntry() != null) {

      List<TotalEntitiesByType> first =
          JsonUtils.convertValue(dateWithDataMap.firstEntry().getValue(), new TypeReference<>() {});
      List<TotalEntitiesByType> last =
          JsonUtils.convertValue(dateWithDataMap.lastEntry().getValue(), new TypeReference<>() {});
      Double previousCount = getCountOfEntitiesFromList(first);
      Double currentCount = getCountOfEntitiesFromList(last);

      if (previousCount == 0D) {
        // it should be undefined
        return new DataInsightTotalAssetTemplate(currentCount, 0D, numberOfDays);
      } else {
        return new DataInsightTotalAssetTemplate(
            currentCount, ((currentCount - previousCount) / previousCount) * 100, numberOfDays);
      }
    }

    throw new IOException(MISSING_DATA);
  }

  private DataInsightDescriptionAndOwnerTemplate createDescriptionTemplate(
      SearchClient searchClient,
      String team,
      Long scheduleTime,
      Long currentTime,
      int numberOfDaysChange)
      throws ParseException, IOException {
    // Get total Assets Data
    // This assumes that on a particular date the correct count per entities are given
    TreeMap<Long, List<Object>> dateWithDataMap =
        searchClient.getSortedDate(
            team,
            scheduleTime,
            currentTime,
            PERCENTAGE_OF_ENTITIES_WITH_DESCRIPTION_BY_TYPE,
            ENTITY_REPORT_DATA_INDEX.value());
    if (dateWithDataMap.firstEntry() != null && dateWithDataMap.lastEntry() != null) {
      List<PercentageOfEntitiesWithDescriptionByType> first =
          JsonUtils.convertValue(dateWithDataMap.firstEntry().getValue(), new TypeReference<>() {});
      List<PercentageOfEntitiesWithDescriptionByType> last =
          JsonUtils.convertValue(dateWithDataMap.lastEntry().getValue(), new TypeReference<>() {});

      double previousCompletedDescription = getCompletedDescriptionCount(first);
      double previousTotalCount = getTotalEntityFromDescriptionList(first);
      double currentCompletedDescription = getCompletedDescriptionCount(last);
      double currentTotalCount = getTotalEntityFromDescriptionList(last);

      // Calculate Percent Change
      double previousDiff = previousTotalCount - previousCompletedDescription;
      double currentDiff = currentTotalCount - currentCompletedDescription;

      // Change
      double percentChange = 0D;
      if (previousDiff != 0) {
        percentChange = ((currentDiff - previousDiff) / previousDiff) * 100;
      }
      // Completion
      double percentCompleted = 0;
      if (currentTotalCount != 0) {
        percentCompleted = (currentCompletedDescription / currentTotalCount) * 100;
      }

      return getTemplate(
          DataInsightDescriptionAndOwnerTemplate.MetricType.DESCRIPTION,
          PERCENTAGE_OF_ENTITIES_WITH_DESCRIPTION_BY_TYPE,
          percentCompleted,
          percentChange,
          numberOfDaysChange);
    }

    throw new IOException(MISSING_DATA);
  }

  private DataInsightDescriptionAndOwnerTemplate createOwnershipTemplate(
      SearchClient searchClient,
      String team,
      Long scheduleTime,
      Long currentTime,
      int numberOfDaysChange)
      throws ParseException, IOException {
    // Get total Assets Data
    // This assumes that on a particular date the correct count per entities are given
    TreeMap<Long, List<Object>> dateWithDataMap =
        searchClient.getSortedDate(
            team,
            scheduleTime,
            currentTime,
            PERCENTAGE_OF_ENTITIES_WITH_OWNER_BY_TYPE,
            ENTITY_REPORT_DATA_INDEX.value());
    if (dateWithDataMap.firstEntry() != null && dateWithDataMap.lastEntry() != null) {
      List<PercentageOfEntitiesWithOwnerByType> first =
          JsonUtils.convertValue(dateWithDataMap.firstEntry().getValue(), new TypeReference<>() {});
      List<PercentageOfEntitiesWithOwnerByType> last =
          JsonUtils.convertValue(dateWithDataMap.lastEntry().getValue(), new TypeReference<>() {});

      double previousHasOwner = getCompletedOwnershipCount(first);
      double previousTotalCount = getTotalEntityFromOwnerList(first);
      double currentHasOwner = getCompletedOwnershipCount(last);
      double currentTotalCount = getTotalEntityFromOwnerList(last);

      // Calculate Change
      double previousDiff = previousTotalCount - previousHasOwner;
      double currentDiff = currentTotalCount - currentHasOwner;

      // Change Percent
      double percentChange = 0D;
      if (previousDiff != 0) {
        percentChange = ((currentDiff - previousDiff) / previousDiff) * 100;
      }

      // Completion
      double percentCompleted = 0;
      if (currentTotalCount != 0) {
        percentCompleted = (currentHasOwner / currentTotalCount) * 100;
      }

      return getTemplate(
          DataInsightDescriptionAndOwnerTemplate.MetricType.OWNER,
          PERCENTAGE_OF_ENTITIES_WITH_OWNER_BY_TYPE,
          percentCompleted,
          percentChange,
          numberOfDaysChange);
    }

    throw new IOException(MISSING_DATA);
  }

  private DataInsightDescriptionAndOwnerTemplate createTierTemplate(
      SearchClient searchClient,
      String team,
      Long scheduleTime,
      Long currentTime,
      int numberOfDaysChange)
      throws ParseException, IOException {
    // Get total Assets Data
    // This assumes that on a particular date the correct count per entities are given
    TreeMap<Long, List<Object>> dateWithDataMap =
        searchClient.getSortedDate(
            team,
            scheduleTime,
            currentTime,
            TOTAL_ENTITIES_BY_TIER,
            ENTITY_REPORT_DATA_INDEX.value());
    if (dateWithDataMap.lastEntry() != null) {
      List<TotalEntitiesByTier> last =
          JsonUtils.convertValue(dateWithDataMap.lastEntry().getValue(), new TypeReference<>() {});
      Map<String, Double> tierData = getTierData(last);
      return new DataInsightDescriptionAndOwnerTemplate(
          DataInsightDescriptionAndOwnerTemplate.MetricType.TIER,
          null,
          0D,
          KPI_NOT_SET,
          0D,
          false,
          "",
          numberOfDaysChange,
          tierData);
    }

    throw new IOException(MISSING_DATA);
  }

  private Double getCountOfEntitiesFromList(List<TotalEntitiesByType> entitiesByTypeList) {
    // If there are multiple entries for same entities then this can yield invalid results
    Double totalCount = 0D;
    for (TotalEntitiesByType obj : entitiesByTypeList) {
      totalCount += obj.getEntityCount();
    }
    return totalCount;
  }

  private Map<String, Double> getTierData(List<TotalEntitiesByTier> entitiesByTypeList) {
    // If there are multiple entries for same entities then this can yield invalid results
    Map<String, Double> data = new HashMap<>();
    for (TotalEntitiesByTier obj : entitiesByTypeList) {
      data.put(obj.getEntityTier(), obj.getEntityCountFraction() * 100);
    }
    return data;
  }

  private Double getTotalEntityFromDescriptionList(
      List<PercentageOfEntitiesWithDescriptionByType> entitiesByTypeList) {
    // If there are multiple entries for same entities then this can yield invalid results
    Double totalCount = 0D;
    for (PercentageOfEntitiesWithDescriptionByType obj : entitiesByTypeList) {
      totalCount += obj.getEntityCount();
    }
    return totalCount;
  }

  private Double getCompletedDescriptionCount(
      List<PercentageOfEntitiesWithDescriptionByType> entitiesByTypeList) {
    // If there are multiple entries for same entities then this can yield invalid results
    Double completedDescriptions = 0D;
    for (PercentageOfEntitiesWithDescriptionByType obj : entitiesByTypeList) {
      completedDescriptions += obj.getCompletedDescription();
    }
    return completedDescriptions;
  }

  private Double getTotalEntityFromOwnerList(
      List<PercentageOfEntitiesWithOwnerByType> entitiesByTypeList) {
    // If there are multiple entries for same entities then this can yield invalid results
    Double totalCount = 0D;
    for (PercentageOfEntitiesWithOwnerByType obj : entitiesByTypeList) {
      totalCount += obj.getEntityCount();
    }
    return totalCount;
  }

  private Double getCompletedOwnershipCount(
      List<PercentageOfEntitiesWithOwnerByType> entitiesByTypeList) {
    // If there are multiple entries for same entities then this can yield invalid results
    Double hasOwner = 0D;
    for (PercentageOfEntitiesWithOwnerByType obj : entitiesByTypeList) {
      hasOwner += obj.getHasOwner();
    }
    return hasOwner;
  }

  private DataInsightDescriptionAndOwnerTemplate getTemplate(
      DataInsightDescriptionAndOwnerTemplate.MetricType metricType,
      DataInsightChartResult.DataInsightChartType chartType,
      Double percentCompleted,
      Double percentChange,
      int numberOfDaysChange) {

    List<Kpi> kpiList = getAvailableKpi();
    Kpi validKpi = null;
    boolean isKpiAvailable = false;
    for (Kpi kpiObj : kpiList) {
      if (Objects.equals(kpiObj.getDataInsightChart().getName(), chartType.value())) {
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
      targetKpi =
          String.valueOf(
              Double.parseDouble(validKpi.getTargetDefinition().get(0).getValue()) * 100);
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
        percentCompleted,
        targetKpi,
        percentChange,
        isKpiAvailable,
        totalDaysLeft,
        numberOfDaysChange,
        null);
  }

  private long getTimeFromSchedule(
      AppSchedule appSchedule, JobExecutionContext jobExecutionContext) {
    AppSchedule.ScheduleTimeline timeline = appSchedule.getScheduleType();
    return switch (timeline) {
      case HOURLY -> 3600000L;
      case DAILY -> 86400000L;
      case WEEKLY -> 604800000L;
      case MONTHLY -> 2592000000L;
      case CUSTOM -> {
        if (jobExecutionContext.getTrigger() != null) {
          Trigger triggerQrz = jobExecutionContext.getTrigger();
          Date previousFire =
              triggerQrz.getPreviousFireTime() == null
                  ? triggerQrz.getStartTime()
                  : triggerQrz.getPreviousFireTime();
          yield previousFire.toInstant().toEpochMilli();
        }
        yield 86400000L;
      }
    };
  }

  public static int getNumberOfDays(AppSchedule appSchedule) {
    AppSchedule.ScheduleTimeline timeline = appSchedule.getScheduleType();
    switch (timeline) {
      case HOURLY:
        return 0;
      case DAILY:
        return 1;
      case WEEKLY:
        return 7;
      case MONTHLY:
        return 30;
      case CUSTOM:
        if (!CommonUtil.nullOrEmpty(appSchedule.getCronExpression())) {
          Trigger triggerQrz =
              CronScheduleBuilder.cronSchedule(appSchedule.getCronExpression()).build();
          Date previousFire =
              triggerQrz.getPreviousFireTime() == null
                  ? triggerQrz.getStartTime()
                  : triggerQrz.getPreviousFireTime();
          Date nextFire = triggerQrz.getFireTimeAfter(previousFire);
          Period period =
              Period.between(
                  previousFire.toInstant().atZone(ZoneId.systemDefault()).toLocalDate(),
                  nextFire.toInstant().atZone(ZoneId.systemDefault()).toLocalDate());
          return period.getDays();
        } else {
          throw new IllegalArgumentException("Missing Cron Expression for Custom Schedule.");
        }
    }
    throw new IllegalArgumentException("Invalid Trigger Type, Can only be Scheduled.");
  }
}
