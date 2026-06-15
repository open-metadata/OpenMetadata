package org.openmetadata.service.migration.utils.v11213;

import org.jdbi.v3.core.Handle;
import org.openmetadata.service.migration.utils.PiiRecognizerMigrationUtil;

public class MigrationUtil {
  private MigrationUtil() {}

  public static void removeBroadPiiContextKeywords(Handle handle) {
    PiiRecognizerMigrationUtil.removeBroadPiiContextKeywords(handle);
  }
}
