/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.events.scheduled;

import static org.openmetadata.schema.dataInsight.DataInsightChartResult.DataInsightChartType.PERCENTAGE_OF_ENTITIES_WITH_DESCRIPTION_BY_TYPE;
import static org.openmetadata.schema.dataInsight.DataInsightChartResult.DataInsightChartType.PERCENTAGE_OF_ENTITIES_WITH_OWNER_BY_TYPE;
import static org.openmetadata.schema.dataInsight.DataInsightChartResult.DataInsightChartType.TOTAL_ENTITIES_BY_TIER;
import static org.openmetadata.schema.dataInsight.DataInsightChartResult.DataInsightChartType.TOTAL_ENTITIES_BY_TYPE;
import static org.openmetadata.schema.type.DataReportIndex.ENTITY_REPORT_DATA_INDEX;
import static org.openmetadata.service.Entity.EVENT_SUBSCRIPTION;
import static org.openmetadata.service.Entity.KPI;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.events.scheduled.ReportsHandler.SEARCH_CLIENT;
import static org.openmetadata.service.util.SubscriptionUtil.getAdminsData;
import static org.openmetadata.service.util.SubscriptionUtil.getNumberOfDays;

import com.fasterxml.jackson.core.type.TypeReference;
import java.io.IOException;
import java.text.ParseException;
import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.alert.type.DataInsightAlertConfig;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;
import org.openmetadata.schema.dataInsight.kpi.Kpi;
import org.openmetadata.schema.dataInsight.type.KpiResult;
import org.openmetadata.schema.dataInsight.type.PercentageOfEntitiesWithDescriptionByType;
import org.openmetadata.schema.dataInsight.type.PercentageOfEntitiesWithOwnerByType;
import org.openmetadata.schema.dataInsight.type.TotalEntitiesByTier;
import org.openmetadata.schema.dataInsight.type.TotalEntitiesByType;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.TriggerConfig;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.scheduled.template.DataInsightDescriptionAndOwnerTemplate;
import org.openmetadata.service.events.scheduled.template.DataInsightTotalAssetTemplate;
import org.openmetadata.service.exception.DataInsightJobException;
import org.openmetadata.service.jdbi3.KpiRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.EmailUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntitiesSource;
import org.quartz.Job;
import org.quartz.JobExecutionContext;

@Slf4j
public class DataInsightsReportJob implements Job {
  private static final String KPI_NOT_SET = "No Kpi Set";

  @Override
  public void execute(JobExecutionContext jobExecutionContext) {
    SearchRepository searchRepository =
        (SearchRepository) jobExecutionContext.getJobDetail().getJobDataMap().get(SEARCH_CLIENT);
    EventSubscription dataReport =
        (EventSubscription) jobExecutionContext.getJobDetail().getJobDataMap().get(EVENT_SUBSCRIPTION);
    // Calculate time diff
    long currentTime = Instant.now().toEpochMilli();
    long scheduleTime = currentTime - getTimeFromSchedule(dataReport.getTrigger());
    int numberOfDaysChange = getNumberOfDays(dataReport.getTrigger());
    try {
      DataInsightAlertConfig insightAlertConfig =
          JsonUtils.convertValue(dataReport.getSubscriptionConfig(), DataInsightAlertConfig.class);
      // Send to Admins
      if (Boolean.TRUE.equals(insightAlertConfig.getSendToAdmins())) {
        sendToAdmins(searchRepository, scheduleTime, currentTime, numberOfDaysChange);
      }

      // Send to Teams
      if (Boolean.TRUE.equals(insightAlertConfig.getSendToTeams())) {
        sendReportsToTeams(searchRepository, scheduleTime, currentTime, numberOfDaysChange);
      }
    } catch (Exception e) {
      LOG.error("[DIReport] Failed in sending report due to", e);
      throw new DataInsightJobException(e);
    }
  }

