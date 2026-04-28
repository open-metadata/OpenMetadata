package org.openmetadata.service.migration.utils.v200;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;

class MigrationUtilTest {
  private CollectionDAO collectionDAO;
  private CollectionDAO.DataContractDAO dataContractDAO;
  private CollectionDAO.TestCaseDAO testCaseDAO;

  @BeforeEach
  void setUp() {
    collectionDAO = mock(CollectionDAO.class);
    dataContractDAO = mock(CollectionDAO.DataContractDAO.class);
    testCaseDAO = mock(CollectionDAO.TestCaseDAO.class);
    when(collectionDAO.dataContractDAO()).thenReturn(dataContractDAO);
    when(collectionDAO.testCaseDAO()).thenReturn(testCaseDAO);
  }

  @Test
  void testMigrateTestCaseDataContractReferences_noDataContracts() {
    when(dataContractDAO.listAfterWithOffset(anyInt(), anyInt()))
        .thenReturn(Collections.emptyList());

    MigrationUtil.migrateTestCaseDataContractReferences(collectionDAO);

    verify(testCaseDAO, never()).findEntityById(any());
    verify(testCaseDAO, never()).update(any(TestCase.class));
  }

  @Test
  void testMigrateTestCaseDataContractReferences_contractWithNoQualityExpectations() {
    DataContract contract = new DataContract();
    contract.setId(UUID.randomUUID());
    contract.setFullyQualifiedName("test.contract");

    when(dataContractDAO.listAfterWithOffset(anyInt(), eq(0)))
        .thenReturn(List.of(JsonUtils.pojoToJson(contract)));
    when(dataContractDAO.listAfterWithOffset(anyInt(), eq(1000)))
        .thenReturn(Collections.emptyList());

    MigrationUtil.migrateTestCaseDataContractReferences(collectionDAO);

    verify(testCaseDAO, never()).findEntityById(any());
  }

  @Test
  void testMigrateTestCaseDataContractReferences_updatesTestCase() {
    UUID contractId = UUID.randomUUID();
    UUID testCaseId = UUID.randomUUID();

    DataContract contract = new DataContract();
    contract.setId(contractId);
    contract.setName("my-contract");
    contract.setFullyQualifiedName("test.contract");
    contract.setQualityExpectations(
        List.of(new EntityReference().withId(testCaseId).withType(Entity.TEST_CASE)));

    TestCase testCase = new TestCase();
    testCase.setId(testCaseId);
    testCase.setFullyQualifiedName("test.case.fqn");

    when(dataContractDAO.listAfterWithOffset(anyInt(), eq(0)))
        .thenReturn(List.of(JsonUtils.pojoToJson(contract)));
    when(dataContractDAO.listAfterWithOffset(anyInt(), eq(1000)))
        .thenReturn(Collections.emptyList());
    when(testCaseDAO.findEntityById(testCaseId)).thenReturn(testCase);

    MigrationUtil.migrateTestCaseDataContractReferences(collectionDAO);

    verify(testCaseDAO).update(any(TestCase.class));
    assertEquals(contractId, testCase.getDataContract().getId());
    assertEquals(Entity.DATA_CONTRACT, testCase.getDataContract().getType());
  }

  @Test
  void testMigrateTestCaseDataContractReferences_skipsAlreadySet() {
    UUID contractId = UUID.randomUUID();
    UUID testCaseId = UUID.randomUUID();

    DataContract contract = new DataContract();
    contract.setId(contractId);
    contract.setName("my-contract");
    contract.setFullyQualifiedName("test.contract");
    contract.setQualityExpectations(
        List.of(new EntityReference().withId(testCaseId).withType(Entity.TEST_CASE)));

    TestCase testCase = new TestCase();
    testCase.setId(testCaseId);
    testCase.setFullyQualifiedName("test.case.fqn");
    testCase.setDataContract(
        new EntityReference().withId(contractId).withType(Entity.DATA_CONTRACT));

    when(dataContractDAO.listAfterWithOffset(anyInt(), eq(0)))
        .thenReturn(List.of(JsonUtils.pojoToJson(contract)));
    when(dataContractDAO.listAfterWithOffset(anyInt(), eq(1000)))
        .thenReturn(Collections.emptyList());
    when(testCaseDAO.findEntityById(testCaseId)).thenReturn(testCase);

    MigrationUtil.migrateTestCaseDataContractReferences(collectionDAO);

    verify(testCaseDAO, never()).update(any(TestCase.class));
  }

