package org.openmetadata.service.events;

import static org.openmetadata.schema.dataInsight.DataInsightChartResult.DataInsightChartType.PERCENTAGE_OF_ENTITIES_WITH_DESCRIPTION_BY_TYPE;
import static org.openmetadata.schema.dataInsight.DataInsightChartResult.DataInsightChartType.PERCENTAGE_OF_ENTITIES_WITH_OWNER_BY_TYPE;
import static org.openmetadata.service.Entity.DATA_REPORT;
import static org.openmetadata.service.elasticsearch.ElasticSearchIndexDefinition.ElasticSearchIndexType.ENTITY_REPORT_DATA_INDEX;
import static org.openmetadata.service.resources.dataReports.DataReportResource.ES_REST_CLIENT;
import static org.openmetadata.service.resources.dataReports.DataReportResource.JOB_CONTEXT_CHART_REPO;

import java.io.IOException;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.elasticsearch.action.search.SearchRequest;
import org.elasticsearch.action.search.SearchResponse;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestHighLevelClient;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;
import org.openmetadata.schema.dataInsight.type.PercentageOfEntitiesWithDescriptionByType;
import org.openmetadata.schema.dataInsight.type.PercentageOfEntitiesWithOwnerByType;
import org.openmetadata.schema.entity.data.DataReport;
import org.openmetadata.service.jdbi3.DataInsightChartRepository;
import org.openmetadata.service.util.EmailUtil;
import org.openmetadata.service.util.GraphUtil;
import org.quartz.Job;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;

@Slf4j
public class DataReportJob implements Job {

  @Override
  public void execute(JobExecutionContext jobExecutionContext) throws JobExecutionException {
    DataInsightChartRepository repository =
        (DataInsightChartRepository) jobExecutionContext.getJobDetail().getJobDataMap().get(JOB_CONTEXT_CHART_REPO);
    RestHighLevelClient client =
        (RestHighLevelClient) jobExecutionContext.getJobDetail().getJobDataMap().get(ES_REST_CLIENT);
    DataReport dataReport = (DataReport) jobExecutionContext.getJobDetail().getJobDataMap().get(DATA_REPORT);
    Date nextFireTime = jobExecutionContext.getTrigger().getNextFireTime();
    Long currentTime = Instant.now().toEpochMilli();
    Long timeDifference = nextFireTime.getTime() - currentTime;
    Long scheduleTime = currentTime - timeDifference;

    try {
      // Aggregate date for Description
      String descriptionUrl = buildDescriptionUrl(repository, client, scheduleTime, currentTime);
      String ownerUrl = buildOwnerUrl(repository, client, scheduleTime, currentTime);
      //  repository.
      for (String email : dataReport.getEndpointConfiguration().getRecipientMails()) {
        EmailUtil.getInstance()
            .sendDataInsightEmailNotificationToUser(
                email,
                String.format("%s/data-insights", EmailUtil.getInstance().getOMUrl()),
                descriptionUrl,
                ownerUrl,
                EmailUtil.getInstance().getSupportUrl(),
                EmailUtil.getInstance().getDataInsightReportSubject(),
                EmailUtil.DATA_INSIGHT_REPORT_TEMPLATE);
      }
    } catch (Exception e) {
      LOG.error("[DIReport] Failed in sending report due to", e);
      throw new RuntimeException(e);
    }
  }

