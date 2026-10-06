package org.openmetadata.service.apps.bundles.dataContracts;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.APP_RUN_STATS;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.FailureContext;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.datacontract.DataContractResult;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.system.EntityError;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.DataContractRepository;
import org.openmetadata.service.jdbi3.DataProductRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.RestUtil;
import org.quartz.JobExecutionContext;

@Slf4j
public class DataContractValidationApp extends AbstractNativeApplication {
  private static final String SYSTEM_USER = "system";

  private final Stats stats = new Stats();
  private JobExecutionContext jobExecutionContext;
  private final IndexingError failureDetails =
      new IndexingError().withFailedEntities(new ArrayList<>());

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

      int totalProcessed = 0;
      int totalErrors = 0;

      // Phase 1: Validate existing data contracts
      LOG.info("Phase 1: Validating existing data contracts");
      int[] phase1Results = validateExistingContracts(repository);
      totalProcessed += phase1Results[0];
      totalErrors += phase1Results[1];

      // Phase 2: Process Data Products with contracts to materialize inherited contracts
      LOG.info("Phase 2: Processing Data Products to materialize inherited contracts for assets");
      int[] phase2Results = processDataProductContracts(repository);
      totalProcessed += phase2Results[0];
      totalErrors += phase2Results[1];

      LOG.info(
          "DataContractValidationApp completed. Processed: {}, Errors: {}",
          totalProcessed,
          totalErrors);
      updateStatsRecord(AppRunRecord.Status.COMPLETED);
    } catch (Exception e) {
      LOG.error("Error running DataContractValidationApp", e);
      failureDetails
          .withErrorSource(IndexingError.ErrorSource.JOB)
          .withMessage(e.getMessage())
          .withStackTrace(ExceptionUtils.getStackTrace(e));
      updateStatsRecord(AppRunRecord.Status.FAILED);
    }
  }

  private int[] validateExistingContracts(DataContractRepository repository) {
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
        LOG.info("No more data contracts to process.");
        break;
      }

      for (DataContract dataContract : contractBatch) {
        try {
          LOG.debug("Validating data contract: {}", dataContract.getFullyQualifiedName());
          DataContractResult validationResult = validateWithInheritance(repository, dataContract);

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
          recordEntityFailure(dataContract.getFullyQualifiedName(), msg);
          totalErrors++;
        }
      }
      if (dataContracts.getPaging() != null) {
        setStats(dataContracts.getPaging().getTotal(), totalProcessed, totalErrors);
        after = dataContracts.getPaging().getAfter();
        hasMore = after != null;
      } else {
        hasMore = false;
      }
      updateStatsRecord(AppRunRecord.Status.RUNNING);
    }

    return new int[] {totalProcessed, totalErrors};
  }

  private int[] processDataProductContracts(DataContractRepository contractRepository) {
    int totalProcessed = 0;
    int totalErrors = 0;

    try {
      DataProductRepository dataProductRepository =
          (DataProductRepository) Entity.getEntityRepository(Entity.DATA_PRODUCT);

      // Use listAll with null filter since data_product_entity doesn't have a deleted column
      List<DataProduct> allDataProducts =
          dataProductRepository.listAll(
              dataProductRepository.getFields("id,fullyQualifiedName"), new ListFilter(null));

      LOG.info("Found {} Data Products to process", allDataProducts.size());

      for (DataProduct dataProduct : allDataProducts) {
        try {
          // Assets inherit only an approved Data Product contract
          DataContract dpContract = contractRepository.getEntityDataContractSafely(dataProduct);
          if (dpContract == null || dpContract.getEntityStatus() != EntityStatus.APPROVED) {
            continue;
          }

          LOG.debug(
              "Data Product {} has contract {}, checking assets",
              dataProduct.getName(),
              dpContract.getName());

          // Paginate through all assets
          int assetLimit = 100;
          int assetOffset = 0;
          boolean hasMoreAssets = true;

          while (hasMoreAssets) {
            ResultList<EntityReference> assetsResult =
                dataProductRepository.getDataProductAssets(
                    dataProduct.getId(), assetLimit, assetOffset);

            if (nullOrEmpty(assetsResult.getData())) {
              break;
            }

            // Process each asset in this batch
            for (EntityReference assetRef : assetsResult.getData()) {
              if (!contractRepository.isEntityTypeSupported(assetRef.getType())) {
                LOG.warn(
                    "Skipping asset {} (entity type '{}' is not supported for data contracts)",
                    assetRef.getName(),
                    assetRef.getType());
                continue;
              }
              try {
                // Get the asset entity
                EntityInterface asset =
                    Entity.getEntity(
                        assetRef.getType(), assetRef.getId(), "*", Include.NON_DELETED);

                // An asset with a contract of its own, including one materialized on an earlier
                // run, was validated with what it inherits in the first phase
                if (contractRepository.getEntityDataContractSafely(asset) != null) {
                  continue;
                }

                // The asset only inherits the contract: materialize one to hold the results
                Optional<RestUtil.PutResponse<DataContractResult>> validationResponse =
                    contractRepository.validateEntityContract(asset, SYSTEM_USER);
                validationResponse.ifPresent(
                    response ->
                        LOG.debug(
                            "Materialized and validated contract for {}: Status = {}",
                            asset.getName(),
                            response.getEntity().getContractExecutionStatus()));
                totalProcessed += validationResponse.isPresent() ? 1 : 0;
              } catch (Exception e) {
                String msg =
                    String.format(
                        "Failed to process asset %s from Data Product %s: %s",
                        assetRef.getName(), dataProduct.getName(), e.getMessage());
                LOG.error(msg, e);
                recordEntityFailure(assetRef.getFullyQualifiedName(), msg);
                totalErrors++;
              }
            }

            // Move to next batch if we received a full batch
            assetOffset += assetLimit;
            hasMoreAssets = assetsResult.getData().size() == assetLimit;
          }
        } catch (Exception e) {
          String msg =
              String.format(
                  "Failed to process Data Product %s: %s", dataProduct.getName(), e.getMessage());
          LOG.error(msg, e);
          recordEntityFailure(dataProduct.getFullyQualifiedName(), msg);
          totalErrors++;
        }
      }
    } catch (Exception e) {
      LOG.error("Error processing Data Products: {}", e.getMessage(), e);
      recordEntityFailure("dataProductProcessing", e.getMessage());
    }

    return new int[] {totalProcessed, totalErrors};
  }

  /**
   * Validates a contract with what its entity inherits from a Data Product, as on-demand validation
   * does; validating the stored contract alone would skip every inherited rule.
   */
  private static DataContractResult validateWithInheritance(
      DataContractRepository repository, DataContract dataContract) {
    EntityReference entityRef = dataContract.getEntity();
    EntityInterface entity =
        Entity.getEntity(entityRef.getType(), entityRef.getId(), "*", Include.NON_DELETED);
    return repository
        .validateEntityContract(entity, SYSTEM_USER)
        .orElseGet(() -> repository.validateContract(dataContract))
        .getEntity();
  }

  private void setStats(Integer totalRecords, Integer successRecords, Integer failedRecords) {
    StepStats jobStats =
        new StepStats()
            .withTotalRecords(totalRecords)
            .withSuccessRecords(successRecords)
            .withFailedRecords(failedRecords);
    stats.setJobStats(jobStats);
  }

  private void recordEntityFailure(String entity, String message) {
    failureDetails
        .getFailedEntities()
        .add(new EntityError().withEntity(entity).withMessage(message));
  }

  private boolean hasFailures() {
    return failureDetails.getMessage() != null || !nullOrEmpty(failureDetails.getFailedEntities());
  }

  private void updateStatsRecord(AppRunRecord.Status status) {
    AppRunRecord appRecord = getJobRecord(jobExecutionContext);
    appRecord.setStatus(status);

    if (hasFailures()) {
      appRecord.setFailureContext(new FailureContext().withFailure(failureDetails));
      appRecord.setStatus(AppRunRecord.Status.FAILED);
    }

    LOG.info("AppRecord before DB save: {}", JsonUtils.pojoToJson(appRecord));
    pushAppStatusUpdates(jobExecutionContext, appRecord, true);
    LOG.info("Final AppRunRecord update: {}", JsonUtils.pojoToJson(appRecord));
  }
}
