package org.openmetadata.service.apps.bundles.retentionPolicyApp;

import org.openmetadata.schema.entity.app.RetentionJobContext;

public interface CleanupHandler {
  void performCleanup(RetentionJobContext jobContext);
}
