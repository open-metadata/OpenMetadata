# User Identity Simplification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplify OpenMetadata authentication to use email as the primary user identifier with backward-compatible deprecation of complex claim resolution.

**Architecture:** Email-first identity resolution across all auth providers (OIDC, SAML, LDAP, Basic). New simplified config options (`emailClaim`, `displayNameClaim`, `adminEmails`, `allowedEmailDomains`, `botDomain`) with deprecation warnings for old configs. Auto-generated usernames with collision handling.

**Tech Stack:** Java 21, Dropwizard, JSON Schema, JUnit 5, Mockito

---

## Task 1: Update Authentication Configuration Schema

**Files:**
- Modify: `openmetadata-spec/src/main/resources/json/schema/configuration/authenticationConfiguration.json`

**Step 1: Add new emailClaim property**

Add after `jwtPrincipalClaimsMapping` (around line 90):

```json
"emailClaim": {
  "description": "JWT claim name containing the user's email address. Defaults based on provider: 'email' for OIDC/SAML, 'mail' for LDAP.",
  "type": "string",
  "default": "email"
},
```

**Step 2: Add new displayNameClaim property**

Add after `emailClaim`:

```json
"displayNameClaim": {
  "description": "JWT claim name containing the user's display name. Defaults based on provider: 'name' for OIDC/SAML, 'displayName' for LDAP.",
  "type": "string",
  "default": "name"
},
```

**Step 3: Mark deprecated fields**

Update descriptions for `jwtPrincipalClaims` and `jwtPrincipalClaimsMapping` to include deprecation notice:

For `jwtPrincipalClaims` (line 74-81):
```json
"jwtPrincipalClaims": {
  "description": "[DEPRECATED: Use 'emailClaim' instead] Use this claim from the JWT to identify the principal/subject of the token. Defaults are sub, email, preferred_username, name, upn, email_verified",
  ...
}
```

For `jwtPrincipalClaimsMapping` (line 82-90):
```json
"jwtPrincipalClaimsMapping": {
  "description": "[DEPRECATED: Use 'emailClaim' and 'displayNameClaim' instead] Use these claims from the JWT to identify the principal/subject and extract email. Format: 'username:claim_name,email:claim_name'",
  ...
}
```

**Step 4: Rebuild spec module**

Run: `mvn clean install -pl openmetadata-spec -DskipTests`

**Step 5: Commit**

```bash
git add openmetadata-spec/src/main/resources/json/schema/configuration/authenticationConfiguration.json
git commit -m "feat(auth): add emailClaim and displayNameClaim config options

Add simplified configuration for email-first identity resolution:
- emailClaim: JWT claim for user email (default: 'email')
- displayNameClaim: JWT claim for display name (default: 'name')
- Mark jwtPrincipalClaims and jwtPrincipalClaimsMapping as deprecated"
```

---

## Task 2: Update Authorizer Configuration Schema

**Files:**
- Modify: `openmetadata-spec/src/main/resources/json/schema/configuration/authorizerConfiguration.json`

**Step 1: Add adminEmails property**

Add after `adminPrincipals` (around line 27):

```json
"adminEmails": {
  "description": "List of email addresses that should be granted admin privileges. Preferred over adminPrincipals.",
  "type": "array",
  "items": {
    "type": "string",
    "format": "email"
  },
  "default": []
},
```

**Step 2: Add allowedEmailDomains property**

Add after `adminEmails`:

```json
"allowedEmailDomains": {
  "description": "List of email domains allowed to authenticate. If empty, all domains are allowed.",
  "type": "array",
  "items": {
    "type": "string"
  },
  "default": []
},
```

**Step 3: Add botDomain property**

Add after `allowedEmailDomains`:

```json
"botDomain": {
  "description": "Email domain used for system-created bots (e.g., ingestion-bot@{botDomain}).",
  "type": "string",
  "default": "openmetadata.org"
},
```

**Step 4: Mark deprecated fields**

Update description for `adminPrincipals` (lines 19-27):
```json
"adminPrincipals": {
  "description": "[DEPRECATED: Use 'adminEmails' instead] List of admin principals.",
  ...
}
```

Update description for `principalDomain` (if exists):
```json
"principalDomain": {
  "description": "[DEPRECATED: Use 'botDomain' for bots, 'allowedEmailDomains' for domain restrictions] Domain to use for constructing email addresses.",
  ...
}
```

**Step 5: Rebuild spec module**

Run: `mvn clean install -pl openmetadata-spec -DskipTests`

**Step 6: Commit**

```bash
git add openmetadata-spec/src/main/resources/json/schema/configuration/authorizerConfiguration.json
git commit -m "feat(auth): add adminEmails, allowedEmailDomains, botDomain config

Add simplified authorizer configuration:
- adminEmails: email-based admin list (replaces adminPrincipals)
- allowedEmailDomains: restrict authentication to specific domains
- botDomain: domain for system-created bot emails
- Mark adminPrincipals and principalDomain as deprecated"
```

---

## Task 3: Add Email Extraction Utility Methods in SecurityUtil

