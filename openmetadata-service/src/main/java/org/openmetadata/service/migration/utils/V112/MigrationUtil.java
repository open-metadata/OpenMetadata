package org.openmetadata.service.migration.utils.V112;

import java.util.List;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.EntityInterfaceUtil;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TestSuiteRepository;
import org.openmetadata.service.util.EntityUtil;

@Slf4j
public class MigrationUtil {
  private MigrationUtil() {}

  public static void fixExecutableTestSuiteFQN(CollectionDAO collectionDAO) {
    TestSuiteRepository testSuiteRepository =
        (TestSuiteRepository) Entity.getEntityRepository(Entity.TEST_SUITE);
    List<TestSuite> testSuites =
        testSuiteRepository.listAll(
            new EntityUtil.Fields(Set.of("id")), new ListFilter(Include.ALL));
    for (TestSuite suite : testSuites) {
      if (Boolean.TRUE.equals(suite.getExecutable())
          && suite.getExecutableEntityReference() != null) {
        String tableFQN = suite.getExecutableEntityReference().getFullyQualifiedName();
        String suiteFQN = tableFQN + ".testSuite";
        suite.setName(suiteFQN);
        suite.setFullyQualifiedName(suiteFQN);
        collectionDAO.testSuiteDAO().update(suite);
      }
    }
  }

  public static void lowerCaseUserNameAndEmail(CollectionDAO daoCollection) {
    LOG.debug("Starting Migration UserName and Email to Lowercase");
    int total = daoCollection.userDAO().listTotalCount();
    int offset = 0;
    int limit = 200;
    while (offset < total) {
      List<String> userEntities = daoCollection.userDAO().listAfterWithOffset(limit, offset);
      for (String json : userEntities) {
        User userEntity = JsonUtils.readValue(json, User.class);
        userEntity.setFullyQualifiedName(
            EntityInterfaceUtil.quoteName(userEntity.getFullyQualifiedName().toLowerCase()));
        daoCollection.userDAO().update(userEntity);
      }
      offset = offset + limit;
    }
    LOG.debug("Completed Migrating UserName and Email to Lowercase");
  }
}
