package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.util.List;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindList;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;

public interface IndexMappingVersionDAO {

  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO index_mapping_versions (entityType, mappingHash, mappingJson, version, updatedAt, updatedBy) "
              + "VALUES (:entityType, :mappingHash, :mappingJson, :version, :updatedAt, :updatedBy) "
              + "ON DUPLICATE KEY UPDATE mappingHash = :mappingHash, mappingJson = :mappingJson, "
              + "version = :version, updatedAt = :updatedAt, updatedBy = :updatedBy",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO index_mapping_versions (entityType, mappingHash, mappingJson, version, updatedAt, updatedBy) "
              + "VALUES (:entityType, :mappingHash, (:mappingJson :: jsonb), :version, :updatedAt, :updatedBy) "
              + "ON CONFLICT (entityType) DO UPDATE SET mappingHash = EXCLUDED.mappingHash, "
              + "mappingJson = EXCLUDED.mappingJson, version = EXCLUDED.version, "
              + "updatedAt = EXCLUDED.updatedAt, updatedBy = EXCLUDED.updatedBy",
      connectionType = POSTGRES)
  void upsertIndexMappingVersion(
      @Bind("entityType") String entityType,
      @Bind("mappingHash") String mappingHash,
      @Bind("mappingJson") String mappingJson,
      @Bind("version") String version,
      @Bind("updatedAt") long updatedAt,
      @Bind("updatedBy") String updatedBy);

  @SqlQuery("SELECT mappingHash FROM index_mapping_versions WHERE entityType = :entityType")
  String getMappingHash(@Bind("entityType") String entityType);

  @SqlQuery("SELECT entityType, mappingHash FROM index_mapping_versions")
  @RegisterRowMapper(IndexMappingVersionMapper.class)
  List<IndexMappingVersion> getAllMappingVersions();

  @SqlQuery(
      "SELECT entityType, mappingHash FROM index_mapping_versions WHERE entityType IN (<entityTypes>)")
  @RegisterRowMapper(IndexMappingVersionMapper.class)
  List<IndexMappingVersion> getMappingVersionsForEntities(
      @BindList("entityTypes") List<String> entityTypes);

  class IndexMappingVersion {
    public final String entityType;
    public final String mappingHash;

    public IndexMappingVersion(String entityType, String mappingHash) {
      this.entityType = entityType;
      this.mappingHash = mappingHash;
    }
  }
}