**Files:**
- Modify: `openmetadata-service/src/main/java/org/openmetadata/service/security/SecurityUtil.java`
- Test: `openmetadata-service/src/test/java/org/openmetadata/service/security/SecurityUtilTest.java`

**Step 1: Write failing test for extractEmailFromClaim**

Add to `SecurityUtilTest.java`:

```java
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

  AuthenticationException ex = assertThrows(AuthenticationException.class,
    () -> SecurityUtil.extractEmailFromClaim(claims, "email"));

  assertTrue(ex.getMessage().contains("email claim 'email' not found"));
}

@Test
void testExtractEmailFromClaim_invalidEmailFormat() {
  Map<String, Object> claims = new HashMap<>();
  claims.put("email", "not-an-email");

  AuthenticationException ex = assertThrows(AuthenticationException.class,
    () -> SecurityUtil.extractEmailFromClaim(claims, "email"));

  assertTrue(ex.getMessage().contains("invalid email format"));
}
```

**Step 2: Run tests to verify they fail**

Run: `mvn test -pl openmetadata-service -Dtest=SecurityUtilTest#testExtractEmailFromClaim* -DfailIfNoTests=false`

Expected: FAIL - method does not exist

**Step 3: Implement extractEmailFromClaim**

Add to `SecurityUtil.java` (after line 162):

```java
/**
 * Extract email from claims using the specified claim name.
 * This is the simplified email-first approach.
 *
 * @param claims JWT claims map
 * @param emailClaim name of the claim containing email
 * @return lowercase email address
 * @throws AuthenticationException if claim is missing or invalid
 */
public static String extractEmailFromClaim(Map<String, Object> claims, String emailClaim) {
  Object claimValue = getClaimOrObject(claims, emailClaim);

  if (claimValue == null || claimValue.toString().isEmpty()) {
    throw new AuthenticationException(
        String.format("Authentication failed: email claim '%s' not found in token", emailClaim));
  }

  String email = claimValue.toString().toLowerCase();

  if (!email.contains("@") || !isValidEmail(email)) {
    throw new AuthenticationException(
        String.format("Authentication failed: invalid email format in claim '%s'", emailClaim));
  }

  return email;
}

private static boolean isValidEmail(String email) {
  return email.matches("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$");
}
```

**Step 4: Run tests to verify they pass**

Run: `mvn test -pl openmetadata-service -Dtest=SecurityUtilTest#testExtractEmailFromClaim*`

Expected: PASS

**Step 5: Commit**

```bash
git add openmetadata-service/src/main/java/org/openmetadata/service/security/SecurityUtil.java
git add openmetadata-service/src/test/java/org/openmetadata/service/security/SecurityUtilTest.java
git commit -m "feat(auth): add extractEmailFromClaim utility method

Add simplified email extraction that:
- Extracts email from specified claim
- Validates email format
- Lowercases result
- Throws clear errors for missing/invalid claims"
```

---

## Task 4: Add Display Name Extraction Utility

**Files:**
- Modify: `openmetadata-service/src/main/java/org/openmetadata/service/security/SecurityUtil.java`
- Test: `openmetadata-service/src/test/java/org/openmetadata/service/security/SecurityUtilTest.java`

**Step 1: Write failing tests**

Add to `SecurityUtilTest.java`:

```java
@Test
void testExtractDisplayNameFromClaim_withValidName() {
  Map<String, Object> claims = new HashMap<>();
  claims.put("name", "John Doe");

  String displayName = SecurityUtil.extractDisplayNameFromClaim(claims, "name", "john.doe@company.com");

  assertEquals("John Doe", displayName);
}

@Test
void testExtractDisplayNameFromClaim_fallsBackToEmailPrefix() {
  Map<String, Object> claims = new HashMap<>();
  // No name claim

  String displayName = SecurityUtil.extractDisplayNameFromClaim(claims, "name", "john.doe@company.com");

  assertEquals("john.doe", displayName);
}

@Test
void testExtractDisplayNameFromClaim_emptyClaim_fallsBack() {
  Map<String, Object> claims = new HashMap<>();
  claims.put("name", "");

  String displayName = SecurityUtil.extractDisplayNameFromClaim(claims, "name", "john.doe@company.com");

  assertEquals("john.doe", displayName);
}
```

**Step 2: Run tests to verify they fail**

Run: `mvn test -pl openmetadata-service -Dtest=SecurityUtilTest#testExtractDisplayNameFromClaim*`

Expected: FAIL

**Step 3: Implement extractDisplayNameFromClaim**

Add to `SecurityUtil.java`:

```java
/**
 * Extract display name from claims, falling back to email prefix.
 *
 * @param claims JWT claims map
 * @param displayNameClaim name of the claim containing display name
 * @param email user's email (used for fallback)
 * @return display name
 */
public static String extractDisplayNameFromClaim(
    Map<String, Object> claims, String displayNameClaim, String email) {
  Object claimValue = getClaimOrObject(claims, displayNameClaim);

  if (claimValue != null && !claimValue.toString().trim().isEmpty()) {
    return claimValue.toString().trim();
  }

  // Fallback to email prefix
  return email.split("@")[0];
}
```

**Step 4: Run tests to verify they pass**