  @Test
  void testMigrateTestCaseDataContractReferences_handlesTestCaseNotFound() {
    UUID testCaseId = UUID.randomUUID();

    DataContract contract = new DataContract();
    contract.setId(UUID.randomUUID());
    contract.setName("my-contract");
    contract.setFullyQualifiedName("test.contract");
    contract.setQualityExpectations(
        List.of(new EntityReference().withId(testCaseId).withType(Entity.TEST_CASE)));

    when(dataContractDAO.listAfterWithOffset(anyInt(), eq(0)))
        .thenReturn(List.of(JsonUtils.pojoToJson(contract)));
    when(dataContractDAO.listAfterWithOffset(anyInt(), eq(1000)))
        .thenReturn(Collections.emptyList());
    when(testCaseDAO.findEntityById(testCaseId))
        .thenThrow(new EntityNotFoundException("not found"));

    MigrationUtil.migrateTestCaseDataContractReferences(collectionDAO);

    verify(testCaseDAO, never()).update(any(TestCase.class));
  }

  @Test
  void testMigrateTestCaseDataContractReferences_batchProcessing() {
    UUID contractId1 = UUID.randomUUID();
    UUID contractId2 = UUID.randomUUID();
    UUID testCaseId1 = UUID.randomUUID();
    UUID testCaseId2 = UUID.randomUUID();

    DataContract contract1 = new DataContract();
    contract1.setId(contractId1);
    contract1.setName("contract1");
    contract1.setFullyQualifiedName("test.contract1");
    contract1.setQualityExpectations(
        List.of(new EntityReference().withId(testCaseId1).withType(Entity.TEST_CASE)));

    DataContract contract2 = new DataContract();
    contract2.setId(contractId2);
    contract2.setName("contract2");
    contract2.setFullyQualifiedName("test.contract2");
    contract2.setQualityExpectations(
        List.of(new EntityReference().withId(testCaseId2).withType(Entity.TEST_CASE)));

    when(dataContractDAO.listAfterWithOffset(anyInt(), eq(0)))
        .thenReturn(List.of(JsonUtils.pojoToJson(contract1), JsonUtils.pojoToJson(contract2)));
    when(dataContractDAO.listAfterWithOffset(anyInt(), eq(1000)))
        .thenReturn(Collections.emptyList());

    TestCase testCase1 = new TestCase();
    testCase1.setId(testCaseId1);
    testCase1.setFullyQualifiedName("test.case1");

    TestCase testCase2 = new TestCase();
    testCase2.setId(testCaseId2);
    testCase2.setFullyQualifiedName("test.case2");

    when(testCaseDAO.findEntityById(testCaseId1)).thenReturn(testCase1);
    when(testCaseDAO.findEntityById(testCaseId2)).thenReturn(testCase2);

    MigrationUtil.migrateTestCaseDataContractReferences(collectionDAO);

    verify(testCaseDAO, times(2)).update(any(TestCase.class));
  }

  @Test
  void testMigrateTestCaseDataContractReferences_criticalFailure() {
    when(dataContractDAO.listAfterWithOffset(anyInt(), anyInt()))
        .thenThrow(new RuntimeException("DB connection failed"));

    assertThrows(
        RuntimeException.class,
        () -> MigrationUtil.migrateTestCaseDataContractReferences(collectionDAO));
  }

  @Test
  void testMigrateTestCaseDataContractReferences_multipleTestCasesPerContract() {
    UUID contractId = UUID.randomUUID();
    UUID testCaseId1 = UUID.randomUUID();
    UUID testCaseId2 = UUID.randomUUID();
    UUID testCaseId3 = UUID.randomUUID();

    DataContract contract = new DataContract();
    contract.setId(contractId);
    contract.setName("contract");
    contract.setFullyQualifiedName("test.contract");
    contract.setQualityExpectations(
        List.of(
            new EntityReference().withId(testCaseId1).withType(Entity.TEST_CASE),
            new EntityReference().withId(testCaseId2).withType(Entity.TEST_CASE),
            new EntityReference().withId(testCaseId3).withType(Entity.TEST_CASE)));

    when(dataContractDAO.listAfterWithOffset(anyInt(), eq(0)))
        .thenReturn(List.of(JsonUtils.pojoToJson(contract)));
    when(dataContractDAO.listAfterWithOffset(anyInt(), eq(1000)))
        .thenReturn(Collections.emptyList());

    TestCase tc1 = new TestCase();
    tc1.setId(testCaseId1);
    tc1.setFullyQualifiedName("tc1");

    TestCase tc2 = new TestCase();
    tc2.setId(testCaseId2);
    tc2.setFullyQualifiedName("tc2");
    tc2.setDataContract(new EntityReference().withId(contractId));

    when(testCaseDAO.findEntityById(testCaseId1)).thenReturn(tc1);
    when(testCaseDAO.findEntityById(testCaseId2)).thenReturn(tc2);
    when(testCaseDAO.findEntityById(testCaseId3))
        .thenThrow(new EntityNotFoundException("not found"));

    MigrationUtil.migrateTestCaseDataContractReferences(collectionDAO);

    verify(testCaseDAO, times(1)).update(any(TestCase.class));
  }
}
