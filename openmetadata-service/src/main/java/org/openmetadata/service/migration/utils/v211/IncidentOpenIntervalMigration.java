package org.openmetadata.service.migration.utils.v211;

import java.util.List;
import org.jdbi.v3.core.Handle;
import org.openmetadata.service.jdbi3.IncidentOpenIntervalDAO;

/** Reconstructs open periods once, using indexed state-id batches rather than a global history sort. */
public final class IncidentOpenIntervalMigration {
  private static final int BATCH_SIZE = 1000;

  private IncidentOpenIntervalMigration() {}

  public static void backfill(Handle handle) {
    final IncidentOpenIntervalDAO dao = handle.attach(IncidentOpenIntervalDAO.class);
    String after = "";
    List<String> stateIds;
    while (!(stateIds = dao.listIncidentIds(after, BATCH_SIZE)).isEmpty()) {
      dao.rebuildOpenIntervals(stateIds);
      after = stateIds.getLast();
    }
  }
}