Run: `mvn test -pl openmetadata-service -Dtest=SecurityUtilTest#testExtractDisplayNameFromClaim*`

Expected: PASS

**Step 5: Commit**

```bash
git add openmetadata-service/src/main/java/org/openmetadata/service/security/SecurityUtil.java
git add openmetadata-service/src/test/java/org/openmetadata/service/security/SecurityUtilTest.java
git commit -m "feat(auth): add extractDisplayNameFromClaim utility method

Extract display name from claim with fallback to email prefix
when claim is missing or empty."
```

---

## Task 5: Add Username Generation Utility

**Files:**
- Modify: `openmetadata-service/src/main/java/org/openmetadata/service/util/UserUtil.java`
- Test: `openmetadata-service/src/test/java/org/openmetadata/service/util/UserUtilTest.java`

**Step 1: Write failing tests**

Create or add to `UserUtilTest.java`:

```java
@Test
void testGenerateUsernameFromEmail_basic() {
  String username = UserUtil.generateUsernameFromEmail("john.doe@company.com", name -> false);

  assertEquals("john.doe", username);
}

@Test
void testGenerateUsernameFromEmail_withCollision() {
  // First call returns true (collision), second returns false
  AtomicInteger callCount = new AtomicInteger(0);
  String username = UserUtil.generateUsernameFromEmail("john.doe@company.com", name -> {
    return callCount.getAndIncrement() == 0;
  });

  assertTrue(username.startsWith("john.doe_"));
  assertTrue(username.length() > "john.doe_".length());
}

@Test
void testGenerateUsernameFromEmail_lowercases() {
  String username = UserUtil.generateUsernameFromEmail("John.Doe@Company.COM", name -> false);

  assertEquals("john.doe", username);
}

@Test
void testGenerateUsernameFromEmail_handlesSpecialChars() {
  String username = UserUtil.generateUsernameFromEmail("john+test@company.com", name -> false);

  assertEquals("john+test", username);
}
```

**Step 2: Run tests to verify they fail**

Run: `mvn test -pl openmetadata-service -Dtest=UserUtilTest#testGenerateUsernameFromEmail*`

Expected: FAIL

**Step 3: Implement generateUsernameFromEmail**

Add to `UserUtil.java`:

```java
import java.security.SecureRandom;
import java.util.function.Predicate;

private static final SecureRandom RANDOM = new SecureRandom();
private static final String SUFFIX_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
private static final int SUFFIX_LENGTH = 4;

/**
 * Generate a unique username from email address.
 * Uses email prefix, adds random suffix on collision.
 *
 * @param email user's email address
 * @param existsChecker predicate to check if username already exists
 * @return unique username
 */
public static String generateUsernameFromEmail(String email, Predicate<String> existsChecker) {
  String baseUsername = email.toLowerCase().split("@")[0];

  if (!existsChecker.test(baseUsername)) {
    return baseUsername;
  }

  // Collision detected, add random suffix
  String username;
  do {
    String suffix = generateRandomSuffix();
    username = baseUsername + "_" + suffix;
  } while (existsChecker.test(username));

  return username;
}

private static String generateRandomSuffix() {
  StringBuilder sb = new StringBuilder(SUFFIX_LENGTH);
  for (int i = 0; i < SUFFIX_LENGTH; i++) {
    sb.append(SUFFIX_CHARS.charAt(RANDOM.nextInt(SUFFIX_CHARS.length())));
  }
  return sb.toString();
}
```

**Step 4: Run tests to verify they pass**

Run: `mvn test -pl openmetadata-service -Dtest=UserUtilTest#testGenerateUsernameFromEmail*`

Expected: PASS

**Step 5: Commit**

```bash
git add openmetadata-service/src/main/java/org/openmetadata/service/util/UserUtil.java
git add openmetadata-service/src/test/java/org/openmetadata/service/util/UserUtilTest.java
git commit -m "feat(auth): add generateUsernameFromEmail utility

Generate unique usernames from email with:
- Email prefix as base username
- Random 4-char suffix on collision
- Lowercase normalization"
```

---

## Task 6: Add Domain Validation Utility

**Files:**
- Modify: `openmetadata-service/src/main/java/org/openmetadata/service/security/SecurityUtil.java`
- Test: `openmetadata-service/src/test/java/org/openmetadata/service/security/SecurityUtilTest.java`

**Step 1: Write failing tests**

Add to `SecurityUtilTest.java`:

```java
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

  AuthenticationException ex = assertThrows(AuthenticationException.class,
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
```

**Step 2: Run tests to verify they fail**

Run: `mvn test -pl openmetadata-service -Dtest=SecurityUtilTest#testValidateEmailDomain*`

Expected: FAIL

**Step 3: Implement validateEmailDomain**

Add to `SecurityUtil.java`:

