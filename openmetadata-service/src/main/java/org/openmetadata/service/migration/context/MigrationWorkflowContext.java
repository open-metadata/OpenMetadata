package org.openmetadata.service.migration.context;

import java.util.HashMap;
import java.util.List;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.service.migration.api.MigrationProcess;

@Slf4j
public class MigrationWorkflowContext {
  @Getter private HashMap<String, MigrationContext> migrationContext;
  private final MigrationContext initialContext;
  private final Handle handle;

  public MigrationWorkflowContext(Handle handle) {
    this.migrationContext = new HashMap<>();
    this.handle = handle;

    // Initialize the context only with the common ops
    this.initialContext = new MigrationContext("initial", List.of(), handle);
  }

  public void computeInitialContext() {
    computeMigrationSafely(this.initialContext);
  }

  public void computeMigrationContext(MigrationProcess process) {
    MigrationContext context = new MigrationContext(process.getVersion(), process.getMigrationOps(), handle);
    computeMigrationSafely(context);
  }

  private void computeMigrationSafely(MigrationContext context) {
    try {
      context.compute();
      context.show();
      this.migrationContext.put(context.getVersion(), context);
    } catch (Exception e) {
      LOG.warn(String.format("Error computing context for [%s] due to [%s]", context.getVersion(), e));
    }
  }
}
