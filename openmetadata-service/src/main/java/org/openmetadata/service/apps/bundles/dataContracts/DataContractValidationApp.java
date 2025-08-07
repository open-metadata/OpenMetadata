package org.openmetadata.service.apps.bundles.dataContracts;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.APP_RUN_STATS;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.exception.ExceptionUtils;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.FailureContext;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.datacontract.DataContractResult;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.DataContractRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.ResultList;
import org.quartz.JobExecutionContext;

@Slf4j
public class DataContractValidationApp extends AbstractNativeApplication {

  private final Stats stats = new Stats();
  private JobExecutionContext jobExecutionContext;
  private Map<String, Object> failureDetails = new HashMap<>();

  public DataContractValidationApp(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
  }

  @Override
  public void startApp(JobExecutionContext jobExecutionContext) {
    this.jobExecutionContext = jobExecutionContext;
    try {
      LOG.info("Starting DataContractValidationApp to validate existing data contracts");
      setStats(0, 0, 0);
      jobExecutionContext.getJobDetail().getJobDataMap().put(APP_RUN_STATS, stats);
      updateStatsRecord(AppRunRecord.Status.RUNNING);

      DataContractRepository repository =
          (DataContractRepository) Entity.getEntityRepository(Entity.DATA_CONTRACT);
      ListFilter filter = new ListFilter();

      int limit = 100;
      String after = null;
      int totalProcessed = 0;
      int totalErrors = 0;
      boolean hasMore = true;

      while (hasMore) {
        ResultList<DataContract> dataContracts =
            repository.listAfter(null, EntityUtil.Fields.EMPTY_FIELDS, filter, limit, after);

        List<DataContract> contractBatch = dataContracts.getData();
        LOG.info("Processing batch of {} data contracts", contractBatch.size());

        if (nullOrEmpty(contractBatch)) {
          LOG.info("No more data contracts to process. Exiting.");
          break;
        }

        for (DataContract dataContract : contractBatch) {
          try {
            LOG.debug("Validating data contract: {}", dataContract.getFullyQualifiedName());
            DataContractResult validationResult = repository.validateContract(dataContract);

            LOG.debug(
                "Validation completed for {}: Status = {}",
                dataContract.getFullyQualifiedName(),
                validationResult.getContractExecutionStatus());
            totalProcessed++;
          } catch (Exception e) {
            String msg =
                String.format(
                    "Failed to validate data contract %s: %s",
                    dataContract.getFullyQualifiedName(), e.getMessage());
            LOG.error(msg, e);
            failureDetails.put(dataContract.getFullyQualifiedName(), msg);
            totalErrors++;
          }
        }
        after = dataContracts.getPaging() != null ? dataContracts.getPaging().getAfter() : null;
        hasMore = after != null;

        setStats(dataContracts.getPaging().getTotal(), totalProcessed, totalErrors);
        updateStatsRecord(AppRunRecord.Status.RUNNING);
      }

      LOG.info(
          "DataContractValidationApp completed. Processed: {}, Errors: {}",
          totalProcessed,
          totalErrors);
      updateStatsRecord(AppRunRecord.Status.COMPLETED);
    } catch (Exception e) {
      LOG.error("Error running DataContractValidationApp", e);
      failureDetails.put("message", e.getMessage());
      failureDetails.put("jobStackTrace", ExceptionUtils.getStackTrace(e));
      updateStatsRecord(AppRunRecord.Status.FAILED);
    }
  }

  private void setStats(Integer totalRecords, Integer successRecords, Integer failedRecords) {
    StepStats jobStats =
        new StepStats()
            .withTotalRecords(totalRecords)
            .withSuccessRecords(successRecords)
            .withFailedRecords(failedRecords);
    stats.setJobStats(jobStats);
  }

  private void updateStatsRecord(AppRunRecord.Status status) {
    AppRunRecord appRecord = getJobRecord(jobExecutionContext);
    appRecord.setStatus(status);

    if (!nullOrEmpty(failureDetails)) {
      appRecord.setFailureContext(
          new FailureContext().withAdditionalProperty("failure", failureDetails));
      appRecord.setStatus(AppRunRecord.Status.FAILED);
    }

    LOG.info("AppRecord before DB save: {}", JsonUtils.pojoToJson(appRecord));
    pushAppStatusUpdates(jobExecutionContext, appRecord, true);
    LOG.info("Final AppRunRecord update: {}", JsonUtils.pojoToJson(appRecord));
  }
}
