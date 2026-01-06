package org.openmetadata.sdk;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;

/**
 * Unit tests for EntityReferences utility class.
 */
public class EntityReferencesTest {

  @Test
  void testFromTeam() {
    // Arrange
    UUID teamId = UUID.randomUUID();
    Team team = new Team();
    team.setId(teamId);
    team.setName("engineering");
    team.setFullyQualifiedName("engineering");

    // Act
    EntityReference ref = EntityReferences.from(team);

    // Assert
    assertNotNull(ref);
    assertEquals(teamId, ref.getId());
    assertNotNull(ref.getType()); // Falls back to class name
    assertEquals("engineering", ref.getName());
    assertEquals("engineering", ref.getFullyQualifiedName());
  }

  @Test
  void testFromUser() {
    // Arrange
    UUID userId = UUID.randomUUID();
    User user = new User();
    user.setId(userId);
    user.setName("john.doe");
    user.setFullyQualifiedName("john.doe");

    // Act
    EntityReference ref = EntityReferences.from(user);

    // Assert
    assertNotNull(ref);
    assertEquals(userId, ref.getId());
    assertNotNull(ref.getType());
    assertEquals("john.doe", ref.getName());
  }

  @Test
  void testFromDatabase() {
    // Arrange
    UUID dbId = UUID.randomUUID();
    Database database = new Database();
    database.setId(dbId);
    database.setName("analytics");
    database.setFullyQualifiedName("snowflake_prod.analytics");

    // Act
    EntityReference ref = EntityReferences.from(database);

    // Assert
    assertNotNull(ref);
    assertEquals(dbId, ref.getId());
    assertNotNull(ref.getType());
    assertEquals("analytics", ref.getName());
    assertEquals("snowflake_prod.analytics", ref.getFullyQualifiedName());
  }

  @Test
  void testFromTable() {
    // Arrange
    UUID tableId = UUID.randomUUID();
    Table table = new Table();
    table.setId(tableId);
    table.setName("customers");
    table.setFullyQualifiedName("snowflake_prod.analytics.public.customers");

    // Act
    EntityReference ref = EntityReferences.from(table);

    // Assert
    assertNotNull(ref);
    assertEquals(tableId, ref.getId());
    assertNotNull(ref.getType());
    assertEquals("customers", ref.getName());
  }

  @Test
  void testTypeIsDerivedFromClassName() {
    // Arrange - entity type should be derived from class name
    UUID teamId = UUID.randomUUID();
    Team team = new Team();
    team.setId(teamId);
    team.setName("data-platform");

    // Act
    EntityReference ref = EntityReferences.from(team);

    // Assert
    assertNotNull(ref);
    assertEquals(teamId, ref.getId());
    // Type should be derived from class name (lowercase)
    assertEquals("team", ref.getType().toLowerCase());
  }

  @Test
  void testFromNullThrows() {
    // Act & Assert
    assertThrows(IllegalArgumentException.class, () -> EntityReferences.from(null));
  }

  @Test
  void testOfWithIdAndType() {
    // Arrange
    UUID id = UUID.randomUUID();

    // Act
    EntityReference ref = EntityReferences.of(id, "team");

    // Assert
    assertNotNull(ref);
    assertEquals(id, ref.getId());
    assertEquals("team", ref.getType());
    assertNull(ref.getName());
  }

  @Test
  void testOfWithIdTypeAndName() {
    // Arrange
    UUID id = UUID.randomUUID();

    // Act
    EntityReference ref = EntityReferences.of(id, "user", "john.doe");

    // Assert
    assertNotNull(ref);
    assertEquals(id, ref.getId());
    assertEquals("user", ref.getType());
    assertEquals("john.doe", ref.getName());
  }

  @Test
  void testMultipleOwnersPattern() {
    // Arrange
    UUID teamId = UUID.randomUUID();
    Team team = new Team();
    team.setId(teamId);
    team.setName("data-platform");

    UUID userId = UUID.randomUUID();
    User user = new User();
    user.setId(userId);
    user.setName("john.doe");

    // Act - common pattern for setting multiple owners
    List<EntityReference> owners =
        List.of(EntityReferences.from(team), EntityReferences.from(user));

    // Assert
    assertEquals(2, owners.size());
    assertNotNull(owners.get(0).getType());
    assertEquals("data-platform", owners.get(0).getName());
    assertNotNull(owners.get(1).getType());
    assertEquals("john.doe", owners.get(1).getName());
  }

  @Test
  void testSetDatabaseOwners() {
    // Arrange - simulating real usage pattern
    UUID teamId = UUID.randomUUID();
    Team team = new Team();
    team.setId(teamId);
    team.setName("engineering");

    UUID dbId = UUID.randomUUID();
    Database database = new Database();
    database.setId(dbId);
    database.setName("analytics");

    // Act - set team as owner using the helper
    database.setOwners(List.of(EntityReferences.from(team)));

    // Assert
    assertNotNull(database.getOwners());
    assertEquals(1, database.getOwners().size());
    assertEquals(teamId, database.getOwners().get(0).getId());
    assertNotNull(database.getOwners().get(0).getType());
  }

  @Test
  void testEntityReferenceFieldsAreCorrect() {
    // Arrange
    UUID id = UUID.randomUUID();
    Team team = new Team();
    team.setId(id);
    team.setName("test-team");
    team.setFullyQualifiedName("test-team");

    // Act
    EntityReference ref = EntityReferences.from(team);

    // Assert - verify all expected fields
    assertEquals(id, ref.getId());
    assertNotNull(ref.getType());
    assertEquals("test-team", ref.getName());
    assertEquals("test-team", ref.getFullyQualifiedName());
  }
}
