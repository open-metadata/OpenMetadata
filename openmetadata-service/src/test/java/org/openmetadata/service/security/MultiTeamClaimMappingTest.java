package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.*;
import static org.openmetadata.service.security.SecurityUtil.findTeamsFromMultipleClaims;

import java.util.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Tests for multi-team claim mapping functionality.
 * Demonstrates extracting team information from multiple JWT/SAML claims.
 */
class MultiTeamClaimMappingTest {

  @Test
  @DisplayName("Extract teams from multiple claims - typical SSO scenario")
  void testExtractTeamsFromMultipleClaims() {
    // Simulate JWT claims from SSO provider with multiple team sources
    Map<String, Object> claims = new HashMap<>();
    claims.put("groups", Arrays.asList("engineering", "platform-team", "data-team"));
    claims.put("department", "Engineering");
    claims.put("division", "Technology");
    claims.put("businessUnit", "Product Development");

    // Configure to extract teams from multiple claims
    List<String> teamClaimMappings = Arrays.asList("groups", "department", "division");

    // Extract teams
    List<String> teams = findTeamsFromMultipleClaims(teamClaimMappings, claims);

    // Verify all teams are extracted
    assertEquals(5, teams.size());
    assertTrue(teams.contains("engineering"));
    assertTrue(teams.contains("platform-team"));
    assertTrue(teams.contains("data-team"));
    assertTrue(teams.contains("Engineering"));
    assertTrue(teams.contains("Technology"));
  }

  @Test
  @DisplayName("Extract teams with single value claims mixed with array claims")
  void testMixedClaimTypes() {
    Map<String, Object> claims = new HashMap<>();
    claims.put("groups", Arrays.asList("admins", "developers"));
    claims.put("department", "IT"); // Single string
    claims.put("location", "US-West"); // Not in team mappings

    List<String> teamClaimMappings = Arrays.asList("groups", "department");

    List<String> teams = findTeamsFromMultipleClaims(teamClaimMappings, claims);

    assertEquals(3, teams.size());
    assertTrue(teams.contains("admins"));
    assertTrue(teams.contains("developers"));
    assertTrue(teams.contains("IT"));
    assertFalse(teams.contains("US-West")); // Not in mapping list
  }

  @Test
  @DisplayName("Handle missing claims gracefully")
  void testMissingClaims() {
    Map<String, Object> claims = new HashMap<>();
    claims.put("groups", Arrays.asList("team1", "team2"));
    // "department" claim is missing

    List<String> teamClaimMappings = Arrays.asList("groups", "department", "division");

    List<String> teams = findTeamsFromMultipleClaims(teamClaimMappings, claims);

    // Should only extract from available claims
    assertEquals(2, teams.size());
    assertTrue(teams.contains("team1"));
    assertTrue(teams.contains("team2"));
  }

  @Test
  @DisplayName("Backward compatibility - single claim mapping still works")
  void testBackwardCompatibilitySingleClaim() {
    Map<String, Object> claims = new HashMap<>();
    claims.put("groups", Arrays.asList("team1", "team2", "team3"));

    // Old style: single claim mapping
    List<String> teamClaimMappings = Collections.singletonList("groups");

    List<String> teams = findTeamsFromMultipleClaims(teamClaimMappings, claims);

    assertEquals(3, teams.size());
    assertTrue(teams.contains("team1"));
    assertTrue(teams.contains("team2"));
    assertTrue(teams.contains("team3"));
  }

  @Test
  @DisplayName("Empty claims list returns empty result")
  void testEmptyClaimsList() {
    Map<String, Object> claims = new HashMap<>();
    claims.put("groups", Arrays.asList("team1"));

    List<String> teamClaimMappings = Collections.emptyList();

    List<String> teams = findTeamsFromMultipleClaims(teamClaimMappings, claims);

    assertTrue(teams.isEmpty());
  }

  @Test
  @DisplayName("Null handling")
  void testNullHandling() {
    Map<String, Object> claims = new HashMap<>();
    claims.put("groups", Arrays.asList("team1"));

    // Null mappings
    List<String> teams1 = findTeamsFromMultipleClaims(null, claims);
    assertTrue(teams1.isEmpty());

    // Null claims
    List<String> teamClaimMappings = Arrays.asList("groups");
    List<String> teams2 = findTeamsFromMultipleClaims(teamClaimMappings, null);
    assertTrue(teams2.isEmpty());
  }

  @Test
  @DisplayName("Real-world Okta scenario with groups and department")
  void testOktaScenario() {
    // Typical Okta JWT token claims
    Map<String, Object> claims = new HashMap<>();
    claims.put(
        "groups",
        Arrays.asList("Everyone", "OpenMetadata-Admins", "Data-Engineers", "Data-Stewards"));
    claims.put("department", "Data Platform");
    claims.put("email", "user@company.com");
    claims.put("name", "John Doe");

    // Extract teams from both groups and department
    List<String> teamClaimMappings = Arrays.asList("groups", "department");

    List<String> teams = findTeamsFromMultipleClaims(teamClaimMappings, claims);

    assertEquals(5, teams.size());
    assertTrue(teams.contains("OpenMetadata-Admins"));
    assertTrue(teams.contains("Data-Engineers"));
    assertTrue(teams.contains("Data-Stewards"));
    assertTrue(teams.contains("Data Platform"));
  }

  @Test
  @DisplayName("Real-world Azure AD scenario with groups and jobTitle")
  void testAzureADScenario() {
    // Typical Azure AD claims
    Map<String, Object> claims = new HashMap<>();
    claims.put(
        "groups",
        Arrays.asList(
            "a1b2c3d4-...", // Azure AD returns group IDs by default
            "e5f6g7h8-..."));
    claims.put("roles", Arrays.asList("DataSteward", "Admin"));
    claims.put("jobTitle", "Senior Data Engineer");

    // For Azure AD, you might map role names and job titles as teams
    List<String> teamClaimMappings = Arrays.asList("roles", "jobTitle");

    List<String> teams = findTeamsFromMultipleClaims(teamClaimMappings, claims);

    assertEquals(3, teams.size());
    assertTrue(teams.contains("DataSteward"));
    assertTrue(teams.contains("Admin"));
    assertTrue(teams.contains("Senior Data Engineer"));
  }

  @Test
  @DisplayName("Real-world SAML scenario with multiple attributes")
  void testSAMLScenario() {
    // SAML attributes from IdP
    Map<String, Object> claims = new HashMap<>();
    claims.put(
        "memberOf",
        Arrays.asList(
            "CN=DataTeam,OU=Groups,DC=company,DC=com",
            "CN=Engineering,OU=Groups,DC=company,DC=com"));
    claims.put("department", "Data Engineering");
    claims.put("company", "Acme Corp");
    claims.put("division", "Technology");

    // Extract from SAML attributes
    List<String> teamClaimMappings = Arrays.asList("memberOf", "department", "division");

    List<String> teams = findTeamsFromMultipleClaims(teamClaimMappings, claims);

    assertEquals(4, teams.size());
    assertTrue(teams.contains("CN=DataTeam,OU=Groups,DC=company,DC=com"));
    assertTrue(teams.contains("Data Engineering"));
    assertTrue(teams.contains("Technology"));
  }
}
