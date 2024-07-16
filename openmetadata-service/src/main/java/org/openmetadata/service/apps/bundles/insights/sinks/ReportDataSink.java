package org.openmetadata.service.apps.bundles.insights.sinks;

import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.glassfish.jersey.internal.util.ExceptionUtils;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.ReportDataRepository;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.workflows.interfaces.Sink;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.openmetadata.service.apps.bundles.insights.DataInsightsApp.REPORT_DATA_TYPE_KEY;
import static org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils.TIMESTAMP_KEY;
import static org.openmetadata.service.jdbi3.ReportDataRepository.REPORT_DATA_EXTENSION;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getUpdatedStats;

@Slf4j
public class ReportDataSink implements Sink<List<ReportData>, Boolean> {
    @Getter private final String name;
    private final StepStats stats = new StepStats();
    private final Boolean deleteRecords;

    public ReportDataSink(int total, String name) {
        this.stats.withTotalRecords(total).withSuccessRecords(0).withFailedRecords(0);
        this.name = name;
        this.deleteRecords = false;
    }
    public ReportDataSink(int total, String name, Boolean deleteRecords) {
        this.stats.withTotalRecords(total).withSuccessRecords(0).withFailedRecords(0);
        this.name = name;
        this.deleteRecords = deleteRecords;
    }

    @Override
    public Boolean write(List<ReportData> data, Map<String, Object> contextData) throws SearchIndexException {
        // TODO: Understand better how the deleteReportDataRecords and createReportDataRecords might fail.
        try {
            Long timestamp = (long) contextData.get(TIMESTAMP_KEY);
            ReportData.ReportDataType reportDataType = (ReportData.ReportDataType) contextData.get(REPORT_DATA_TYPE_KEY);

            if (deleteRecords) {
                deleteReportDataRecords(reportDataType);
            } else {
                deleteReportDataRecordsAtDate(timestamp, reportDataType);
            }

            createReportDataRecords(data, reportDataType);
            updateStats(data.size(), 0);
        } catch (Exception e) {
            IndexingError indexingError =
                    new IndexingError()
                            .withErrorSource(IndexingError.ErrorSource.SINK)
                            .withSubmittedCount(data.size())
                            .withSuccessCount(0)
                            .withFailedCount(data.size())
                            .withMessage("Couldn't write ReportData to Database.")
                            .withStackTrace(ExceptionUtils.exceptionStackTraceAsString(e));
            LOG.debug("[ReportDataSink] Failed, Details: {}", JsonUtils.pojoToJson(indexingError));
            updateStats(0, data.size());
            throw new SearchIndexException(indexingError);
        }
        return true;
    }

    private void deleteReportDataRecordsAtDate(Long timestamp, ReportData.ReportDataType reportDataType) {
        String timestampString = TimestampUtils.timestampToString(timestamp, "yyyy-MM-dd");
        ((ReportDataRepository) Entity.getEntityTimeSeriesRepository(Entity.ENTITY_REPORT_DATA)).deleteReportDataAtDate(reportDataType, timestampString);
    }

    private void deleteReportDataRecords(ReportData.ReportDataType reportDataType) {
        ((ReportDataRepository) Entity.getEntityTimeSeriesRepository(Entity.ENTITY_REPORT_DATA)).deleteReportData(reportDataType);
    }

    private void createReportDataRecords(List<ReportData> reportDataList, ReportData.ReportDataType reportDataType) {
        for (ReportData reportData : reportDataList) {
            ((ReportDataRepository) Entity.getEntityTimeSeriesRepository(Entity.ENTITY_REPORT_DATA)).createNewRecord(reportData, REPORT_DATA_EXTENSION, reportDataType.toString());
        }
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
