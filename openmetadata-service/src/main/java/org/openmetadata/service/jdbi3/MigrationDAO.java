package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.core.statement.StatementException;
import org.jdbi.v3.sqlobject.SingleValue;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;

public interface MigrationDAO {
  @ConnectionAwareSqlQuery(
      value = "SELECT MAX(version) FROM DATABASE_CHANGE_LOG",
      connectionType = MYSQL)
  @ConnectionAwareSqlQuery(
      value = "SELECT max(version) FROM \"DATABASE_CHANGE_LOG\"",
      connectionType = POSTGRES)
  @SingleValue
  Optional<String> getMaxVersion() throws StatementException;

  @ConnectionAwareSqlQuery(
      value = "SELECT MAX(version) FROM SERVER_CHANGE_LOG",
      connectionType = MYSQL)
  @ConnectionAwareSqlQuery(
      value = "SELECT max(version) FROM SERVER_CHANGE_LOG",
      connectionType = POSTGRES)
  @SingleValue
  Optional<String> getMaxServerMigrationVersion() throws StatementException;

  @ConnectionAwareSqlQuery(
      value = "SELECT checksum FROM SERVER_CHANGE_LOG where version = :version",
      connectionType = MYSQL)
  @ConnectionAwareSqlQuery(
      value = "SELECT checksum FROM SERVER_CHANGE_LOG where version = :version",
      connectionType = POSTGRES)
  String getVersionMigrationChecksum(@Bind("version") String version) throws StatementException;

  @ConnectionAwareSqlQuery(
      value =
          "SELECT sqlStatement FROM SERVER_MIGRATION_SQL_LOGS where version = :version and checksum = :checksum",
      connectionType = MYSQL)
  @ConnectionAwareSqlQuery(
      value =
          "SELECT sqlStatement FROM SERVER_MIGRATION_SQL_LOGS where version = :version and checksum = :checksum",
      connectionType = POSTGRES)
  String getSqlQuery(@Bind("version") String version, @Bind("checksum") String checksum)
      throws StatementException;

  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO SERVER_CHANGE_LOG (version, migrationFileName, checksum, metrics, installed_on)"
              + "VALUES (:version, :migrationFileName, :checksum, :metrics, CURRENT_TIMESTAMP) "
              + "ON DUPLICATE KEY UPDATE "
              + "migrationFileName = :migrationFileName, "
              + "checksum = :checksum, "
              + "metrics = :metrics,"
              + "installed_on = CURRENT_TIMESTAMP",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO server_change_log (version, migrationFileName, checksum, metrics, installed_on)"
              + "VALUES (:version, :migrationFileName, :checksum, :metrics, current_timestamp) "
              + "ON CONFLICT (version) DO UPDATE SET "
              + "migrationFileName = EXCLUDED.migrationFileName, "
              + "metrics = :metrics,"
              + "checksum = EXCLUDED.checksum, "
              + "installed_on = EXCLUDED.installed_on",
      connectionType = POSTGRES)
  void upsertServerMigration(
      @Bind("version") String version,
      @Bind("migrationFileName") String migrationFileName,
      @Bind("checksum") String checksum,
      @Bind("metrics") String metrics);

  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO SERVER_MIGRATION_SQL_LOGS (version, sqlStatement, checksum, executedAt)"
              + "VALUES (:version, :sqlStatement, :checksum, CURRENT_TIMESTAMP) "
              + "ON DUPLICATE KEY UPDATE "
              + "version = :version, "
              + "sqlStatement = :sqlStatement, "
              + "executedAt = CURRENT_TIMESTAMP",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO SERVER_MIGRATION_SQL_LOGS (version, sqlStatement, checksum, executedAt)"
              + "VALUES (:version, :sqlStatement, :checksum, current_timestamp) "
              + "ON CONFLICT (checksum) DO UPDATE SET "
              + "version = EXCLUDED.version, "
              + "sqlStatement = EXCLUDED.sqlStatement, "
              + "executedAt = EXCLUDED.executedAt",
      connectionType = POSTGRES)
  void upsertServerMigrationSQL(
      @Bind("version") String version,
      @Bind("sqlStatement") String sqlStatement,
      @Bind("checksum") String success);

  @ConnectionAwareSqlQuery(
      value = "SELECT checksum FROM SERVER_MIGRATION_SQL_LOGS where version = :version",
      connectionType = MYSQL)
  @ConnectionAwareSqlQuery(
      value = "SELECT checksum FROM SERVER_MIGRATION_SQL_LOGS where version = :version",
      connectionType = POSTGRES)
  List<String> getServerMigrationSQLWithVersion(@Bind("version") String version);

  @ConnectionAwareSqlQuery(
      value = "SELECT sqlStatement FROM SERVER_MIGRATION_SQL_LOGS where checksum = :checksum",
      connectionType = MYSQL)
  @ConnectionAwareSqlQuery(
      value = "SELECT sqlStatement FROM SERVER_MIGRATION_SQL_LOGS where checksum = :checksum",
      connectionType = POSTGRES)
  String checkIfQueryPreviouslyRan(@Bind("checksum") String checksum);

  @SqlQuery(
      "SELECT installed_rank, version, migrationFileName, checksum, installed_on, metrics FROM SERVER_CHANGE_LOG ORDER BY version ASC")
  @RegisterRowMapper(FromServerChangeLogMapper.class)
  List<ServerChangeLog> listMetricsFromDBMigrations();

  @Getter
  @Setter
  class ServerMigrationSQLTable {
    private String version;
    private String sqlStatement;
    private String checkSum;
  }

  @Getter
  @Setter
  @Builder
  class ServerChangeLog {
    private Integer installedRank;
    private String version;
    private String migrationFileName;
    private String checksum;
    private String installedOn;
    private String metrics;
  }

  class FromServerChangeLogMapper implements RowMapper<ServerChangeLog> {
    @Override
    public ServerChangeLog map(ResultSet rs, StatementContext ctx) throws SQLException {
      return ServerChangeLog.builder()
          .installedRank(rs.getInt("installed_rank"))
          .version(rs.getString("version"))
          .migrationFileName(rs.getString("migrationFileName"))
          .checksum(rs.getString("checksum"))
          .installedOn(rs.getString("installed_on"))
          .metrics(rs.getString("metrics"))
          .build();
    }
  }
}