  private void sendReportsToTeams(
      SearchRepository searchRepository, Long scheduleTime, Long currentTime, int numberOfDaysChange) {
    PaginatedEntitiesSource teamReader = new PaginatedEntitiesSource(TEAM, 10, List.of("name", "email", "users"));
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
              createTotalAssetTemplate(searchRepository, team.getName(), scheduleTime, currentTime, numberOfDaysChange);
          DataInsightDescriptionAndOwnerTemplate descriptionTemplate =
              createDescriptionTemplate(
                  searchRepository, team.getName(), scheduleTime, currentTime, numberOfDaysChange);
          DataInsightDescriptionAndOwnerTemplate ownershipTemplate =
              createOwnershipTemplate(searchRepository, team.getName(), scheduleTime, currentTime, numberOfDaysChange);
          DataInsightDescriptionAndOwnerTemplate tierTemplate =
              createTierTemplate(searchRepository, team.getName(), scheduleTime, currentTime, numberOfDaysChange);
          EmailUtil.sendDataInsightEmailNotificationToUser(
              emails,
              totalAssetTemplate,
              descriptionTemplate,
              ownershipTemplate,
              tierTemplate,
              EmailUtil.getDataInsightReportSubject(),
              EmailUtil.DATA_INSIGHT_REPORT_TEMPLATE);
        } catch (Exception ex) {
          LOG.error("[DataInsightReport] Failed for Team: {}, Reason : {}", team.getName(), ex.getMessage());
        }
      }
    }
  }

  private void sendToAdmins(
      SearchRepository searchRepository, Long scheduleTime, Long currentTime, int numberOfDaysChange) {
    // Get Admins
    Set<String> emailList = getAdminsData(CreateEventSubscription.SubscriptionType.DATA_INSIGHT);

    try {
      // Build Insights Report
      DataInsightTotalAssetTemplate totalAssetTemplate =
          createTotalAssetTemplate(searchRepository, null, scheduleTime, currentTime, numberOfDaysChange);
      DataInsightDescriptionAndOwnerTemplate descriptionTemplate =
          createDescriptionTemplate(searchRepository, null, scheduleTime, currentTime, numberOfDaysChange);
      DataInsightDescriptionAndOwnerTemplate ownershipTemplate =
          createOwnershipTemplate(searchRepository, null, scheduleTime, currentTime, numberOfDaysChange);
      DataInsightDescriptionAndOwnerTemplate tierTemplate =
          createTierTemplate(searchRepository, null, scheduleTime, currentTime, numberOfDaysChange);
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
    return repository.listAll(repository.getFields("dataInsightChart"), new ListFilter(Include.NON_DELETED));
  }

  private KpiResult getKpiResult(String fqn) {
    KpiRepository repository = (KpiRepository) Entity.getEntityRepository(KPI);
    return repository.getKpiResult(fqn);
  }

  private DataInsightTotalAssetTemplate createTotalAssetTemplate(
      SearchRepository searchRepository, String team, Long scheduleTime, Long currentTime, int numberOfDays)
      throws ParseException, IOException {
    // Get total Assets Data
    TreeMap<Long, List<Object>> dateWithDataMap =
        searchRepository.getSortedDate(
            team, scheduleTime, currentTime, TOTAL_ENTITIES_BY_TYPE, ENTITY_REPORT_DATA_INDEX.value());
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

    throw new IOException("Failed to get Total Asset Template Data.");
  }

  private DataInsightDescriptionAndOwnerTemplate createDescriptionTemplate(
      SearchRepository searchRepository, String team, Long scheduleTime, Long currentTime, int numberOfDaysChange)
      throws ParseException, IOException {
    // Get total Assets Data
    // This assumes that on a particular date the correct count per entities are given
    TreeMap<Long, List<Object>> dateWithDataMap =
        searchRepository.getSortedDate(
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

    throw new IOException("Failed to get Description Template Data.");
  }

  private DataInsightDescriptionAndOwnerTemplate createOwnershipTemplate(
      SearchRepository searchRepository, String team, Long scheduleTime, Long currentTime, int numberOfDaysChange)
      throws ParseException, IOException {
    // Get total Assets Data
    // This assumes that on a particular date the correct count per entities are given
    TreeMap<Long, List<Object>> dateWithDataMap =
        searchRepository.getSortedDate(
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

    throw new IOException("Failed to get OwnerShip Template Data.");
  }

  private DataInsightDescriptionAndOwnerTemplate createTierTemplate(
      SearchRepository searchRepository, String team, Long scheduleTime, Long currentTime, int numberOfDaysChange)
      throws ParseException, IOException {
    // Get total Assets Data
    // This assumes that on a particular date the correct count per entities are given
    TreeMap<Long, List<Object>> dateWithDataMap =
        searchRepository.getSortedDate(
            team, scheduleTime, currentTime, TOTAL_ENTITIES_BY_TIER, ENTITY_REPORT_DATA_INDEX.value());
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

    throw new IOException("Failed to get Tier Template Data.");
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

  private Double getTotalEntityFromDescriptionList(List<PercentageOfEntitiesWithDescriptionByType> entitiesByTypeList) {
    // If there are multiple entries for same entities then this can yield invalid results
    Double totalCount = 0D;
    for (PercentageOfEntitiesWithDescriptionByType obj : entitiesByTypeList) {
      totalCount += obj.getEntityCount();
    }
    return totalCount;
  }

  private Double getCompletedDescriptionCount(List<PercentageOfEntitiesWithDescriptionByType> entitiesByTypeList) {
    // If there are multiple entries for same entities then this can yield invalid results
    Double completedDescriptions = 0D;
    for (PercentageOfEntitiesWithDescriptionByType obj : entitiesByTypeList) {
      completedDescriptions += obj.getCompletedDescription();
    }
    return completedDescriptions;
  }

  private Double getTotalEntityFromOwnerList(List<PercentageOfEntitiesWithOwnerByType> entitiesByTypeList) {
    // If there are multiple entries for same entities then this can yield invalid results
    Double totalCount = 0D;
    for (PercentageOfEntitiesWithOwnerByType obj : entitiesByTypeList) {
      totalCount += obj.getEntityCount();
    }
    return totalCount;
  }

  private Double getCompletedOwnershipCount(List<PercentageOfEntitiesWithOwnerByType> entitiesByTypeList) {
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
      targetKpi = String.valueOf(Double.parseDouble(validKpi.getTargetDefinition().get(0).getValue()) * 100);
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

  private long getTimeFromSchedule(TriggerConfig config) {
    if (config.getTriggerType() == TriggerConfig.TriggerType.SCHEDULED) {
      TriggerConfig.ScheduleInfo scheduleInfo = config.getScheduleInfo();
      switch (scheduleInfo) {
        case DAILY:
          return 86400000L;
        case WEEKLY:
          return 604800000L;
        case MONTHLY:
          return 2592000000L;
        default:
          throw new IllegalArgumentException("Invalid Trigger Type, Cannot be Scheduled.");
      }
    }
    throw new IllegalArgumentException("Invalid Trigger Type, Cannot be Scheduled.");
  }
}
