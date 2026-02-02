package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class SecurityUtilTest {

  @Test
  void testValidatePrincipalClaimsMapping_WithBothUsernameAndEmail() {
    // Valid mapping with both username and email
    Map<String, String> validMapping = new HashMap<>();
    validMapping.put("username", "preferred_username");
    validMapping.put("email", "email");

    assertDoesNotThrow(() -> SecurityUtil.validatePrincipalClaimsMapping(validMapping));
  }

  @Test
  void testValidatePrincipalClaimsMapping_WithEmptyMapping() {
    // Empty mapping should not throw an exception
    Map<String, String> emptyMapping = new HashMap<>();

    assertDoesNotThrow(() -> SecurityUtil.validatePrincipalClaimsMapping(emptyMapping));
  }

  @Test
  void testValidatePrincipalClaimsMapping_WithNullMapping() {
    // Null mapping should not throw an exception
    assertDoesNotThrow(() -> SecurityUtil.validatePrincipalClaimsMapping(null));
  }

  @Test
  void testValidatePrincipalClaimsMapping_MissingUsername() {
    // Missing username should throw exception
    Map<String, String> mappingWithoutUsername = new HashMap<>();
    mappingWithoutUsername.put("email", "email");

    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class,
            () -> SecurityUtil.validatePrincipalClaimsMapping(mappingWithoutUsername));

    assertEquals(
        "Invalid JWT Principal Claims Mapping. Both username and email should be present",
        exception.getMessage());
  }

  @Test
  void testValidatePrincipalClaimsMapping_MissingEmail() {
    // Missing email should throw exception
    Map<String, String> mappingWithoutEmail = new HashMap<>();
    mappingWithoutEmail.put("username", "preferred_username");

    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class,
            () -> SecurityUtil.validatePrincipalClaimsMapping(mappingWithoutEmail));

    assertEquals(
        "Invalid JWT Principal Claims Mapping. Both username and email should be present",
        exception.getMessage());
  }

  @Test
  void testValidatePrincipalClaimsMapping_WithInvalidKey() {
    // Mapping with an invalid key (other than username and email) should throw exception
    Map<String, String> mappingWithInvalidKey = new HashMap<>();
    mappingWithInvalidKey.put("username", "preferred_username");
    mappingWithInvalidKey.put("email", "email");
    mappingWithInvalidKey.put("name", "full_name"); // Invalid key

    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class,
            () -> SecurityUtil.validatePrincipalClaimsMapping(mappingWithInvalidKey));

    assertEquals(
        "Invalid JWT Principal Claims Mapping. Only username and email keys are allowed, but found: name",
        exception.getMessage());
  }

  @Test
  void testValidatePrincipalClaimsMapping_WithOnlyInvalidKey() {
    // Mapping with only an invalid key should throw exception about missing username and email
    Map<String, String> mappingWithOnlyInvalidKey = new HashMap<>();
    mappingWithOnlyInvalidKey.put("firstName", "given_name");

    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class,
            () -> SecurityUtil.validatePrincipalClaimsMapping(mappingWithOnlyInvalidKey));

    // Should fail on missing username/email first before checking for invalid keys
    assertEquals(
        "Invalid JWT Principal Claims Mapping. Both username and email should be present",
        exception.getMessage());
  }

  @Test
  void testGetClaimAsList_WithListValue() {
    List<String> inputList = Arrays.asList("Engineering", "DevOps", "Platform");
    List<String> result = SecurityUtil.getClaimAsList(inputList);

    assertEquals(3, result.size());
    assertTrue(result.contains("Engineering"));
    assertTrue(result.contains("DevOps"));
    assertTrue(result.contains("Platform"));
  }

  @Test
  void testGetClaimAsList_WithSingleString() {
    String singleValue = "Engineering";
    List<String> result = SecurityUtil.getClaimAsList(singleValue);

    assertEquals(1, result.size());
    assertEquals("Engineering", result.get(0));
  }

  @Test
  void testGetClaimAsList_WithNullValue() {
    List<String> result = SecurityUtil.getClaimAsList(null);

    assertTrue(result.isEmpty());
  }

  @Test
  void testFindTeamsFromClaims_WithArrayClaim() {
    Map<String, Object> claims = new HashMap<>();
    claims.put("groups", Arrays.asList("Engineering", "DevOps"));

    List<String> teams = SecurityUtil.findTeamsFromClaims("groups", claims);

    assertEquals(2, teams.size());
    assertTrue(teams.contains("Engineering"));
    assertTrue(teams.contains("DevOps"));
  }

  @Test
  void testFindTeamsFromClaims_WithMissingClaim() {
    Map<String, Object> claims = new HashMap<>();
    claims.put("other", "value");

    List<String> teams = SecurityUtil.findTeamsFromClaims("groups", claims);

    assertTrue(teams.isEmpty());
  }

  @Test
  void testExtractDisplayNameFromClaims_WithNullClaims() {
    // Null claims should return null
    String displayName = SecurityUtil.extractDisplayNameFromClaims(null);

    assertEquals(null, displayName);
  }

  @Test
  void testExtractDisplayNameFromClaims_WithEmptyClaims() {
    // Empty claims map should return null
    Map<String, Object> claims = new HashMap<>();

    String displayName = SecurityUtil.extractDisplayNameFromClaims(claims);

    assertEquals(null, displayName);
  }

  @Test
  void testExtractDisplayNameFromClaims_WithDirectNameClaim() {
    // Direct 'name' claim should be returned with priority
    Map<String, Object> claims = new HashMap<>();
    claims.put("name", "John Doe");

    String displayName = SecurityUtil.extractDisplayNameFromClaims(claims);

    assertEquals("John Doe", displayName);
  }

  @Test
  void testExtractDisplayNameFromClaims_WithNameClaimAndGivenFamilyNames() {
    // Direct 'name' claim should be prioritized over given_name + family_name
    Map<String, Object> claims = new HashMap<>();
    claims.put("name", "John Doe");
    claims.put("given_name", "Jane");
    claims.put("family_name", "Smith");

    String displayName = SecurityUtil.extractDisplayNameFromClaims(claims);

    assertEquals("John Doe", displayName);
  }

  @Test
  void testExtractDisplayNameFromClaims_WithBothGivenAndFamilyNames() {
    // Should combine given_name and family_name when name claim is absent
    Map<String, Object> claims = new HashMap<>();
    claims.put("given_name", "Jane");
    claims.put("family_name", "Smith");

    String displayName = SecurityUtil.extractDisplayNameFromClaims(claims);

    assertEquals("Jane Smith", displayName);
  }

  @Test
  void testExtractDisplayNameFromClaims_WithOnlyGivenName() {
    // Should return only given_name when family_name is absent
    Map<String, Object> claims = new HashMap<>();
    claims.put("given_name", "Jane");

    String displayName = SecurityUtil.extractDisplayNameFromClaims(claims);

    assertEquals("Jane", displayName);
  }

  @Test
  void testExtractDisplayNameFromClaims_WithOnlyFamilyName() {
    // Should return only family_name when given_name is absent
    Map<String, Object> claims = new HashMap<>();
    claims.put("family_name", "Smith");

    String displayName = SecurityUtil.extractDisplayNameFromClaims(claims);

    assertEquals("Smith", displayName);
  }

  @Test
  void testExtractDisplayNameFromClaims_WithWhitespace() {
    // Should trim whitespace from all claims
    Map<String, Object> claims = new HashMap<>();
    claims.put("given_name", "  Jane  ");
    claims.put("family_name", "  Smith  ");

    String displayName = SecurityUtil.extractDisplayNameFromClaims(claims);

    assertEquals("Jane Smith", displayName);
  }

  @Test
  void testExtractDisplayNameFromClaims_WithWhitespaceInNameClaim() {
    // Should trim whitespace from direct name claim
    Map<String, Object> claims = new HashMap<>();
    claims.put("name", "  John Doe  ");

    String displayName = SecurityUtil.extractDisplayNameFromClaims(claims);

    assertEquals("John Doe", displayName);
  }

  @Test
  void testExtractDisplayNameFromClaims_WithEmptyStrings() {
    // Empty strings should be treated as no value
    Map<String, Object> claims = new HashMap<>();
    claims.put("given_name", "");
    claims.put("family_name", "");

    String displayName = SecurityUtil.extractDisplayNameFromClaims(claims);

    assertEquals(null, displayName);
  }

  @Test
  void testExtractDisplayNameFromClaims_WithNoSuitableClaims() {
    // Claims without name, given_name, or family_name should return null
    Map<String, Object> claims = new HashMap<>();
    claims.put("email", "john.doe@example.com");
    claims.put("sub", "123456");

    String displayName = SecurityUtil.extractDisplayNameFromClaims(claims);

    assertEquals(null, displayName);
  }
}
