package org.openmetadata.service.apps.bundles.searchIndex;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.system.StepStats;

public interface BulkSink {
  void write(List<?> entities, Map<String, Object> contextData) throws Exception;

  void updateStats(int currentSuccess, int currentFailed);

  StepStats getStats();

  void close() throws IOException;
}
