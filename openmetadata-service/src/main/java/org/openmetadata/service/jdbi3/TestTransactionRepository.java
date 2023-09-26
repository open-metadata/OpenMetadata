package org.openmetadata.service.jdbi3;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.util.Date;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.DailyCount;
import org.openmetadata.schema.type.UsageDetails;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;

@Slf4j
public class TestTransactionRepository {
  private static final String FAILED_TO_UPDATE_SETTINGS = "Failed to Update Settings";
  public static final String INTERNAL_SERVER_ERROR_WITH_REASON = "Internal Server Error. Reason :";
  private final CollectionDAO dao;

  public TestTransactionRepository(CollectionDAO dao) {
    this.dao = dao;
  }

  public Table createOrUpdateTableWithTransaction(Table table) throws IOException {
    dao.tableDAO().insert(table, FullyQualifiedName.buildHash(table.getFullyQualifiedName()));
    return getTable(table.getId());
  }

  public Table updateTableWithTransaction(Table table) throws JsonProcessingException {
    dao.tableDAO().update(table);
    return table;
  }

  public Table updateTableWithTransactionWithError(Table table, int count) throws JsonProcessingException {
    dao.tableDAO().update(table);
    return table;
  }

  public void updateUsageStatsWithTransaction(Table table, int count) {
    String today = RestUtil.DATE_FORMAT.format(new Date());
    DailyCount dailyCount = new DailyCount().withCount(count).withDate(today);
    dao.usageDAO().insertOrReplaceCount(dailyCount.getDate(), table.getId(), "Table", dailyCount.getCount());
  }

  public void updateUsageStatsWithTransactionWithError(Table table, int count) {
    throw new IllegalArgumentException("Rollback Transaction");
  }

  public Table createOrUpdateTableWithJdbiUnitOfWork(Table table) throws JsonProcessingException {
    dao.tableDAO().insert(table, FullyQualifiedName.buildHash(table.getFullyQualifiedName()));
    return table;
  }

  public Table getTable(UUID id) throws IOException {
    return dao.tableDAO().findEntityById(id);
  }

  public UsageDetails getUsage(UUID id) throws IOException {
    return dao.usageDAO().getLatestUsage(id.toString());
  }
}
