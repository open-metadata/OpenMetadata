/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.services.databases;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.net.URI;
import java.security.Principal;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.resources.databases.TableMapper;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.util.EntityUtil.Fields;

/**
 * Unit tests for TableService.
 *
 * <p>These tests demonstrate the service layer testing pattern:
 *
 * <ul>
 *   <li>NO Docker containers - runs in milliseconds
 *   <li>NO database - all repository calls are mocked
 *   <li>NO search index - search repository is mocked
 *   <li>Tests business logic in isolation
 *   <li>Verifies authorization is called
 *   <li>Verifies correct delegation to repository
 * </ul>
 *
 * <p>This is the template for all service tests going forward.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TableServiceTest {

  @Mock private TableRepository tableRepository;

  @Mock private SearchRepository searchRepository;

  @Mock private Authorizer authorizer;

  @Mock private TableMapper tableMapper;

  @Mock private SecurityContext securityContext;

  @Mock private UriInfo uriInfo;

  @Mock private Principal principal;

  private TableService tableService;
  private MockedStatic<Entity> mockedEntity;

  private static final UUID TEST_TABLE_ID = UUID.randomUUID();
  private static final String TEST_TABLE_NAME = "test_database.test_schema.test_table";
  private static final String TEST_USER = "test-user";

  @BeforeEach
  void setUp() {
    tableService = new TableService(tableRepository, searchRepository, authorizer, tableMapper);

    // Create mock User object for authorization
    User mockUser = new User();
    mockUser.setName(TEST_USER);
    mockUser.setId(UUID.randomUUID());
    mockUser.setIsAdmin(false); // Regular user, not admin
    mockUser.setIsBot(false);

    // Mock static Entity methods
    mockedEntity = mockStatic(Entity.class);
    mockedEntity.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(tableRepository);
    mockedEntity
        .when(() -> Entity.getEntityByName(eq(Entity.USER), eq(TEST_USER), any(), any()))
        .thenReturn(mockUser);

    when(securityContext.getUserPrincipal()).thenReturn(principal);
    when(principal.getName()).thenReturn(TEST_USER);
    when(uriInfo.getRequestUri()).thenReturn(URI.create("http://localhost/api/v1/tables"));

    // Default stub for authorizer.authorize() - does nothing (authorized by default)
    // Individual tests can override this to test authorization failures
    doNothing()
        .when(authorizer)
        .authorize(
            any(SecurityContext.class),
            any(OperationContext.class),
            any(ResourceContextInterface.class));
  }

  @AfterEach
  void tearDown() {
    // Close the static mock after each test
    if (mockedEntity != null) {
      mockedEntity.close();
    }
  }

  @Test
  void testGetEntity_Success() {
    // Arrange
    Table expectedTable = createTestTable(TEST_TABLE_ID, TEST_TABLE_NAME);
    Fields fields = mock(Fields.class);

    when(tableRepository.getFields("*")).thenReturn(fields);
    when(tableRepository.get(
            eq(uriInfo), eq(TEST_TABLE_ID), eq(fields), eq(Include.NON_DELETED), eq(false)))
        .thenReturn(expectedTable);

    // Act
    Table result =
        tableService.getEntity(
            uriInfo, securityContext, TEST_TABLE_ID, fields, Include.NON_DELETED);

    // Assert
    assertNotNull(result, "Result should not be null");
    assertEquals(TEST_TABLE_ID, result.getId(), "Table ID should match");
    assertEquals(TEST_TABLE_NAME, result.getFullyQualifiedName(), "Table FQN should match");

    // Verify authorization was called
    verify(authorizer)
        .authorize(
            eq(securityContext), any(OperationContext.class), any(ResourceContextInterface.class));

    // Verify repository was called
    verify(tableRepository)
        .get(eq(uriInfo), eq(TEST_TABLE_ID), eq(fields), eq(Include.NON_DELETED), eq(false));
  }

  @Test
  void testGetEntity_Unauthorized() {
    // Arrange
    Fields fields = mock(Fields.class);

    when(tableRepository.getFields("*")).thenReturn(fields);
    doThrow(new org.openmetadata.service.security.AuthorizationException("Access denied"))
        .when(authorizer)
        .authorize(
            eq(securityContext), any(OperationContext.class), any(ResourceContextInterface.class));

    // Act & Assert
    assertThrows(
        org.openmetadata.service.security.AuthorizationException.class,
        () ->
            tableService.getEntity(
                uriInfo, securityContext, TEST_TABLE_ID, fields, Include.NON_DELETED),
        "Should throw AuthorizationException");

    // Verify authorization was called but repository was NOT called
    verify(authorizer)
        .authorize(
            eq(securityContext), any(OperationContext.class), any(ResourceContextInterface.class));
    verify(tableRepository, never()).get(any(), any(), any(), any(), anyBoolean());
  }

  @Test
  void testGetEntityByName_Success() {
    // Arrange
    Table expectedTable = createTestTable(TEST_TABLE_ID, TEST_TABLE_NAME);
    Fields fields = mock(Fields.class);

    when(tableRepository.getFields("*")).thenReturn(fields);
    when(tableRepository.getByName(
            eq(uriInfo), eq(TEST_TABLE_NAME), eq(fields), eq(Include.NON_DELETED), eq(false)))
        .thenReturn(expectedTable);

    // Act
    Table result =
        tableService.getEntityByName(
            uriInfo, securityContext, TEST_TABLE_NAME, fields, Include.NON_DELETED);

    // Assert
    assertNotNull(result, "Result should not be null");
    assertEquals(TEST_TABLE_NAME, result.getFullyQualifiedName(), "Table FQN should match");

    // Verify authorization and repository calls
    verify(authorizer)
        .authorize(
            eq(securityContext), any(OperationContext.class), any(ResourceContextInterface.class));
    verify(tableRepository)
        .getByName(
            eq(uriInfo), eq(TEST_TABLE_NAME), eq(fields), eq(Include.NON_DELETED), eq(false));
  }

  @Test
  void testListEntities_Success() {
    // Arrange
    Fields fields = mock(Fields.class);
    ListFilter filter = new ListFilter(Include.NON_DELETED);
    ResultList<Table> expectedResultList = new ResultList<>();
    expectedResultList.setData(java.util.List.of(createTestTable(TEST_TABLE_ID, TEST_TABLE_NAME)));

    when(tableRepository.listAfter(eq(uriInfo), eq(fields), eq(filter), eq(10), isNull()))
        .thenReturn(expectedResultList);

    // Act
    ResultList<Table> result =
        tableService.listEntities(uriInfo, securityContext, fields, filter, 10, null, null);

    // Assert
    assertNotNull(result, "Result should not be null");
    assertEquals(1, result.getData().size(), "Should have 1 table");

    // Verify authorization and repository calls
    verify(authorizer)
        .authorize(
            eq(securityContext), any(OperationContext.class), any(ResourceContextInterface.class));
    verify(tableRepository).listAfter(eq(uriInfo), eq(fields), eq(filter), eq(10), isNull());
  }

  @Test
  void testListEntities_WithBeforeCursor() {
    // Arrange
    Fields fields = mock(Fields.class);
    ListFilter filter = new ListFilter(Include.NON_DELETED);
    String beforeCursor = "some-cursor";
    ResultList<Table> expectedResultList = new ResultList<>();

    when(tableRepository.listBefore(eq(uriInfo), eq(fields), eq(filter), eq(10), eq(beforeCursor)))
        .thenReturn(expectedResultList);

    // Act
    ResultList<Table> result =
        tableService.listEntities(uriInfo, securityContext, fields, filter, 10, beforeCursor, null);

    // Assert
    assertNotNull(result, "Result should not be null");

    // Verify backward pagination was used
    verify(tableRepository)
        .listBefore(eq(uriInfo), eq(fields), eq(filter), eq(10), eq(beforeCursor));
    verify(tableRepository, never()).listAfter(any(), any(), any(), anyInt(), any());
  }

  @Test
  void testGetEntityVersion_Success() {
    // Arrange
    String version = "1.0";
    Table expectedTable = createTestTable(TEST_TABLE_ID, TEST_TABLE_NAME);

    when(tableRepository.getVersion(eq(TEST_TABLE_ID), eq(version))).thenReturn(expectedTable);

    // Act
    Table result = tableService.getEntityVersion(securityContext, TEST_TABLE_ID, version);

    // Assert
    assertNotNull(result, "Result should not be null");
    assertEquals(TEST_TABLE_ID, result.getId(), "Table ID should match");

    // Verify authorization and repository calls
    verify(authorizer)
        .authorize(
            eq(securityContext), any(OperationContext.class), any(ResourceContextInterface.class));
    verify(tableRepository).getVersion(eq(TEST_TABLE_ID), eq(version));
  }

  @Test
  void testListEntityVersions_Success() {
    // Arrange
    EntityHistory expectedHistory = new EntityHistory();
    expectedHistory.setEntityType(Entity.TABLE);

    when(tableRepository.listVersions(eq(TEST_TABLE_ID))).thenReturn(expectedHistory);

    // Act
    EntityHistory result = tableService.listEntityVersions(securityContext, TEST_TABLE_ID);

    // Assert
    assertNotNull(result, "Result should not be null");
    assertEquals(Entity.TABLE, result.getEntityType(), "Entity type should match");

    // Verify authorization and repository calls
    verify(authorizer)
        .authorize(
            eq(securityContext), any(OperationContext.class), any(ResourceContextInterface.class));
    verify(tableRepository).listVersions(eq(TEST_TABLE_ID));
  }

  @Test
  void testCreateEntity_Success() throws Exception {
    // Arrange
    Table tableToCreate = createTestTable(null, TEST_TABLE_NAME);
    Table createdTable = createTestTable(TEST_TABLE_ID, TEST_TABLE_NAME);

    when(tableRepository.create(eq(uriInfo), eq(tableToCreate))).thenReturn(createdTable);

    // Act
    Table result = tableService.createEntity(uriInfo, securityContext, tableToCreate);

    // Assert
    assertNotNull(result, "Result should not be null");
    assertEquals(TEST_TABLE_ID, result.getId(), "Created table should have ID");

    // Verify authorization and repository calls
    verify(authorizer)
        .authorize(
            eq(securityContext), any(OperationContext.class), any(ResourceContextInterface.class));
    verify(tableRepository).create(eq(uriInfo), eq(tableToCreate));
  }

  @Test
  void testGetFields_DelegatesToRepository() {
    // Arrange
    String fieldsParam = "owners,tags,columns";
    Fields expectedFields = mock(Fields.class);

    when(tableRepository.getFields(eq(fieldsParam))).thenReturn(expectedFields);

    // Act
    Fields result = tableService.getFields(fieldsParam);

    // Assert
    assertSame(expectedFields, result, "Should return fields from repository");
    verify(tableRepository).getFields(eq(fieldsParam));
  }

  @Test
  void testGetAllowedFields_DelegatesToRepository() {
    // Arrange
    Set<String> expectedFields = Set.of("owners", "tags", "columns", "database");

    when(tableRepository.getAllowedFields()).thenReturn(expectedFields);

    // Act
    Set<String> result = tableService.getAllowedFields();

    // Assert
    assertEquals(expectedFields, result, "Should return allowed fields from repository");
    verify(tableRepository).getAllowedFields();
  }

  @Test
  void testGetEntityType_ReturnsTableType() {
    // Act
    String entityType = tableService.getEntityType();

    // Assert
    assertEquals(Entity.TABLE, entityType, "Entity type should be 'table'");
  }

  /**
   * Helper method to create a test Table entity.
   *
   * @param id Table ID (can be null for create scenarios)
   * @param fqn Fully qualified name
   * @return Test Table entity
   */
  private Table createTestTable(UUID id, String fqn) {
    Table table = new Table();
    table.setId(id);
    table.setFullyQualifiedName(fqn);
    table.setName(fqn.substring(fqn.lastIndexOf('.') + 1));
    return table;
  }
}
