package org.openmetadata.service.apps.bundles.searchIndex;

import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.Stats;

public interface OrchestratorContext {

  String getJobName();

  String getAppConfigJson();

  void storeRunStats(Stats stats);

  void storeRunRecord(String json);

  AppRunRecord getJobRecord();

  void pushStatusUpdate(AppRunRecord record, boolean force);

  UUID getAppId();

  Map<String, Object> getAppConfiguration();

  void updateAppConfiguration(Map<String, Object> config);

  ReindexingProgressListener createProgressListener(EventPublisherJob jobData);

  ReindexingJobContext createReindexingContext(boolean distributed);
}
