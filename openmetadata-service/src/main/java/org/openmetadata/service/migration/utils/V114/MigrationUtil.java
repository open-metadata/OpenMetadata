package org.openmetadata.service.migration.utils.V114;

import static org.openmetadata.service.Entity.TEST_CASE;
import static org.openmetadata.service.Entity.TEST_SUITE;
import static org.openmetadata.service.migration.utils.v110.MigrationUtil.groupTestCasesByTable;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TestSuiteRepository;
import org.openmetadata.service.util.EntityUtil;

public class MigrationUtil {
  private MigrationUtil() {
    /* Cannot create object  util class*/
  }

  public static void fixTestSuites(CollectionDAO collectionDAO) {
    // Fix any FQN issues for executable TestSuite
    TestSuiteRepository testSuiteRepository = new TestSuiteRepository(collectionDAO);
    List<TestSuite> testSuites =
        testSuiteRepository.listAll(new EntityUtil.Fields(Set.of("id")), new ListFilter(Include.ALL));
    for (TestSuite suite : testSuites) {
      if (suite.getExecutableEntityReference() != null) {
        String tableFQN = suite.getExecutableEntityReference().getFullyQualifiedName();
        String suiteFQN = tableFQN + ".testSuite";
        suite.setName(suiteFQN);
        suite.setFullyQualifiedName(suiteFQN);
        suite.setExecutable(true);
        collectionDAO.testSuiteDAO().update(suite);
      }
    }
    // Let's iterate through the test cases and make sure there exists a relationship between testcases and its native
    // TestSuite
    Map<String, ArrayList<TestCase>> testCasesGroupByTable = groupTestCasesByTable(collectionDAO);
    for (String tableFQN : testCasesGroupByTable.keySet()) {
      List<TestCase> testCases = testCasesGroupByTable.get(tableFQN);
      String executableTestSuiteFQN = tableFQN + ".testSuite";
      TestSuite executableTestSuite =
          testSuiteRepository.getDao().findEntityByName(executableTestSuiteFQN, "fqnHash", Include.ALL);
      for (TestCase testCase : testCases) {
        // we are setting mustHaveRelationship to "false" to not throw any error.
        List<CollectionDAO.EntityRelationshipRecord> existingRelations =
            testSuiteRepository.findFromRecords(testCase.getId(), TEST_CASE, Relationship.CONTAINS, TEST_SUITE);
        boolean relationWithExecutableTestSuiteExists = false;
        if (existingRelations != null) {
          for (CollectionDAO.EntityRelationshipRecord existingTestSuiteRel : existingRelations) {
            try {
              TestSuite existingTestSuite = testSuiteRepository.getDao().findEntityById(existingTestSuiteRel.getId());
              if (existingTestSuite.getExecutable()
                  && existingTestSuite.getFullyQualifiedName().equals(executableTestSuiteFQN)) {
                // remove the existing relation
                relationWithExecutableTestSuiteExists = true;
              }
            } catch (EntityNotFoundException ex) {
              // if testsuite cannot be retrieved but the relation exists, then this is orphaned realtion, we will
              // delete the realtion
              testSuiteRepository.deleteRelationship(
                  existingTestSuiteRel.getId(), TEST_SUITE, testCase.getId(), TEST_CASE, Relationship.CONTAINS);
            }
          }
        }
        // if we can't find any executable testSuite relationship add one
        if (!relationWithExecutableTestSuiteExists) {
          testSuiteRepository.addRelationship(
              executableTestSuite.getId(), testCase.getId(), TEST_SUITE, TEST_CASE, Relationship.CONTAINS);
        }
      }
    }
  }
}
