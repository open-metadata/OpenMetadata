package org.openmetadata.catalog.jdbi3;

import java.util.Map;
import org.openmetadata.catalog.config.ConfigDAO;

public class AppConfigRepository {
  private final ConfigDAO appConfigDAO;

  public AppConfigRepository(ConfigDAO dao) {
    appConfigDAO = dao;
  }

  public Map<String, String> listAllConfigs() {
    return appConfigDAO.getCatalogConfiguration().getAllConfig();
  }

  public Map<String, String> getConfigWithKey(String key) {
    return appConfigDAO.getCatalogConfiguration().getConfigWithKey(key);
  }
}
