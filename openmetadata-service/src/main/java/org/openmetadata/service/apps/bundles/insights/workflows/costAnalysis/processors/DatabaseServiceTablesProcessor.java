package org.openmetadata.service.apps.bundles.insights.workflows.costAnalysis.processors;

import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getUpdatedStats;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.glassfish.jersey.internal.util.ExceptionUtils;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.type.AccessDetails;
import org.openmetadata.schema.type.LifeCycle;
import org.openmetadata.schema.type.TableProfile;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.insights.workflows.costAnalysis.CostAnalysisWorkflow;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.workflows.interfaces.Processor;

@Slf4j
public class DatabaseServiceTablesProcessor
    implements Processor<
        List<CostAnalysisWorkflow.CostAnalysisTableData>, ResultList<? extends EntityInterface>> {
  private final StepStats stats = new StepStats();

  public DatabaseServiceTablesProcessor(int total) {
    this.stats.withTotalRecords(total).withSuccessRecords(0).withFailedRecords(0);
  }

  @Override
  public List<CostAnalysisWorkflow.CostAnalysisTableData> process(
      ResultList<? extends EntityInterface> input, Map<String, Object> contextData)
      throws SearchIndexException {
    List<CostAnalysisWorkflow.CostAnalysisTableData> costAnalysisTableDataList = new ArrayList<>();
    try {
      for (EntityInterface entity : input.getData()) {
        Table table = (Table) entity;
        Optional<LifeCycle> oTableLifeCycle = Optional.empty();
        Optional<Double> oSize = Optional.empty();

        // Get LifeCycle information if it was accessed.
        Optional<LifeCycle> oTableLifeCycleData = Optional.ofNullable(table.getLifeCycle());
        if (oTableLifeCycleData.isPresent()) {
          Optional<AccessDetails> oAccessed =
              Optional.ofNullable(oTableLifeCycleData.get().getAccessed());

          if (oAccessed.isPresent()) {
            oTableLifeCycle = oTableLifeCycleData;
          }
        }

        // Get Size data directly from DAO.
        CollectionDAO daoCollection = Entity.getDao();
        String profileJson =
            daoCollection
                .profilerDataTimeSeriesDao()
                .getLatestExtension(
                    table.getFullyQualifiedName(), TableRepository.TABLE_PROFILE_EXTENSION);

        TableProfile tableProfile =
            profileJson != null ? JsonUtils.readValue(profileJson, TableProfile.class) : null;
        Optional<TableProfile> oTableProfile = Optional.ofNullable(tableProfile);

        if (oTableProfile.isPresent()) {
          oSize = Optional.ofNullable(oTableProfile.get().getSizeInByte());
        }

        if (oTableLifeCycle.isPresent() || oSize.isPresent()) {
          costAnalysisTableDataList.add(
              new CostAnalysisWorkflow.CostAnalysisTableData(table, oTableLifeCycle, oSize));
        }
      }
      updateStats(input.getData().size(), 0);
    } catch (Exception e) {
      IndexingError error =
          new IndexingError()
              .withErrorSource(IndexingError.ErrorSource.PROCESSOR)
              .withSubmittedCount(input.getData().size())
              .withFailedCount(input.getData().size())
              .withSuccessCount(0)
              .withMessage(
                  String.format(
                      "Database Service Tables Processor Encounter Failure: %s", e.getMessage()))
              .withStackTrace(ExceptionUtils.exceptionStackTraceAsString(e));
      LOG.debug(
          "[DatabaseServiceTAblesProcessor] Failed. Details: {}", JsonUtils.pojoToJson(error));
      updateStats(0, input.getData().size());
      throw new SearchIndexException(error);
    }
    return costAnalysisTableDataList;
  }

  @Override
  public void updateStats(int currentSuccess, int currentFailed) {
    getUpdatedStats(stats, currentSuccess, currentFailed);
  }

  @Override
  public StepStats getStats() {
    return stats;
  }
}
