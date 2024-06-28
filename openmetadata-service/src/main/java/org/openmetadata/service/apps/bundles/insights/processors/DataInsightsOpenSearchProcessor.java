package org.openmetadata.service.apps.bundles.insights.processors;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.workflows.interfaces.Processor;
import os.org.opensearch.action.bulk.BulkRequest;

import java.util.List;
import java.util.Map;

import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getUpdatedStats;

@Slf4j
public class DataInsightsOpenSearchProcessor
        implements Processor<BulkRequest, List<Map<String, Object>>> {

    private final StepStats stats = new StepStats();

    public DataInsightsOpenSearchProcessor(int total) {
        this.stats.withTotalRecords(total).withSuccessRecords(0).withFailedRecords(0);
    }

    @Override
    public BulkRequest process(
            List<Map<String, Object>> input,
            Map<String, Object> contextData)
            throws SearchIndexException {
        return new BulkRequest();
    }
    @Override
    public void updateStats(int currentSuccess, int currentFailed) {
        getUpdatedStats(stats, currentSuccess, currentFailed);
    }

    @Override
    public StepStats getStats() { return stats; }
}
