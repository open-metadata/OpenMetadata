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
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.services.teams.TeamService;

/**
 * Mock tests for Team entity operations.
 */
public class TeamMockTest {

  @Mock private OpenMetadataClient mockClient;
  @Mock private TeamService mockTeamService;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
    when(mockClient.teams()).thenReturn(mockTeamService);
    org.openmetadata.sdk.entities.Team.setDefaultClient(mockClient);
  }

  @Test
  void testCreateTeam() {
    // Arrange
    CreateTeam createRequest = new CreateTeam();
    createRequest.setName("engineering");
    createRequest.setDisplayName("Engineering Team");
    createRequest.setDescription("Core engineering team");
    createRequest.setTeamType(CreateTeam.TeamType.DEPARTMENT);

    Team expectedTeam = new Team();
    expectedTeam.setId(UUID.randomUUID());
    expectedTeam.setName("engineering");
    expectedTeam.setDisplayName("Engineering Team");
    expectedTeam.setTeamType(CreateTeam.TeamType.DEPARTMENT);
    expectedTeam.setFullyQualifiedName("engineering");

    when(mockTeamService.create(any(CreateTeam.class))).thenReturn(expectedTeam);

    // Act
    Team result = org.openmetadata.sdk.entities.Team.create(createRequest);

    // Assert
    assertNotNull(result);
    assertEquals("engineering", result.getName());
    assertEquals("Engineering Team", result.getDisplayName());
    assertEquals(CreateTeam.TeamType.DEPARTMENT, result.getTeamType());
    verify(mockTeamService).create(any(CreateTeam.class));
  }

  @Test
  void testRetrieveTeam() {
    // Arrange
    String teamId = UUID.randomUUID().toString();
    Team expectedTeam = new Team();
    expectedTeam.setId(UUID.fromString(teamId));
    expectedTeam.setName("data-team");
    expectedTeam.setEmail("data-team@example.com");
    expectedTeam.setUserCount(25);

    when(mockTeamService.get(teamId)).thenReturn(expectedTeam);

    // Act
    Team result = org.openmetadata.sdk.entities.Team.retrieve(teamId);

    // Assert
    assertNotNull(result);
    assertEquals(teamId, result.getId().toString());
    assertEquals("data-team", result.getName());
    assertEquals("data-team@example.com", result.getEmail());
    assertEquals(25, result.getUserCount());
    verify(mockTeamService).get(teamId);
  }

  @Test
  void testRetrieveTeamWithMembers() {
    // Arrange
    String teamId = UUID.randomUUID().toString();
    String fields = "users,owns,parents,children";
    Team expectedTeam = new Team();
    expectedTeam.setId(UUID.fromString(teamId));
    expectedTeam.setName("platform-team");

    // Mock users field
    EntityReference user1 = new EntityReference();
    user1.setName("john.doe");
    user1.setType("user");
    EntityReference user2 = new EntityReference();
    user2.setName("jane.smith");
    user2.setType("user");
    expectedTeam.setUsers(List.of(user1, user2));

    when(mockTeamService.get(teamId, fields)).thenReturn(expectedTeam);

    // Act
    Team result = org.openmetadata.sdk.entities.Team.retrieve(teamId, fields);

    // Assert
    assertNotNull(result);
    assertNotNull(result.getUsers());
    assertEquals(2, result.getUsers().size());
    assertEquals("john.doe", result.getUsers().get(0).getName());
    assertEquals("jane.smith", result.getUsers().get(1).getName());
    verify(mockTeamService).get(teamId, fields);
  }

  @Test
  void testRetrieveTeamByName() {
    // Arrange
    String teamName = "security-team";
    Team expectedTeam = new Team();
    expectedTeam.setName(teamName);
    expectedTeam.setFullyQualifiedName(teamName);
    expectedTeam.setIsJoinable(true);
    expectedTeam.setTeamType(CreateTeam.TeamType.GROUP);

    when(mockTeamService.getByName(teamName)).thenReturn(expectedTeam);

    // Act
    Team result = org.openmetadata.sdk.entities.Team.retrieveByName(teamName);

    // Assert
    assertNotNull(result);
    assertEquals(teamName, result.getFullyQualifiedName());
    assertTrue(result.getIsJoinable());
    assertEquals(CreateTeam.TeamType.GROUP, result.getTeamType());
    verify(mockTeamService).getByName(teamName);
  }

  @Test
  void testUpdateTeam() {
    // Arrange
    Team teamToUpdate = new Team();
    teamToUpdate.setId(UUID.randomUUID());
    teamToUpdate.setName("devops-team");
    teamToUpdate.setDescription("Updated DevOps team description");
    teamToUpdate.setEmail("devops@company.com");

    Team expectedTeam = new Team();
    expectedTeam.setId(teamToUpdate.getId());
    expectedTeam.setName(teamToUpdate.getName());
    expectedTeam.setDescription(teamToUpdate.getDescription());
    expectedTeam.setEmail(teamToUpdate.getEmail());

    when(mockTeamService.update(teamToUpdate.getId().toString(), teamToUpdate))
        .thenReturn(expectedTeam);

    // Act
    Team result =
        org.openmetadata.sdk.entities.Team.update(teamToUpdate.getId().toString(), teamToUpdate);

    // Assert
    assertNotNull(result);
    assertEquals("Updated DevOps team description", result.getDescription());
    assertEquals("devops@company.com", result.getEmail());
    verify(mockTeamService).update(teamToUpdate.getId().toString(), teamToUpdate);
  }

  @Test
  void testDeleteTeam() {
    // Arrange
    String teamId = UUID.randomUUID().toString();
    doNothing().when(mockTeamService).delete(eq(teamId), any());

    // Act
    org.openmetadata.sdk.entities.Team.delete(teamId);

    // Assert
    verify(mockTeamService).delete(eq(teamId), any());
  }

  @Test
  void testHierarchicalTeams() {
    // Arrange - Test parent-child team relationships
    String parentId = UUID.randomUUID().toString();
    Team parentTeam = new Team();
    parentTeam.setId(UUID.fromString(parentId));
    parentTeam.setName("organization");
    parentTeam.setTeamType(CreateTeam.TeamType.ORGANIZATION);

    String childId = UUID.randomUUID().toString();
    Team childTeam = new Team();
    childTeam.setId(UUID.fromString(childId));
    childTeam.setName("sub-team");
    childTeam.setTeamType(CreateTeam.TeamType.GROUP);

    EntityReference parentRef = new EntityReference();
    parentRef.setId(UUID.fromString(parentId));
    parentRef.setType("team");
    parentRef.setName("organization");
    childTeam.setParents(List.of(parentRef));

    when(mockTeamService.get(childId, "parents")).thenReturn(childTeam);

    // Act
    Team child = org.openmetadata.sdk.entities.Team.retrieve(childId, "parents");

    // Assert
    assertNotNull(child.getParents());
    assertEquals(1, child.getParents().size());
    assertEquals(parentId, child.getParents().get(0).getId().toString());
    verify(mockTeamService).get(childId, "parents");
  }

  @Test
  void testTeamWithDefaultRoles() {
    // Arrange
    String teamId = UUID.randomUUID().toString();
    Team expectedTeam = new Team();
    expectedTeam.setId(UUID.fromString(teamId));
    expectedTeam.setName("analytics-team");

    // Mock default roles
    EntityReference dataAnalystRole = new EntityReference();
    dataAnalystRole.setName("DataAnalyst");
    dataAnalystRole.setType("role");
    expectedTeam.setDefaultRoles(List.of(dataAnalystRole));

    when(mockTeamService.get(teamId, "defaultRoles")).thenReturn(expectedTeam);

    // Act
    Team result = org.openmetadata.sdk.entities.Team.retrieve(teamId, "defaultRoles");

    // Assert
    assertNotNull(result.getDefaultRoles());
    assertEquals(1, result.getDefaultRoles().size());
    assertEquals("DataAnalyst", result.getDefaultRoles().get(0).getName());
    verify(mockTeamService).get(teamId, "defaultRoles");
  }
}