```java
/**
 * Validate that email domain is in the allowed list.
 *
 * @param email user's email address
 * @param allowedEmailDomains list of allowed domains (empty = allow all)
 * @throws AuthenticationException if domain not allowed
 */
public static void validateEmailDomain(String email, List<String> allowedEmailDomains) {
  if (allowedEmailDomains == null || allowedEmailDomains.isEmpty()) {
    return; // All domains allowed
  }

  String domain = email.substring(email.indexOf("@") + 1).toLowerCase();

  boolean allowed = allowedEmailDomains.stream()
      .anyMatch(d -> d.toLowerCase().equals(domain));

  if (!allowed) {
    throw new AuthenticationException(
        String.format("Authentication failed: domain '%s' not in allowed list", domain));
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `mvn test -pl openmetadata-service -Dtest=SecurityUtilTest#testValidateEmailDomain*`

Expected: PASS

**Step 5: Commit**

```bash
git add openmetadata-service/src/main/java/org/openmetadata/service/security/SecurityUtil.java
git add openmetadata-service/src/test/java/org/openmetadata/service/security/SecurityUtilTest.java
git commit -m "feat(auth): add validateEmailDomain utility

Validate email domain against allowedEmailDomains list:
- Empty list allows all domains
- Case-insensitive comparison
- Clear error message for disallowed domains"
```

---

## Task 7: Add Admin Email Check Utility

**Files:**
- Modify: `openmetadata-service/src/main/java/org/openmetadata/service/util/UserUtil.java`
- Test: `openmetadata-service/src/test/java/org/openmetadata/service/util/UserUtilTest.java`

**Step 1: Write failing tests**

Add to `UserUtilTest.java`:

```java
@Test
void testIsAdminEmail_inList() {
  List<String> adminEmails = List.of("admin@company.com", "super@company.com");

  assertTrue(UserUtil.isAdminEmail("admin@company.com", adminEmails));
  assertTrue(UserUtil.isAdminEmail("super@company.com", adminEmails));
}

@Test
void testIsAdminEmail_notInList() {
  List<String> adminEmails = List.of("admin@company.com");

  assertFalse(UserUtil.isAdminEmail("user@company.com", adminEmails));
}

@Test
void testIsAdminEmail_caseInsensitive() {
  List<String> adminEmails = List.of("Admin@Company.COM");

  assertTrue(UserUtil.isAdminEmail("admin@company.com", adminEmails));
}

@Test
void testIsAdminEmail_emptyList() {
  List<String> adminEmails = List.of();

  assertFalse(UserUtil.isAdminEmail("admin@company.com", adminEmails));
}

@Test
void testIsAdminEmail_nullList() {
  assertFalse(UserUtil.isAdminEmail("admin@company.com", null));
}
```

**Step 2: Run tests to verify they fail**

Run: `mvn test -pl openmetadata-service -Dtest=UserUtilTest#testIsAdminEmail*`

Expected: FAIL

**Step 3: Implement isAdminEmail**

Add to `UserUtil.java`:

```java
/**
 * Check if email is in the admin emails list.
 *
 * @param email user's email address
 * @param adminEmails list of admin email addresses
 * @return true if email is an admin email
 */
public static boolean isAdminEmail(String email, List<String> adminEmails) {
  if (adminEmails == null || adminEmails.isEmpty()) {
    return false;
  }

  String normalizedEmail = email.toLowerCase();
  return adminEmails.stream()
      .anyMatch(adminEmail -> adminEmail.toLowerCase().equals(normalizedEmail));
}
```

**Step 4: Run tests to verify they pass**

Run: `mvn test -pl openmetadata-service -Dtest=UserUtilTest#testIsAdminEmail*`

Expected: PASS

**Step 5: Commit**

```bash
git add openmetadata-service/src/main/java/org/openmetadata/service/util/UserUtil.java
git add openmetadata-service/src/test/java/org/openmetadata/service/util/UserUtilTest.java
git commit -m "feat(auth): add isAdminEmail utility

Check if email is in adminEmails list:
- Case-insensitive comparison
- Handles null/empty list"
```

---

## Task 8: Add Deprecation Warning Logging

**Files:**
- Modify: `openmetadata-service/src/main/java/org/openmetadata/service/security/JwtFilter.java`
- Modify: `openmetadata-service/src/main/java/org/openmetadata/service/security/DefaultAuthorizer.java`

**Step 1: Add deprecation warnings to JwtFilter constructor**

In `JwtFilter.java`, update constructor (around line 111-135) to log warnings:

```java
private static final Logger LOG = LoggerFactory.getLogger(JwtFilter.class);

// In constructor, after existing initialization:
logDeprecationWarnings(authenticationConfiguration);

private void logDeprecationWarnings(AuthenticationConfiguration config) {
  if (config.getJwtPrincipalClaims() != null && !config.getJwtPrincipalClaims().isEmpty()) {
    LOG.warn("DEPRECATED: 'jwtPrincipalClaims' configuration is deprecated. "
        + "Use 'emailClaim' instead. This will be removed in a future version.");
  }

  if (config.getJwtPrincipalClaimsMapping() != null && !config.getJwtPrincipalClaimsMapping().isEmpty()) {
    LOG.warn("DEPRECATED: 'jwtPrincipalClaimsMapping' configuration is deprecated. "
        + "Use 'emailClaim' and 'displayNameClaim' instead. This will be removed in a future version.");
  }
}
```

