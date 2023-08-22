package org.openmetadata.service.migration.postgres.v112;

import java.util.List;
import java.util.Set;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TestSuiteRepository;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.util.EntityUtil;

@Slf4j
public class Migration extends MigrationProcessImpl {
  private CollectionDAO collectionDAO;
  private Handle handle;

  public Migration(MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  public void initialize(Handle handle) {
    super.initialize(handle);
    this.handle = handle;
    this.collectionDAO = handle.attach(CollectionDAO.class);
  }

  @Override
  @SneakyThrows
  public void runDataMigration() {
    // Run Data Migration to Remove the quoted Fqn`
    unquoteTestSuiteMigration(collectionDAO);
  }

  public static void unquoteTestSuiteMigration(CollectionDAO collectionDAO) {
    TestSuiteRepository testSuiteRepository = new TestSuiteRepository(collectionDAO);
    List<TestSuite> testSuites =
        testSuiteRepository.listAll(new EntityUtil.Fields(Set.of("id")), new ListFilter(Include.ALL));
    for (TestSuite suite : testSuites) {
      if (Boolean.TRUE.equals(suite.getExecutable())) {
        String fqn = suite.getFullyQualifiedName();
        String updatedFqn = fqn;
        if (fqn.startsWith("\"") && fqn.endsWith("\"")) {
          updatedFqn = fqn.substring(1, fqn.length() - 1);
        }
        // update the name and fqn
        suite.setName(updatedFqn);
        suite.setFullyQualifiedName(updatedFqn);
        collectionDAO.testSuiteDAO().update(suite);
      }
    }
  }
}
