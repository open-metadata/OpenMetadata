package org.openmetadata.service.migration.utils.V114;

import static org.openmetadata.service.Entity.*;
import static org.openmetadata.service.migration.utils.v110.MigrationUtil.getTestSuite;
import static org.openmetadata.service.migration.utils.v110.MigrationUtil.groupTestCasesByTable;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.tests.CreateTestSuite;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TestSuiteRepository;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class MigrationUtil {
  private MigrationUtil() {
    /* Cannot create object  util class*/
  }

  /**
   * Step 1: re-run the fix for FQN to catch any issues from previous release where we were quoting the FQN Step 2:
   * Group all the testCases with the table. We will create a Map with Table FQN as the key and all the test cases
   * belonging to that Table Step 3: Iterate through the Map keySet, which is table names. For each table name we create
   * an executable test suite FQN Step 4: Fetch executable testSuite using step 3 FQN Step 5: Iterate through the test
   * case list associated with the current table FQN in the loop Step 6: for each test case fetch TestSuite
   * relationships Step 7: Iterate through the testSuite relation to check if the executableTestSuite FQN matches. If it
   * matches there exists a relation from testCase to an executable Test suite Step 8: If we can't find a match, create
   * a relationship.
   */
  public static void fixTestSuites(CollectionDAO collectionDAO) {
    // Fix any FQN issues for executable TestSuite
    TestSuiteRepository testSuiteRepository =
        (TestSuiteRepository) Entity.getEntityRepository(TEST_SUITE);
    List<TestSuite> testSuites =
        testSuiteRepository.listAll(
            new EntityUtil.Fields(Set.of("id")), new ListFilter(Include.ALL));
    for (TestSuite suite : testSuites) {
      if (suite.getExecutableEntityReference() != null
          && (!suite.getExecutable() || !suite.getFullyQualifiedName().contains("testSuite"))) {
        String tableFQN = suite.getExecutableEntityReference().getFullyQualifiedName();
        String suiteFQN = tableFQN + ".testSuite";
        suite.setName(suiteFQN);
        suite.setFullyQualifiedName(suiteFQN);
        suite.setExecutable(true);
        collectionDAO.testSuiteDAO().update(suite);
      }
    }
    // Let's iterate through the test cases and make sure there exists a relationship between
    // testcases and its native
    // TestSuite
    Map<String, ArrayList<TestCase>> testCasesGroupByTable = groupTestCasesByTable();
    for (Entry<String, ArrayList<TestCase>> entry : testCasesGroupByTable.entrySet()) {
      String tableFQN = entry.getKey();
      try {
        List<TestCase> testCases = entry.getValue();
        String executableTestSuiteFQN = tableFQN + ".testSuite";
        TestSuite executableTestSuite =
            getOrCreateExecutableTestSuite(
                collectionDAO, testCases, testSuiteRepository, executableTestSuiteFQN);
        for (TestCase testCase : testCases) {
          // we are setting mustHaveRelationship to "false" to not throw any error.
          List<CollectionDAO.EntityRelationshipRecord> existingRelations =
              testSuiteRepository.findFromRecords(
                  testCase.getId(), TEST_CASE, Relationship.CONTAINS, TEST_SUITE);
          boolean relationWithExecutableTestSuiteExists = false;
          if (existingRelations != null) {
            for (CollectionDAO.EntityRelationshipRecord existingTestSuiteRel : existingRelations) {
              try {
                TestSuite existingTestSuite =
                    testSuiteRepository.getDao().findEntityById(existingTestSuiteRel.getId());
                if (Boolean.TRUE.equals(existingTestSuite.getExecutable())
                    && existingTestSuite.getFullyQualifiedName().equals(executableTestSuiteFQN)) {
                  // There is a native test suite associated with this testCase.
                  relationWithExecutableTestSuiteExists = true;
                }
              } catch (EntityNotFoundException ex) {
                // if testsuite cannot be retrieved but the relation exists, then this is orphaned
                // relation, we will
                // delete the relation
                testSuiteRepository.deleteRelationship(
                    existingTestSuiteRel.getId(),
                    TEST_SUITE,
                    testCase.getId(),
                    TEST_CASE,
                    Relationship.CONTAINS);
              }
            }
          }
          // if we can't find any executable testSuite relationship add one
          if (!relationWithExecutableTestSuiteExists) {
            testSuiteRepository.addRelationship(
                executableTestSuite.getId(),
                testCase.getId(),
                TEST_SUITE,
                TEST_CASE,
                Relationship.CONTAINS);
          }
        }

        // check from table -> nativeTestSuite there should only one relation
        List<CollectionDAO.EntityRelationshipRecord> testSuiteRels =
            testSuiteRepository.findToRecords(
                executableTestSuite.getExecutableEntityReference().getId(),
                TABLE,
                Relationship.CONTAINS,
                TEST_SUITE);
        for (CollectionDAO.EntityRelationshipRecord testSuiteRel : testSuiteRels) {
          try {
            testSuiteRepository.getDao().findEntityById(testSuiteRel.getId());
          } catch (EntityNotFoundException ex) {
            // if testsuite cannot be retrieved but the relation exists, then this is orphaned
            // relation, we will
            // delete the relation
            testSuiteRepository.deleteRelationship(
                executableTestSuite.getExecutableEntityReference().getId(),
                TABLE,
                testSuiteRel.getId(),
                TEST_SUITE,
                Relationship.CONTAINS);
          }
        }
      } catch (Exception exc) {
        LOG.error(
            String.format(
                "Error trying to migrate tests from Table [%s] due to [%s]",
                tableFQN, exc.getMessage()));
      }
    }
  }

  private static TestSuite getOrCreateExecutableTestSuite(
      CollectionDAO collectionDAO,
      List<TestCase> testCases,
      TestSuiteRepository testSuiteRepository,
      String executableTestSuiteFQN) {
    try {
      // Try to return the Executable Test Suite that should exist
      return testSuiteRepository
          .getDao()
          .findEntityByName(executableTestSuiteFQN, "fqnHash", Include.ALL);
    } catch (EntityNotFoundException exc) {
      // If it does not exist, create it and return it
      MessageParser.EntityLink entityLink =
          MessageParser.EntityLink.parse(testCases.stream().findFirst().get().getEntityLink());
      TestSuite newExecutableTestSuite =
          getTestSuite(
                  collectionDAO,
                  new CreateTestSuite()
                      .withName(FullyQualifiedName.buildHash(executableTestSuiteFQN))
                      .withDisplayName(executableTestSuiteFQN)
                      .withExecutableEntityReference(entityLink.getEntityFQN()),
                  "ingestion-bot")
              .withExecutable(true)
              .withFullyQualifiedName(executableTestSuiteFQN);
      testSuiteRepository.prepareInternal(newExecutableTestSuite, false);
      testSuiteRepository
          .getDao()
          .insert(
              "fqnHash", newExecutableTestSuite, newExecutableTestSuite.getFullyQualifiedName());
      // add relationship between executable TestSuite with Table
      testSuiteRepository.addRelationship(
          newExecutableTestSuite.getExecutableEntityReference().getId(),
          newExecutableTestSuite.getId(),
          Entity.TABLE,
          TEST_SUITE,
          Relationship.CONTAINS);

      // add relationship between all the testCases that are created against a table with native
      // test suite.
      for (TestCase testCase : testCases) {
        testSuiteRepository.addRelationship(
            newExecutableTestSuite.getId(),
            testCase.getId(),
            TEST_SUITE,
            TEST_CASE,
            Relationship.CONTAINS);
      }
      return newExecutableTestSuite;
    }
  }
}
