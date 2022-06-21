package org.openmetadata.catalog.config;

import java.util.Map;
import org.jdbi.v3.core.statement.StatementException;
import org.jdbi.v3.sqlobject.CreateSqlObject;
import org.jdbi.v3.sqlobject.config.KeyColumn;
import org.jdbi.v3.sqlobject.config.ValueColumn;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.statement.SqlQuery;

public interface ConfigDAO {
  @CreateSqlObject
  CatalogConfigDAO getCatalogConfiguration();

  interface CatalogConfigDAO {
    @SqlQuery("SELECT config_type, json FROM openmetadata_config_resource")
    @KeyColumn("config_type")
    @ValueColumn("json")
    Map<String, String> getAllConfig() throws StatementException;

    @SqlQuery("SELECT config_type, json FROM openmetadata_config_resource WHERE config_type = :config_type")
    @KeyColumn("config_type")
    @ValueColumn("json")
    Map<String, String> getConfigWithKey(@Bind("config_type") String config_type) throws StatementException;
  }
}
