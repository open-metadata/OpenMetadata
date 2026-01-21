package org.openmetadata.service.apps.bundles.searchIndex;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.system.StepStats;

public interface BulkSink {
  void write(List<?> entities, Map<String, Object> contextData) throws Exception;

  void updateStats(int currentSuccess, int currentFailed);

  StepStats getStats();

  /**
   * Returns the count of entities that failed during SearchIndex document construction. These are
   * entities that were passed to write() but failed before being added to the bulk request.
   */
  default long getEntityBuildFailures() {
    return 0;
  }

  void close() throws IOException;
}