**Step 2: Add deprecation warnings to DefaultAuthorizer**

Find `DefaultAuthorizer.java` and add similar warnings for authorizer config:

```java
private void logDeprecationWarnings(AuthorizerConfiguration config) {
  if (config.getAdminPrincipals() != null && !config.getAdminPrincipals().isEmpty()) {
    LOG.warn("DEPRECATED: 'adminPrincipals' configuration is deprecated. "
        + "Use 'adminEmails' instead. This will be removed in a future version.");
  }

  if (config.getPrincipalDomain() != null && !config.getPrincipalDomain().isEmpty()) {
    LOG.warn("DEPRECATED: 'principalDomain' configuration is deprecated. "
        + "Use 'botDomain' for bots and 'allowedEmailDomains' for domain restrictions. "
        + "This will be removed in a future version.");
  }
}
```

**Step 3: Commit**

```bash
git add openmetadata-service/src/main/java/org/openmetadata/service/security/JwtFilter.java
git add openmetadata-service/src/main/java/org/openmetadata/service/security/DefaultAuthorizer.java
git commit -m "feat(auth): add deprecation warnings for old config options

Log warnings at startup when deprecated configs are used:
- jwtPrincipalClaims -> use emailClaim
- jwtPrincipalClaimsMapping -> use emailClaim + displayNameClaim
- adminPrincipals -> use adminEmails
- principalDomain -> use botDomain + allowedEmailDomains"
```

---

## Task 9: Update JwtFilter for Email-First Resolution

**Files:**
- Modify: `openmetadata-service/src/main/java/org/openmetadata/service/security/JwtFilter.java`
- Test: `openmetadata-service/src/test/java/org/openmetadata/service/security/JwtFilterTest.java`

**Step 1: Update filter method to use new email-first flow**

In `JwtFilter.java`, update the `filter` method (lines 152-206) to:

1. Check if new `emailClaim` config is present
2. If yes, use new simplified flow
3. If no, fall back to legacy behavior for backward compatibility

```java
// In filter method, after JWT validation (around line 163):

String email;
String userName;
String displayName;

// Check for new simplified config
String emailClaimConfig = authenticationConfiguration.getEmailClaim();
if (emailClaimConfig != null && !emailClaimConfig.isEmpty()) {
  // New email-first flow
  email = SecurityUtil.extractEmailFromClaim(claims, emailClaimConfig);

  // Validate domain if configured
  List<String> allowedDomains = authorizerConfiguration.getAllowedEmailDomains();
  SecurityUtil.validateEmailDomain(email, allowedDomains);

  // Extract display name
  String displayNameClaimConfig = authenticationConfiguration.getDisplayNameClaim();
  displayName = SecurityUtil.extractDisplayNameFromClaim(claims, displayNameClaimConfig, email);

  // Username will be resolved when user is created/looked up
  userName = email.split("@")[0]; // Temporary, actual username from DB
} else {
  // Legacy flow (backward compatibility)
  userName = SecurityUtil.findUserNameFromClaims(jwtPrincipalClaimsMapping, jwtPrincipalClaimsOrder, claims);
  email = SecurityUtil.findEmailFromClaims(
      jwtPrincipalClaimsMapping, jwtPrincipalClaimsOrder, claims, defaultPrincipalClaim);
  displayName = null; // Legacy doesn't have this
}
```

**Step 2: Write tests for new flow**

Add to `JwtFilterTest.java`:

```java
@Test
void testFilter_emailFirstFlow_extractsEmailFromClaim() {
  // Setup config with emailClaim
  when(authConfig.getEmailClaim()).thenReturn("email");
  when(authConfig.getDisplayNameClaim()).thenReturn("name");

  // Setup JWT claims
  Map<String, Object> claims = Map.of(
      "email", "john.doe@company.com",
      "name", "John Doe"
  );

  // Execute filter
  // ... test implementation

  // Verify email extracted correctly
}

@Test
void testFilter_emailFirstFlow_failsOnMissingEmailClaim() {
  when(authConfig.getEmailClaim()).thenReturn("email");

  Map<String, Object> claims = Map.of("sub", "12345"); // No email claim

  // Should throw AuthenticationException
}

@Test
void testFilter_legacyFlow_whenEmailClaimNotConfigured() {
  when(authConfig.getEmailClaim()).thenReturn(null);

  // Should use legacy jwtPrincipalClaims flow
}
```

**Step 3: Run tests**

Run: `mvn test -pl openmetadata-service -Dtest=JwtFilterTest`

Expected: PASS

**Step 4: Commit**

```bash
git add openmetadata-service/src/main/java/org/openmetadata/service/security/JwtFilter.java
git add openmetadata-service/src/test/java/org/openmetadata/service/security/JwtFilterTest.java
git commit -m "feat(auth): update JwtFilter for email-first resolution

Add email-first authentication flow when emailClaim is configured:
- Extract email from specified claim
- Validate against allowedEmailDomains
- Extract display name from claim or email prefix
- Fall back to legacy flow for backward compatibility"
```

---

## Task 10: Update AuthenticationCodeFlowHandler for OIDC

