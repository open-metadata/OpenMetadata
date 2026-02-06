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
  void testExtractEmailFromClaim_withValidEmail() {
    Map<String, Object> claims = new HashMap<>();
    claims.put("email", "john.doe@company.com");

    String email = SecurityUtil.extractEmailFromClaim(claims, "email");

    assertEquals("john.doe@company.com", email);
  }

  @Test
  void testExtractEmailFromClaim_lowercasesEmail() {
    Map<String, Object> claims = new HashMap<>();
    claims.put("email", "John.Doe@Company.COM");

    String email = SecurityUtil.extractEmailFromClaim(claims, "email");

    assertEquals("john.doe@company.com", email);
  }

  @Test
  void testExtractEmailFromClaim_missingClaim() {
    Map<String, Object> claims = new HashMap<>();

    AuthenticationException ex =
        assertThrows(
            AuthenticationException.class,
            () -> SecurityUtil.extractEmailFromClaim(claims, "email"));

    assertTrue(ex.getMessage().contains("email claim 'email' not found"));
  }

  @Test
  void testExtractEmailFromClaim_invalidEmailFormat() {
    Map<String, Object> claims = new HashMap<>();
    claims.put("email", "not-an-email");

    AuthenticationException ex =
        assertThrows(
            AuthenticationException.class,
            () -> SecurityUtil.extractEmailFromClaim(claims, "email"));

    assertTrue(ex.getMessage().contains("invalid email format"));
  }

  @Test
  void testExtractEmailFromClaim_withEmptyString() {
    Map<String, Object> claims = new HashMap<>();
    claims.put("email", "");

    AuthenticationException ex =
        assertThrows(
            AuthenticationException.class,
            () -> SecurityUtil.extractEmailFromClaim(claims, "email"));

    assertTrue(ex.getMessage().contains("email claim 'email' not found"));
  }

  @Test
  void testExtractEmailFromClaim_withCustomClaimName() {
    Map<String, Object> claims = new HashMap<>();
    claims.put("preferred_email", "user@domain.org");

    String email = SecurityUtil.extractEmailFromClaim(claims, "preferred_email");

    assertEquals("user@domain.org", email);
  }

  @Test
  void testExtractDisplayNameFromClaim_withValidName() {
    Map<String, Object> claims = new HashMap<>();
    claims.put("name", "John Doe");

    String displayName =
        SecurityUtil.extractDisplayNameFromClaim(claims, "name", "john.doe@company.com");

    assertEquals("John Doe", displayName);
  }

  @Test
  void testExtractDisplayNameFromClaim_fallsBackToEmailPrefix() {
    Map<String, Object> claims = new HashMap<>();

    String displayName =
        SecurityUtil.extractDisplayNameFromClaim(claims, "name", "john.doe@company.com");

    assertEquals("john.doe", displayName);
  }

  @Test
  void testExtractDisplayNameFromClaim_emptyClaim_fallsBack() {
    Map<String, Object> claims = new HashMap<>();
    claims.put("name", "");

    String displayName =
        SecurityUtil.extractDisplayNameFromClaim(claims, "name", "john.doe@company.com");

    assertEquals("john.doe", displayName);
  }

  @Test
  void testValidateEmailDomain_allowedDomain() {
    List<String> allowedDomains = List.of("company.com", "subsidiary.com");

    // Should not throw
    SecurityUtil.validateEmailDomain("john@company.com", allowedDomains);
    SecurityUtil.validateEmailDomain("jane@subsidiary.com", allowedDomains);
  }

  @Test
  void testValidateEmailDomain_disallowedDomain() {
    List<String> allowedDomains = List.of("company.com");

    AuthenticationException ex =
        assertThrows(
            AuthenticationException.class,
            () -> SecurityUtil.validateEmailDomain("john@other.com", allowedDomains));

    assertTrue(ex.getMessage().contains("domain 'other.com' not in allowed list"));
  }

  @Test
  void testValidateEmailDomain_emptyAllowedList_allowsAll() {
    List<String> allowedDomains = List.of();

    // Should not throw - empty list means all domains allowed
    SecurityUtil.validateEmailDomain("john@any-domain.com", allowedDomains);
  }

  @Test
  void testValidateEmailDomain_caseInsensitive() {
    List<String> allowedDomains = List.of("Company.COM");

    // Should not throw - case insensitive comparison
    SecurityUtil.validateEmailDomain("john@company.com", allowedDomains);
  }

  @Test
  void testValidateEmailDomain_nullAllowedList_allowsAll() {
    // Should not throw - null list means all domains allowed
    assertDoesNotThrow(() -> SecurityUtil.validateEmailDomain("john@any-domain.com", null));
  }

  @Test
  void testValidateEmailDomain_nullEmail_throwsException() {
    List<String> allowedDomains = List.of("company.com");

    IllegalArgumentException ex =
        assertThrows(
            IllegalArgumentException.class,
            () -> SecurityUtil.validateEmailDomain(null, allowedDomains));

    assertEquals("Invalid email: email must be non-null and contain '@' symbol", ex.getMessage());
  }

  @Test
  void testValidateEmailDomain_emailWithoutAtSymbol_throwsException() {
    List<String> allowedDomains = List.of("company.com");

    IllegalArgumentException ex =
        assertThrows(
            IllegalArgumentException.class,
            () -> SecurityUtil.validateEmailDomain("invalid-email", allowedDomains));

    assertEquals("Invalid email: email must be non-null and contain '@' symbol", ex.getMessage());
  }
}
