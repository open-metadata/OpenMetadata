package org.openmetadata.service.migration;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class MigrationUtil {
  @SneakyThrows
  public static <T extends EntityInterface> void updateFQNHashForEntity(Class<T> clazz, EntityDAO<T> dao) {
    List<String> jsons = dao.listAfter(new ListFilter(Include.ALL), Integer.MAX_VALUE, "");
    for (String json : jsons) {
      T entity = JsonUtils.readValue(json, clazz);
      dao.update(
          entity.getId(), FullyQualifiedName.buildHash(entity.getFullyQualifiedName()), JsonUtils.pojoToJson(entity));
    }
  }

  public static MigrationDAO.ServerMigrationSQLTable buildServerMigrationTable(String version, String statement) {
    MigrationDAO.ServerMigrationSQLTable result = new MigrationDAO.ServerMigrationSQLTable();
    result.setVersion(String.valueOf(version));
    result.setSqlStatement(statement);
    result.setCheckSum(EntityUtil.hash(statement));
    return result;
  }

  public static List<MigrationDAO.ServerMigrationSQLTable> addInListIfToBeExecuted(
      String version, Set<String> lookUp, List<String> queries) {
    List<MigrationDAO.ServerMigrationSQLTable> result = new ArrayList<>();
    for (String query : queries) {
      MigrationDAO.ServerMigrationSQLTable tableContent = buildServerMigrationTable(version, query);
      if (!lookUp.contains(tableContent.getCheckSum())) {
        result.add(tableContent);
      } else {
        // TODO:LOG better
        LOG.debug("Query will be skipped in Migration Step , as this has already been executed");
      }
    }
    return result;
  }
}
