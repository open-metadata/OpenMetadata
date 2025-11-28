package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.PIPELINE;
import static org.openmetadata.service.Entity.PIPELINE_EXECUTION;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.config.RegisterBeanMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.search.indexes.PipelineExecutionIndex;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.RestUtil;

@Slf4j
public class PipelineExecutionRepository
    extends EntityTimeSeriesRepository<PipelineExecutionIndex.PipelineExecutionData> {
  public static final String COLLECTION_PATH = "/v1/pipelines/executions";
  public static final String PIPELINE_EXECUTION_EXTENSION = "pipeline.pipelineStatus";

  private PipelineExecutionDAO pipelineExecutionDAO;

  public PipelineExecutionRepository() {
    super(
        COLLECTION_PATH,
        new FilteredEntityTimeSeriesDAOWrapper(
            Entity.getCollectionDAO().entityExtensionTimeSeriesDao()),
        PipelineExecutionIndex.PipelineExecutionData.class,
        PIPELINE_EXECUTION);
  }

  private PipelineExecutionDAO getDAO() {
    if (pipelineExecutionDAO == null) {
      pipelineExecutionDAO = Entity.getJdbi().onDemand(PipelineExecutionDAO.class);
    }
    return pipelineExecutionDAO;
  }

  @Override
  public ResultList<PipelineExecutionIndex.PipelineExecutionData> listWithOffset(
      String currentCursor, ListFilter filter, int limit, boolean forward) {
    int offset = currentCursor == null ? 0 : Integer.parseInt(RestUtil.decodeCursor(currentCursor));

    filter.addQueryParam("extension", PIPELINE_EXECUTION_EXTENSION);

    List<PipelineExecutionRow> rows =
        getDAO().listPipelineExecutionsWithOffset(PIPELINE_EXECUTION_EXTENSION, limit, offset);

    List<PipelineExecutionIndex.PipelineExecutionData> pipelineExecutions = new ArrayList<>();
    for (PipelineExecutionRow row : rows) {
      try {
        PipelineStatus pipelineStatus = JsonUtils.readValue(row.json, PipelineStatus.class);

        Pipeline pipeline =
            Entity.getEntityByName(PIPELINE, row.entityFQN, "*", Include.NON_DELETED);
        pipelineExecutions.add(
            new PipelineExecutionIndex.PipelineExecutionData(pipeline, pipelineStatus));
      } catch (Exception e) {
        LOG.warn(
            "[PipelineExecutionRepository] Failed to process pipeline execution for {}: {}",
            row.entityFQN,
            e.getMessage(),
            e);
      }
    }

    int total = getDAO().countPipelineExecutions(PIPELINE_EXECUTION_EXTENSION);

    int nextOffset = offset + limit;
    String after = nextOffset < total ? String.valueOf(nextOffset) : null;

    return new ResultList<>(pipelineExecutions, new ArrayList<>(), null, after, total);
  }

  @Override
  public ResultList<PipelineExecutionIndex.PipelineExecutionData> listWithOffset(
      String currentCursor,
      ListFilter filter,
      int limit,
      Long startTs,
      Long endTs,
      boolean skipErrors,
      boolean forward) {
    int offset = currentCursor == null ? 0 : Integer.parseInt(RestUtil.decodeCursor(currentCursor));

    filter.addQueryParam("extension", PIPELINE_EXECUTION_EXTENSION);

    List<PipelineExecutionRow> rows =
        getDAO()
            .listPipelineExecutionsWithOffsetAndTime(
                PIPELINE_EXECUTION_EXTENSION, limit, offset, startTs, endTs);

    List<PipelineExecutionIndex.PipelineExecutionData> pipelineExecutions = new ArrayList<>();
    for (PipelineExecutionRow row : rows) {
      try {
        PipelineStatus pipelineStatus = JsonUtils.readValue(row.json, PipelineStatus.class);
        Pipeline pipeline =
            Entity.getEntityByName(PIPELINE, row.entityFQN, "*", Include.NON_DELETED);
        pipelineExecutions.add(
            new PipelineExecutionIndex.PipelineExecutionData(pipeline, pipelineStatus));
      } catch (Exception e) {
        if (!skipErrors) {
          LOG.error(
              "Failed to process pipeline execution for {}: {}", row.entityFQN, e.getMessage());
        }
      }
    }

    int total = getDAO().countPipelineExecutions(PIPELINE_EXECUTION_EXTENSION);
    int nextOffset = offset + limit;
    String after = nextOffset < total ? String.valueOf(nextOffset) : null;

    return new ResultList<>(pipelineExecutions, new ArrayList<>(), null, after, total);
  }

  @Override
  protected void setFields(
      PipelineExecutionIndex.PipelineExecutionData entity, EntityUtil.Fields fields) {
    // No additional fields to set
  }

  @Setter
  @Getter
  public static class PipelineExecutionRow {
    public String entityFQN;
    public String json;
  }

  @RegisterBeanMapper(PipelineExecutionRow.class)
  public interface PipelineExecutionDAO {
    @SqlQuery(
        "SELECT COUNT(*) "
            + "FROM entity_extension_time_series ets "
            + "INNER JOIN pipeline_entity p ON p.fqnhash = ets.entityfqnhash "
            + "WHERE ets.extension = :extension")
    int countPipelineExecutions(@Bind("extension") String extension);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT JSON_UNQUOTE(JSON_EXTRACT(p.json, '$.fullyQualifiedName')) as entityFQN, ets.json "
                + "FROM entity_extension_time_series ets "
                + "INNER JOIN pipeline_entity p ON p.fqnhash = ets.entityfqnhash "
                + "WHERE ets.extension = :extension "
                + "ORDER BY ets.timestamp DESC "
                + "LIMIT :limit OFFSET :offset",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT p.json->>'fullyQualifiedName' as entityFQN, ets.json "
                + "FROM entity_extension_time_series ets "
                + "INNER JOIN pipeline_entity p ON p.fqnhash = ets.entityfqnhash "
                + "WHERE ets.extension = :extension "
                + "ORDER BY ets.timestamp DESC "
                + "LIMIT :limit OFFSET :offset",
        connectionType = POSTGRES)
    List<PipelineExecutionRow> listPipelineExecutionsWithOffset(
        @Bind("extension") String extension, @Bind("limit") int limit, @Bind("offset") int offset);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT JSON_UNQUOTE(JSON_EXTRACT(p.json, '$.fullyQualifiedName')) as entityFQN, ets.json "
                + "FROM entity_extension_time_series ets "
                + "INNER JOIN pipeline_entity p ON p.fqnhash = ets.entityfqnhash "
                + "WHERE ets.extension = :extension "
                + "AND ets.timestamp >= :startTs AND ets.timestamp <= :endTs "
                + "ORDER BY ets.timestamp DESC "
                + "LIMIT :limit OFFSET :offset",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT p.json->>'fullyQualifiedName' as entityFQN, ets.json "
                + "FROM entity_extension_time_series ets "
                + "INNER JOIN pipeline_entity p ON p.fqnhash = ets.entityfqnhash "
                + "WHERE ets.extension = :extension "
                + "AND ets.timestamp >= :startTs AND ets.timestamp <= :endTs "
                + "ORDER BY ets.timestamp DESC "
                + "LIMIT :limit OFFSET :offset",
        connectionType = POSTGRES)
    List<PipelineExecutionRow> listPipelineExecutionsWithOffsetAndTime(
        @Bind("extension") String extension,
        @Bind("limit") int limit,
        @Bind("offset") int offset,
        @Bind("startTs") Long startTs,
        @Bind("endTs") Long endTs);
  }

  static class FilteredEntityTimeSeriesDAOWrapper implements EntityTimeSeriesDAO {
    private final EntityTimeSeriesDAO delegate;

    FilteredEntityTimeSeriesDAOWrapper(EntityTimeSeriesDAO delegate) {
      this.delegate = delegate;
    }

    @Override
    public String getTimeSeriesTableName() {
      return delegate.getTimeSeriesTableName();
    }

    @Override
    public int listCount(ListFilter filter) {
      filter.addQueryParam("extension", PIPELINE_EXECUTION_EXTENSION);
      return Entity.getJdbi()
          .onDemand(PipelineExecutionDAO.class)
          .countPipelineExecutions(PIPELINE_EXECUTION_EXTENSION);
    }

    @Override
    public int listCount(ListFilter filter, Long startTs, Long endTs, boolean latest) {
      filter.addQueryParam("extension", PIPELINE_EXECUTION_EXTENSION);
      return delegate.listCount(filter, startTs, endTs, latest);
    }

    @Override
    public void insert(
        String fqn, String extension, String jsonSchema, String json, String recordString) {
      throw new RuntimeException("NOT IMPLEMENTED");
    }

    @Override
    public void insertWithoutExtension(
        String fqnHash, String jsonSchema, String json, String recordString) {
      throw new RuntimeException("NOT IMPLEMENTED");
    }

    @Override
    public void deleteAtTimestamp(String fqn, String extension, Long timestamp) {
      throw new RuntimeException("NOT IMPLEMENTED");
    }

    @Override
    public void update(
        String table, String entityFQNHash, String extension, String json, Long timestamp) {
      throw new RuntimeException("NOT IMPLEMENTED");
    }

    @Override
    public void update(String table, String json, String id) {
      throw new RuntimeException("NOT IMPLEMENTED");
    }

    @Override
    public List<String> listWithOffset(
        String table, Map<String, ?> params, String cond, int limit, int offset) {
      return delegate.listWithOffset(table, params, cond, limit, offset);
    }

    @Override
    public List<String> listWithOffset(
        String table,
        Map<String, ?> params,
        String cond,
        int limit,
        int offset,
        Long startTs,
        Long endTs) {
      return delegate.listWithOffset(table, params, cond, limit, offset, startTs, endTs);
    }

    @Override
    public List<String> listWithOffset(
        String table,
        String cond,
        String partition,
        int limit,
        int offset,
        Long startTs,
        Long endTs) {
      return delegate.listWithOffset(table, cond, partition, limit, offset, startTs, endTs);
    }

    @Override
    public void updateExtensionByOperation(
        String table,
        String entityFQNHash,
        String extension,
        String json,
        Long timestamp,
        String operation) {
      throw new RuntimeException("NOT IMPLEMENTED");
    }

    @Override
    public String getExtension(String table, String entityId, String extension) {
      throw new RuntimeException("NOT IMPLEMENTED");
    }

    @Override
    public int listCount(String table, Map<String, ?> params, String cond) {
      return delegate.listCount(table, params, cond);
    }

    @Override
    public int listCount(
        String table, Map<String, ?> params, String cond, Long startTs, Long endTs) {
      return delegate.listCount(table, params, cond, startTs, endTs);
    }

    @Override
    public int listCount(
        String table,
        String partition,
        Map<String, ?> params,
        String cond,
        Long startTs,
        Long endTs) {
      return delegate.listCount(table, partition, params, cond, startTs, endTs);
    }

    @Override
    public String getById(String table, String id) {
      return delegate.getById(table, id);
    }

    @Override
    public void deleteById(String table, String id) {
      delegate.deleteById(table, id);
    }

    @Override
    public int listDistinctCount(String table) {
      throw new RuntimeException("NOT IMPLEMENTED");
    }

    @Override
    public List<CollectionDAO.ReportDataRow> getAfterExtension(
        String table, String entityFQNHash, int limit, String after) {
      return delegate.getAfterExtension(table, entityFQNHash, limit, after);
    }

    @Override
    public String getExtensionAtTimestamp(
        String table, String entityFQNHash, String extension, long timestamp) {
      return delegate.getExtensionAtTimestamp(table, entityFQNHash, extension, timestamp);
    }

    @Override
    public String getExtensionAtTimestampWithOperation(
        String table, String entityFQNHash, String extension, long timestamp, String operation) {
      return delegate.getExtensionAtTimestampWithOperation(
          table, entityFQNHash, extension, timestamp, operation);
    }

    @Override
    public String getLatestExtension(String table, String entityFQNHash, String extension) {
      return delegate.getLatestExtension(table, entityFQNHash, extension);
    }

    @Override
    public String getLatestRecord(String table, String entityFQNHash) {
      return delegate.getLatestRecord(table, entityFQNHash);
    }

    @Override
    public void delete(String table, String entityFQNHash, String extension) {
      delegate.delete(table, entityFQNHash, extension);
    }

    @Override
    public void deleteAtTimestamp(
        String table, String entityFQNHash, String extension, Long timestamp) {
      delegate.deleteAtTimestamp(table, entityFQNHash, extension, timestamp);
    }

    @Override
    public void deleteBeforeTimestamp(
        String table, String entityFQNHash, String extension, Long timestamp) {
      delegate.deleteBeforeTimestamp(table, entityFQNHash, extension, timestamp);
    }

    @Override
    public void deleteExtensionByKeyInternal(
        String table,
        String value,
        String entityFQNHash,
        String extension,
        String mysqlCond,
        String psqlCond) {
      delegate.deleteExtensionByKeyInternal(
          table, value, entityFQNHash, extension, mysqlCond, psqlCond);
    }

    @Override
    public List<String> listBetweenTimestamps(
        String table, String entityFQNHash, String extension, Long startTs, long endTs) {
      return delegate.listBetweenTimestamps(table, entityFQNHash, extension, startTs, endTs);
    }

    @Override
    public List<String> listBetweenTimestampsByOrder(
        String table,
        String entityFQNHash,
        String extension,
        Long startTs,
        long endTs,
        OrderBy orderBy) {
      return delegate.listBetweenTimestampsByOrder(
          table, entityFQNHash, extension, startTs, endTs, orderBy);
    }

    @Override
    public void updateExtensionByKeyInternal(
        String table,
        String value,
        String entityFQNHash,
        String extension,
        String json,
        String mysqlCond,
        String psqlCond) {
      delegate.updateExtensionByKeyInternal(
          table, value, entityFQNHash, extension, json, mysqlCond, psqlCond);
    }

    @Override
    public String getExtensionByKeyInternal(
        String table,
        String value,
        String entityFQNHash,
        String extension,
        String mysqlCond,
        String psqlCond) {
      return delegate.getExtensionByKeyInternal(
          table, value, entityFQNHash, extension, mysqlCond, psqlCond);
    }

    @Override
    public String getLatestExtensionByKeyInternal(
        String table,
        String value,
        String entityFQNHash,
        String extension,
        String mysqlCond,
        String psqlCond) {
      return delegate.getLatestExtensionByKeyInternal(
          table, value, entityFQNHash, extension, mysqlCond, psqlCond);
    }

    @Override
    public int deleteRecordsBeforeCutOff(String table, long cutoffTs, int limit) {
      return delegate.deleteRecordsBeforeCutOff(table, cutoffTs, limit);
    }

    @Override
    public List<String> migrationListDistinctWithOffset(String table, int limit) {
      throw new RuntimeException("NOT IMPLEMENTED");
    }
  }
}