**Files:**
- Modify: `openmetadata-service/src/main/java/org/openmetadata/service/security/AuthenticationCodeFlowHandler.java`

**Step 1: Update sendRedirectWithToken method**

In `AuthenticationCodeFlowHandler.java`, update `sendRedirectWithToken` (lines 744-770):

```java
// Replace lines 751-752 with:
String email;
String displayName;

String emailClaimConfig = authenticationConfiguration.getEmailClaim();
if (emailClaimConfig != null && !emailClaimConfig.isEmpty()) {
  // New email-first flow
  email = SecurityUtil.extractEmailFromClaim(claims, emailClaimConfig);

  List<String> allowedDomains = authorizerConfiguration.getAllowedEmailDomains();
  SecurityUtil.validateEmailDomain(email, allowedDomains);

  String displayNameClaimConfig = authenticationConfiguration.getDisplayNameClaim();
  displayName = SecurityUtil.extractDisplayNameFromClaim(claims, displayNameClaimConfig, email);
} else {
  // Legacy flow
  String userName = SecurityUtil.findUserNameFromClaims(...);
  email = SecurityUtil.findEmailFromClaims(...);
  displayName = null;
}
```

**Step 2: Update getOrCreateOidcUser method**

In `getOrCreateOidcUser` (lines 772-826), update to:
- Use email for user lookup
- Use `generateUsernameFromEmail` for new users
- Check `adminEmails` in addition to `adminPrincipals`
- Respect `enableSelfSignup` for user creation

```java
private User getOrCreateOidcUser(String email, String displayName, Map<String, Object> claims) {
  // Try to find existing user by email
  User user = userRepository.getByEmail(email);

  if (user != null) {
    // Update display name if changed
    if (displayName != null && !displayName.equals(user.getDisplayName())) {
      user.setDisplayName(displayName);
      userRepository.update(user);
    }
    return user;
  }

  // User doesn't exist - check if self-signup is enabled
  if (!authenticationConfiguration.getEnableSelfSignup()) {
    throw new AuthenticationException("User not registered. Contact administrator.");
  }

  // Create new user
  String username = UserUtil.generateUsernameFromEmail(email,
      name -> userRepository.existsByName(name));

  // Check if admin
  boolean isAdmin = UserUtil.isAdminEmail(email, authorizerConfiguration.getAdminEmails())
      || isAdminPrincipal(email.split("@")[0]); // Legacy fallback

  User newUser = new User()
      .withName(username)
      .withEmail(email)
      .withDisplayName(displayName)
      .withIsAdmin(isAdmin)
      .withIsBot(false);

  return userRepository.create(newUser);
}
```

**Step 3: Commit**

```bash
git add openmetadata-service/src/main/java/org/openmetadata/service/security/AuthenticationCodeFlowHandler.java
git commit -m "feat(auth): update OIDC handler for email-first flow

Update AuthenticationCodeFlowHandler to:
- Use emailClaim for email extraction
- Validate against allowedEmailDomains
- Generate unique username from email
- Check adminEmails for admin status
- Respect enableSelfSignup setting"
```

---

## Task 11: Update SamlAuthServletHandler for SAML

**Files:**
- Modify: `openmetadata-service/src/main/java/org/openmetadata/service/security/auth/SamlAuthServletHandler.java`

**Step 1: Update handleCallback method**

In `SamlAuthServletHandler.java`, update `handleCallback` (lines 132-164):

```java
// In handleCallback, after getting SAML response:
String email;
String displayName;

String emailClaimConfig = authenticationConfiguration.getEmailClaim();
if (emailClaimConfig != null && !emailClaimConfig.isEmpty()) {
  // New email-first flow - extract from SAML assertion
  email = extractAttributeFromAssertion(samlResponse, emailClaimConfig);
  if (email == null || email.isEmpty()) {
    throw new AuthenticationException(
        String.format("Authentication failed: email attribute '%s' not found in SAML assertion", emailClaimConfig));
  }
  email = email.toLowerCase();

  List<String> allowedDomains = authorizerConfiguration.getAllowedEmailDomains();
  SecurityUtil.validateEmailDomain(email, allowedDomains);

  String displayNameClaimConfig = authenticationConfiguration.getDisplayNameClaim();
  displayName = extractAttributeFromAssertion(samlResponse, displayNameClaimConfig);
  if (displayName == null || displayName.isEmpty()) {
    displayName = email.split("@")[0];
  }
} else {
  // Legacy flow using nameId
  String nameId = samlResponse.getNameId();
  // ... existing legacy logic
}
```

**Step 2: Update getOrCreateUser to match OIDC pattern**

Similar updates as Task 10 for user creation.

**Step 3: Commit**

```bash
git add openmetadata-service/src/main/java/org/openmetadata/service/security/auth/SamlAuthServletHandler.java
git commit -m "feat(auth): update SAML handler for email-first flow

Update SamlAuthServletHandler to:
- Use emailClaim for SAML attribute extraction
- Validate against allowedEmailDomains
- Generate unique username from email
- Check adminEmails for admin status"
```

---

## Task 12: Update LdapAuthenticator

