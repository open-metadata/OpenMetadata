package org.openmetadata.sdk.entities;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.services.teams.UserService;

/**
 * Mock tests for User entity operations.
 */
public class UserMockTest {

  @Mock private OpenMetadataClient mockClient;
  @Mock private UserService mockUserService;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
    when(mockClient.users()).thenReturn(mockUserService);
    org.openmetadata.sdk.entities.User.setDefaultClient(mockClient);
  }

  @Test
  void testCreateUser() {
    // Arrange
    CreateUser createRequest = new CreateUser();
    createRequest.setName("john.doe");
    createRequest.setEmail("john.doe@example.com");
    createRequest.setDisplayName("John Doe");
    createRequest.setDescription("Test user account");

    User expectedUser = new User();
    expectedUser.setId(UUID.randomUUID());
    expectedUser.setName("john.doe");
    expectedUser.setEmail("john.doe@example.com");
    expectedUser.setDisplayName("John Doe");
    expectedUser.setFullyQualifiedName("john.doe");

    when(mockUserService.create(any(CreateUser.class))).thenReturn(expectedUser);

    // Act
    User result = org.openmetadata.sdk.entities.User.create(createRequest);

    // Assert
    assertNotNull(result);
    assertEquals("john.doe", result.getName());
    assertEquals("john.doe@example.com", result.getEmail());
    assertEquals("John Doe", result.getDisplayName());
    verify(mockUserService).create(any(CreateUser.class));
  }

  @Test
  void testRetrieveUser() {
    // Arrange
    String userId = UUID.randomUUID().toString();
    User expectedUser = new User();
    expectedUser.setId(UUID.fromString(userId));
    expectedUser.setName("jane.smith");
    expectedUser.setEmail("jane.smith@example.com");

    when(mockUserService.get(userId)).thenReturn(expectedUser);

    // Act
    User result = org.openmetadata.sdk.entities.User.retrieve(userId);

    // Assert
    assertNotNull(result);
    assertEquals(userId, result.getId().toString());
    assertEquals("jane.smith", result.getName());
    verify(mockUserService).get(userId);
  }

  @Test
  void testRetrieveUserWithFields() {
    // Arrange
    String userId = UUID.randomUUID().toString();
    String fields = "teams,roles,owns";
    User expectedUser = new User();
    expectedUser.setId(UUID.fromString(userId));
    expectedUser.setName("admin.user");

    // Mock teams field
    EntityReference team = new EntityReference();
    team.setName("engineering");
    team.setType("team");
    expectedUser.setTeams(List.of(team));

    when(mockUserService.get(userId, fields)).thenReturn(expectedUser);

    // Act
    User result = org.openmetadata.sdk.entities.User.retrieve(userId, fields);

    // Assert
    assertNotNull(result);
    assertEquals(userId, result.getId().toString());
    assertNotNull(result.getTeams());
    assertEquals(1, result.getTeams().size());
    assertEquals("engineering", result.getTeams().get(0).getName());
    verify(mockUserService).get(userId, fields);
  }

  @Test
  void testRetrieveUserByName() {
    // Arrange
    String userName = "admin.user";
    User expectedUser = new User();
    expectedUser.setName(userName);
    expectedUser.setFullyQualifiedName(userName);
    expectedUser.setIsAdmin(true);

    when(mockUserService.getByName(userName)).thenReturn(expectedUser);

    // Act
    User result = org.openmetadata.sdk.entities.User.retrieveByName(userName);

    // Assert
    assertNotNull(result);
    assertEquals(userName, result.getFullyQualifiedName());
    assertTrue(result.getIsAdmin());
    verify(mockUserService).getByName(userName);
  }

  @Test
  void testUpdateUser() {
    // Arrange
    User userToUpdate = new User();
    userToUpdate.setId(UUID.randomUUID());
    userToUpdate.setName("test.user");
    userToUpdate.setDescription("Updated user description");
    userToUpdate.setIsBot(false);

    User expectedUser = new User();
    expectedUser.setId(userToUpdate.getId());
    expectedUser.setName(userToUpdate.getName());
    expectedUser.setDescription(userToUpdate.getDescription());
    expectedUser.setIsBot(false);

    when(mockUserService.update(userToUpdate.getId().toString(), userToUpdate))
        .thenReturn(expectedUser);

    // Act
    User result =
        org.openmetadata.sdk.entities.User.update(userToUpdate.getId().toString(), userToUpdate);

    // Assert
    assertNotNull(result);
    assertEquals("Updated user description", result.getDescription());
    assertFalse(result.getIsBot());
    verify(mockUserService).update(userToUpdate.getId().toString(), userToUpdate);
  }

  @Test
  void testDeleteUser() {
    // Arrange
    String userId = UUID.randomUUID().toString();
    doNothing().when(mockUserService).delete(eq(userId), any());

    // Act
    org.openmetadata.sdk.entities.User.delete(userId);

    // Assert
    verify(mockUserService).delete(eq(userId), any());
  }

  @Test
  void testDeleteUserWithOptions() {
    // Arrange
    String userId = UUID.randomUUID().toString();
    doNothing().when(mockUserService).delete(eq(userId), any());

    // Act
    org.openmetadata.sdk.entities.User.delete(userId, true, true);

    // Assert
    verify(mockUserService)
        .delete(
            eq(userId),
            argThat(
                params ->
                    "true".equals(params.get("recursive"))
                        && "true".equals(params.get("hardDelete"))));
  }
}