  private String buildDescriptionUrl(
      DataInsightChartRepository repository, RestHighLevelClient client, Long scheduleTime, Long currentTime)
      throws IOException, ParseException {
    SearchRequest searchRequest =
        repository.buildSearchRequest(
            scheduleTime,
            currentTime,
            null,
            null,
            PERCENTAGE_OF_ENTITIES_WITH_DESCRIPTION_BY_TYPE,
            ENTITY_REPORT_DATA_INDEX.indexName);
    SearchResponse searchResponse = client.search(searchRequest, RequestOptions.DEFAULT);
    DataInsightChartResult processedData =
        repository.processDataInsightChartResult(searchResponse, PERCENTAGE_OF_ENTITIES_WITH_DESCRIPTION_BY_TYPE);

    Map<String, List<PercentageOfEntitiesWithDescriptionByType>> sortedDataMap = new HashMap<>();
    List<String> entityType = new ArrayList<>();
    Map<String, List<PercentageOfEntitiesWithDescriptionByType>> dateMap = new HashMap<>();
    for (Object data : processedData.getData()) {
      PercentageOfEntitiesWithDescriptionByType formattedData = (PercentageOfEntitiesWithDescriptionByType) data;
      List<PercentageOfEntitiesWithDescriptionByType> listChartType;
      if (sortedDataMap.containsKey(formattedData.getEntityType())) {
        listChartType = sortedDataMap.get(formattedData.getEntityType());
      } else {
        listChartType = new ArrayList<>();
      }
      listChartType.add(formattedData);
      sortedDataMap.put(formattedData.getEntityType(), listChartType);
      entityType.add(formattedData.getEntityType());
    }
    for (var entry : sortedDataMap.entrySet()) {
      for (PercentageOfEntitiesWithDescriptionByType formattedData : entry.getValue()) {
        Date date = new Date(formattedData.getTimestamp());
        String justDate = new SimpleDateFormat("dd/MM/yyyy").format(date);
        // put data to map
        List<PercentageOfEntitiesWithDescriptionByType> listChartType;
        if (dateMap.containsKey(justDate)) {
          listChartType = dateMap.get(justDate);
        } else {
          listChartType = new ArrayList<>();
        }
        listChartType.add(formattedData);
        dateMap.put(justDate, listChartType);
      }
    }
    return GraphUtil.buildDescriptionImageUrl(dateMap, entityType);
  }

  private String buildOwnerUrl(
      DataInsightChartRepository repository, RestHighLevelClient client, Long scheduleTime, Long currentTime)
      throws ParseException, IOException {
    SearchRequest searchRequest =
        repository.buildSearchRequest(
            scheduleTime,
            currentTime,
            null,
            null,
            PERCENTAGE_OF_ENTITIES_WITH_OWNER_BY_TYPE,
            ENTITY_REPORT_DATA_INDEX.indexName);
    SearchResponse searchResponse = client.search(searchRequest, RequestOptions.DEFAULT);
    DataInsightChartResult processedData =
        repository.processDataInsightChartResult(searchResponse, PERCENTAGE_OF_ENTITIES_WITH_OWNER_BY_TYPE);

    Map<String, List<PercentageOfEntitiesWithOwnerByType>> sortedDataMap = new HashMap<>();
    List<String> entityType = new ArrayList<>();
    Map<String, List<PercentageOfEntitiesWithOwnerByType>> dateMap = new HashMap<>();
    for (Object data : processedData.getData()) {
      PercentageOfEntitiesWithOwnerByType formattedData = (PercentageOfEntitiesWithOwnerByType) data;
      List<PercentageOfEntitiesWithOwnerByType> listChartType;
      if (sortedDataMap.containsKey(formattedData.getEntityType())) {
        listChartType = sortedDataMap.get(formattedData.getEntityType());
      } else {
        listChartType = new ArrayList<>();
      }
      listChartType.add(formattedData);
      sortedDataMap.put(formattedData.getEntityType(), listChartType);
      entityType.add(formattedData.getEntityType());
    }
    for (var entry : sortedDataMap.entrySet()) {
      for (PercentageOfEntitiesWithOwnerByType formattedData : entry.getValue()) {
        Date date = new Date(formattedData.getTimestamp());
        String justDate = new SimpleDateFormat("dd/MM/yyyy").format(date);
        // put data to map
        List<PercentageOfEntitiesWithOwnerByType> listChartType;
        if (dateMap.containsKey(justDate)) {
          listChartType = dateMap.get(justDate);
        } else {
          listChartType = new ArrayList<>();
        }
        listChartType.add(formattedData);
        dateMap.put(justDate, listChartType);
      }
    }
    return GraphUtil.buildOwnerImageUrl(dateMap, entityType);
  }
}