**Files:**
- Modify: `openmetadata-service/src/main/java/org/openmetadata/service/security/auth/LdapAuthenticator.java`

**Step 1: Update getUserForLdap method**

In `LdapAuthenticator.java`, update `getUserForLdap` (lines 366-389):

```java
private User getUserForLdap(SearchResultEntry entry) {
  String emailAttribute = authenticationConfiguration.getEmailClaim();
  if (emailAttribute == null || emailAttribute.isEmpty()) {
    emailAttribute = "mail"; // LDAP default
  }

  String email = entry.getAttributeValue(emailAttribute);
  if (email == null || email.isEmpty()) {
    throw new AuthenticationException(
        String.format("LDAP user missing email attribute '%s'", emailAttribute));
  }
  email = email.toLowerCase();

  // Validate domain
  List<String> allowedDomains = authorizerConfiguration.getAllowedEmailDomains();
  SecurityUtil.validateEmailDomain(email, allowedDomains);

  // Get display name
  String displayNameAttribute = authenticationConfiguration.getDisplayNameClaim();
  if (displayNameAttribute == null || displayNameAttribute.isEmpty()) {
    displayNameAttribute = "displayName"; // LDAP default
  }
  String displayName = entry.getAttributeValue(displayNameAttribute);
  if (displayName == null || displayName.isEmpty()) {
    displayName = email.split("@")[0];
  }

  // Generate username
  String username = UserUtil.generateUsernameFromEmail(email,
      name -> userRepository.existsByName(name));

  // Check admin status
  boolean isAdmin = UserUtil.isAdminEmail(email, authorizerConfiguration.getAdminEmails());

  return new User()
      .withName(username)
      .withEmail(email)
      .withDisplayName(displayName)
      .withIsAdmin(isAdmin);
}
```

**Step 2: Commit**

```bash
git add openmetadata-service/src/main/java/org/openmetadata/service/security/auth/LdapAuthenticator.java
git commit -m "feat(auth): update LDAP authenticator for email-first flow

Update LdapAuthenticator to:
- Use emailClaim for LDAP attribute (default: 'mail')
- Use displayNameClaim (default: 'displayName')
- Validate against allowedEmailDomains
- Generate unique username from email
- Check adminEmails for admin status"
```

---

## Task 13: Update UserUtil for Bot Creation with botDomain

**Files:**
- Modify: `openmetadata-service/src/main/java/org/openmetadata/service/util/UserUtil.java`
- Test: `openmetadata-service/src/test/java/org/openmetadata/service/util/UserUtilTest.java`

**Step 1: Write failing tests**

Add to `UserUtilTest.java`:

```java
@Test
void testCreateBotEmail_withBotDomain() {
  String botEmail = UserUtil.createBotEmail("ingestion-bot", "bot.company.com");

  assertEquals("ingestion-bot@bot.company.com", botEmail);
}

@Test
void testCreateBotEmail_lowercases() {
  String botEmail = UserUtil.createBotEmail("Ingestion-Bot", "Bot.Company.COM");

  assertEquals("ingestion-bot@bot.company.com", botEmail);
}
```

**Step 2: Run tests to verify they fail**

Run: `mvn test -pl openmetadata-service -Dtest=UserUtilTest#testCreateBotEmail*`

Expected: FAIL

**Step 3: Implement createBotEmail**

Add to `UserUtil.java`:

```java
/**
 * Create email address for a system bot.
 *
 * @param botName name of the bot
 * @param botDomain domain for bot emails
 * @return bot email address
 */
public static String createBotEmail(String botName, String botDomain) {
  return String.format("%s@%s", botName.toLowerCase(), botDomain.toLowerCase());
}
```

**Step 4: Update addOrUpdateBotUser to use botDomain config**

In `addOrUpdateBotUser` method (lines 337-349), update to use `botDomain` from config:

```java
public static User addOrUpdateBotUser(String botName, AuthorizerConfiguration authConfig) {
  String botDomain = authConfig.getBotDomain();
  if (botDomain == null || botDomain.isEmpty()) {
    botDomain = "openmetadata.org"; // Default
  }

  String botEmail = createBotEmail(botName, botDomain);
  // ... rest of bot creation
}
```

**Step 5: Run tests**

Run: `mvn test -pl openmetadata-service -Dtest=UserUtilTest#testCreateBotEmail*`

Expected: PASS

**Step 6: Commit**

```bash
git add openmetadata-service/src/main/java/org/openmetadata/service/util/UserUtil.java
git add openmetadata-service/src/test/java/org/openmetadata/service/util/UserUtilTest.java
git commit -m "feat(auth): add createBotEmail utility using botDomain config

Create bot emails using configurable botDomain:
- Default: openmetadata.org
- Lowercases bot name and domain"
```

---

## Task 14: Update Admin User Creation with adminEmails

**Files:**
- Modify: `openmetadata-service/src/main/java/org/openmetadata/service/util/UserUtil.java`

**Step 1: Update createOrUpdateUser to support adminEmails**

In `createOrUpdateUser` method (lines 94-146), add support for email-based admin specification:

