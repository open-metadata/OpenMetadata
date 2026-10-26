/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Method;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;

/**
 * A contract only acts on the test suite named after its own id. The suite reference on a new
 * contract can come from the caller, so a contract created with someone else's suite must leave
 * that suite alone.
 */
class DataContractTestSuiteOwnershipTest {

  private DataContractRepository dataContractRepository;
  private Method createOrUpdateTestSuite;
  private Method getOrCreateTestSuite;
  private final TestSuiteRepository testSuiteRepository = mock(TestSuiteRepository.class);

  @BeforeEach
  void setUp() throws Exception {
    Entity.setCollectionDAO(mock(CollectionDAO.class, RETURNS_DEEP_STUBS));
    dataContractRepository = new DataContractRepository(new OpenMetadataApplicationConfig());
    createOrUpdateTestSuite =
        DataContractRepository.class.getDeclaredMethod(
            "createOrUpdateDataContractTestSuite", DataContract.class, boolean.class);
    createOrUpdateTestSuite.setAccessible(true);
    getOrCreateTestSuite =
        DataContractRepository.class.getDeclaredMethod("getOrCreateTestSuite", DataContract.class);
    getOrCreateTestSuite.setAccessible(true);
  }

  @AfterEach
  void tearDown() {
    Entity.cleanup();
  }

  @Test
  void newContractNamingAnotherContractsSuite_leavesThatSuiteAlone() throws Exception {
    TestSuite otherContractsSuite = suiteNamed(UUID.randomUUID().toString());
    DataContract contract = contractReferencing(otherContractsSuite);

    createOrUpdateTestSuite(contract, otherContractsSuite);

    verify(testSuiteRepository, never())
        .deleteLogicalTestSuite(anyString(), any(TestSuite.class), anyBoolean());
    assertNull(contract.getTestSuite());
  }

  @Test
  void noExpectationsLeft_stillDeletesTheContractsOwnSuite() throws Exception {
    UUID contractId = UUID.randomUUID();
    TestSuite ownSuite = suiteNamed(contractId.toString());
    DataContract contract = contractReferencing(ownSuite).withId(contractId);

    createOrUpdateTestSuite(contract, ownSuite);

    verify(testSuiteRepository).deleteLogicalTestSuite("editor", ownSuite, true);
    assertNull(contract.getTestSuite());
  }

  @Test
  void withExpectations_aContractNamingAnotherContractsSuite_getsANewSuiteOfItsOwn()
      throws Exception {
    TestSuite otherContractsSuite = suiteNamed(UUID.randomUUID().toString());
    DataContract contract = contractReferencing(otherContractsSuite);
    TestSuite newSuite = suiteNamed(contract.getId().toString());
    when(testSuiteRepository.create(isNull(), any(TestSuite.class))).thenReturn(newSuite);

    Object suite = withStoredSuite(otherContractsSuite, getOrCreateTestSuite, contract);

    assertSame(newSuite, suite);
  }

  private void createOrUpdateTestSuite(DataContract contract, TestSuite stored) throws Exception {
    withStoredSuite(stored, createOrUpdateTestSuite, contract, false);
  }

  /** Runs a repository method with {@code stored} as the suite any reference resolves to. */
  private Object withStoredSuite(TestSuite stored, Method method, Object... args) throws Exception {
    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities
          .when(
              () ->
                  Entity.getEntityOrNull(
                      any(EntityReference.class), anyString(), any(Include.class)))
          .thenReturn(stored);
      entities
          .when(() -> Entity.getEntityRepository(Entity.TEST_SUITE))
          .thenReturn(testSuiteRepository);
      return method.invoke(dataContractRepository, args);
    }
  }

  private static DataContract contractReferencing(TestSuite testSuite) {
    return new DataContract()
        .withId(UUID.randomUUID())
        .withName("orders")
        .withUpdatedBy("editor")
        .withTestSuite(reference(testSuite));
  }

  private static TestSuite suiteNamed(String name) {
    return new TestSuite().withId(UUID.randomUUID()).withName(name).withFullyQualifiedName(name);
  }

  private static EntityReference reference(TestSuite testSuite) {
    return new EntityReference()
        .withId(testSuite.getId())
        .withFullyQualifiedName(testSuite.getFullyQualifiedName())
        .withType(Entity.TEST_SUITE);
  }
}
