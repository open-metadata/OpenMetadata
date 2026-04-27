package org.openmetadata.service.migration.api;

import java.util.List;
import org.jdbi.v3.core.Handle;

public interface MigrationTestCase {
  List<TestResult> validateBefore(Handle handle);

  List<TestResult> validateAfter(Handle handle);
}