```java
public static void createOrUpdateAdminUsers(AuthorizerConfiguration authConfig, ...) {
  // Process new adminEmails config
  List<String> adminEmails = authConfig.getAdminEmails();
  if (adminEmails != null && !adminEmails.isEmpty()) {
    for (String email : adminEmails) {
      createOrUpdateAdminByEmail(email.toLowerCase(), ...);
    }
  }

  // Legacy: Process adminPrincipals for backward compatibility
  List<String> adminPrincipals = authConfig.getAdminPrincipals();
  if (adminPrincipals != null && !adminPrincipals.isEmpty()) {
    for (String principal : adminPrincipals) {
      // Legacy flow - construct email from principal + domain
      String domain = authConfig.getPrincipalDomain();
      if (domain == null) domain = "openmetadata.org";
      String email = principal + "@" + domain;
      createOrUpdateAdminByEmail(email.toLowerCase(), ...);
    }
  }
}

private static void createOrUpdateAdminByEmail(String email, ...) {
  // Look up user by email
  User user = userRepository.getByEmail(email);

  if (user != null) {
    // Update admin status if needed
    if (!user.getIsAdmin()) {
      user.setIsAdmin(true);
      userRepository.update(user);
    }
  } else {
    // Create new admin user
    String username = generateUsernameFromEmail(email, name -> userRepository.existsByName(name));
    User newUser = new User()
        .withName(username)
        .withEmail(email)
        .withDisplayName(email.split("@")[0])
        .withIsAdmin(true)
        .withIsBot(false);
    userRepository.create(newUser);
  }
}
```

**Step 2: Commit**

```bash
git add openmetadata-service/src/main/java/org/openmetadata/service/util/UserUtil.java
git commit -m "feat(auth): update admin user creation to use adminEmails

Support email-based admin user creation:
- Process adminEmails list (new config)
- Fall back to adminPrincipals for backward compatibility
- Create users with generated usernames from email"
```

---

## Task 15: Run Full Test Suite and Format Code

**Step 1: Format Java code**

Run: `mvn spotless:apply`

**Step 2: Run all modified tests**

Run: `mvn test -pl openmetadata-service -Dtest=SecurityUtilTest,UserUtilTest,JwtFilterTest`

Expected: All PASS

**Step 3: Run full service tests**

Run: `mvn test -pl openmetadata-service`

Expected: All PASS (or document any unrelated failures)

**Step 4: Commit any formatting changes**

```bash
git add -A
git commit -m "style: apply spotless formatting"
```

---

## Task 16: Update Configuration Documentation

**Files:**
- Modify: `conf/openmetadata.yaml` (example config)

**Step 1: Add example of new config options**

Add comments showing new simplified configuration:

```yaml
authenticationConfiguration:
  provider: ${AUTHENTICATION_PROVIDER:-basic}
  publicKeyUrls: ${AUTHENTICATION_PUBLIC_KEYS:[]}

  # New simplified email-first configuration (recommended)
  emailClaim: ${AUTHENTICATION_EMAIL_CLAIM:-email}
  displayNameClaim: ${AUTHENTICATION_DISPLAY_NAME_CLAIM:-name}

  # Deprecated - use emailClaim instead
  # jwtPrincipalClaims: [email,preferred_username,sub]
  # jwtPrincipalClaimsMapping: []

authorizerConfiguration:
  # New email-based admin configuration (recommended)
  adminEmails: ${AUTHORIZER_ADMIN_EMAILS:[]}
  allowedEmailDomains: ${AUTHORIZER_ALLOWED_EMAIL_DOMAINS:[]}
  botDomain: ${AUTHORIZER_BOT_DOMAIN:-openmetadata.org}

  # Deprecated - use adminEmails instead
  # adminPrincipals: [admin]
  # principalDomain: openmetadata.org
```

**Step 2: Commit**

```bash
git add conf/openmetadata.yaml
git commit -m "docs: update example config with new email-first options

Add examples of new simplified configuration:
- emailClaim, displayNameClaim
- adminEmails, allowedEmailDomains, botDomain
- Mark deprecated options with comments"
```

---

## Summary

This implementation plan provides:

1. **Configuration Changes** (Tasks 1-2): New schema with `emailClaim`, `displayNameClaim`, `adminEmails`, `allowedEmailDomains`, `botDomain`

2. **Utility Methods** (Tasks 3-7):
   - `extractEmailFromClaim` - email extraction with validation
   - `extractDisplayNameFromClaim` - display name with fallback
   - `generateUsernameFromEmail` - unique username generation
   - `validateEmailDomain` - domain restriction
   - `isAdminEmail` - admin check

3. **Deprecation Warnings** (Task 8): Logged at startup

4. **Provider Updates** (Tasks 9-12):
   - JwtFilter - JWT/OIDC tokens
   - AuthenticationCodeFlowHandler - OIDC flow
   - SamlAuthServletHandler - SAML assertions
   - LdapAuthenticator - LDAP attributes

5. **User Management** (Tasks 13-14): Bot and admin user creation

6. **Testing & Documentation** (Tasks 15-16): Full test coverage and config examples

---

Plan complete and saved to `docs/plans/2026-01-26-user-identity-simplification.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
