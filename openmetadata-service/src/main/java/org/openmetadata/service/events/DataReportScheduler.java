package org.openmetadata.service.events;

import static org.openmetadata.service.Entity.DATA_REPORT;
import static org.openmetadata.service.resources.dataReports.DataReportResource.CRON_TRIGGER;
import static org.openmetadata.service.resources.dataReports.DataReportResource.DATA_INSIGHT_EMAIL_JOB;
import static org.openmetadata.service.resources.dataReports.DataReportResource.EMAIL_REPORT;
import static org.openmetadata.service.resources.dataReports.DataReportResource.ES_REST_CLIENT;
import static org.openmetadata.service.resources.dataReports.DataReportResource.JOB_CONTEXT_CHART_REPO;

import java.io.IOException;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.elasticsearch.client.RestHighLevelClient;
import org.openmetadata.schema.entity.data.DataReport;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.DataInsightChartRepository;
import org.quartz.CronScheduleBuilder;
import org.quartz.JobBuilder;
import org.quartz.JobDataMap;
import org.quartz.JobDetail;
import org.quartz.JobKey;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.quartz.Trigger;
import org.quartz.TriggerBuilder;
import org.quartz.impl.StdSchedulerFactory;

@Slf4j
public class DataReportScheduler {

  private static final ConcurrentHashMap<UUID, JobKey> reportJobKeyMap = new ConcurrentHashMap<>();

  private final DataInsightChartRepository chartRepository;
  private final Scheduler reportScheduler = new StdSchedulerFactory().getScheduler();

  public DataReportScheduler(CollectionDAO dao) throws SchedulerException {
    this.chartRepository = new DataInsightChartRepository(dao);
  }

  private JobDetail jobBuilder(DataReport dataReport, RestHighLevelClient client) throws IOException {
    switch (dataReport.getDataReportType()) {
      case DataInsight:
        JobDataMap dataMap = new JobDataMap();
        dataMap.put(JOB_CONTEXT_CHART_REPO, this.chartRepository);
        dataMap.put(ES_REST_CLIENT, client);
        dataMap.put(DATA_REPORT, dataReport);
        JobBuilder jobBuilder =
            JobBuilder.newJob(DataReportJob.class)
                .withIdentity(DATA_INSIGHT_EMAIL_JOB, EMAIL_REPORT)
                .usingJobData(dataMap);
        return jobBuilder.build();
    }
    throw new IOException("Unknown report type!");
  }

  private Trigger trigger(String scheduleConfig) {
    return TriggerBuilder.newTrigger()
        .withIdentity(CRON_TRIGGER, EMAIL_REPORT)
        .withSchedule(CronScheduleBuilder.cronSchedule(scheduleConfig))
        .build();
  }

  public void startDataInsightEmailReportPublisher(DataReport dataReport, RestHighLevelClient client) {
    try {
      JobDetail jobDetail = jobBuilder(dataReport, client);
      Trigger trigger = trigger(dataReport.getScheduleConfig());
      reportScheduler.start();
      reportScheduler.scheduleJob(jobDetail, trigger);
      reportJobKeyMap.put(dataReport.getId(), jobDetail.getKey());
    } catch (Exception ex) {
      LOG.error("Failed in setting up job Scheduler for Data Reporting", ex);
    }
  }

  public JobKey getJobKey(UUID id) {
    return reportJobKeyMap.get(id);
  }

  public void deleteDataInsightEmailReportPublisher(UUID id) throws SchedulerException {
    JobKey jobKey = getJobKey(id);
    reportScheduler.deleteJob(jobKey);
  }

  public void updateDataInsightEmailReportPublisher(DataReport dataReport, RestHighLevelClient client)
      throws SchedulerException {
    deleteDataInsightEmailReportPublisher(dataReport.getId());
    startDataInsightEmailReportPublisher(dataReport, client);
  }
}
