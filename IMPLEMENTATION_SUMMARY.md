# Implementation Summary: Department/Team Claim Mapping for SAML/JWT SSO

## Overview
This implementation adds support for automatically assigning users to OpenMetadata teams based on attributes from SAML assertions or JWT tokens during SSO login.

## Issue Reference
**Feature Request**: Adding Department Claim Mapping to Team via SAML / JWT Claim Mapping
- Mapping Azure AD's department attribute to the team field in OpenMetadata during SAML SSO login
- Automatically mapping department values to existing teams

## Changes Summary

### 1. Schema Definition
**File**: `openmetadata-spec/src/main/resources/json/schema/configuration/authenticationConfiguration.json`
- Added `jwtTeamClaimMapping` field (string, optional)
- Field accepts the name of the SAML attribute or JWT claim containing team/department information

### 2. JWT Filter Enhancement
**File**: `openmetadata-service/src/main/java/org/openmetadata/service/security/JwtFilter.java`
- Added `jwtTeamClaimMapping` field to store configuration
- Initialized in constructor from `AuthenticationConfiguration`
- Made accessible via getter for use in authentication flows

### 3. Security Utility Methods
**File**: `openmetadata-service/src/main/java/org/openmetadata/service/security/SecurityUtil.java`
- Added `findTeamFromClaims(String jwtTeamClaimMapping, Map<String, ?> claims)` method
- Extracts team value from JWT/SAML claims based on configured claim name
- Returns null if claim not present or empty

### 4. User Utility Enhancement
**File**: `openmetadata-service/src/main/java/org/openmetadata/service/util/UserUtil.java`
- Added `assignTeamFromClaim(User user, String teamName)` method
- Safely looks up team by name using Entity API
- Adds team to user's team list if found and not already assigned
- Logs warning if team doesn't exist, continues without failing
- Handles exceptions gracefully

### 5. SAML Authentication Handler
**File**: `openmetadata-service/src/main/java/org/openmetadata/service/security/saml/SamlAssertionConsumerServlet.java`
**Changes**:
- Extracts team claim mapping from security configuration
- Reads attribute from SAML response using `auth.getAttribute(teamClaimMapping)`
- Assigns team to user before creating/updating user record
- Works for both new user creation and existing user login

**Flow**:
```java
1. SAML response received
2. Extract username and email from SAML NameID
3. Get teamClaimMapping from configuration
4. Extract department/team attribute from SAML assertion
5. Fetch or create user
6. Assign team using UserUtil.assignTeamFromClaim()
7. Save user with team assignment
8. Generate JWT and redirect
```

### 6. OIDC Authentication Handler
**File**: `openmetadata-service/src/main/java/org/openmetadata/service/security/AuthenticationCodeFlowHandler.java`
**Changes**:
- Added `teamClaimMapping` field
- Initialized from authentication configuration
- Modified `sendRedirectWithToken()` to pass claims to `getOrCreateOidcUser()`
- Updated `getOrCreateOidcUser()` to extract and assign team from JWT claims
- Works for both new user creation and existing user login

**Flow**:
```java
1. OIDC callback received with JWT token
2. Extract claims from JWT
3. Get teamClaimMapping from configuration
4. Extract team from JWT claims using SecurityUtil.findTeamFromClaims()
5. Fetch or create user
6. Assign team using UserUtil.assignTeamFromClaim()
7. Save user with team assignment
8. Complete authentication flow
```

## Configuration

### YAML Configuration Example
```yaml
authenticationConfiguration:
  provider: saml  # or azure, okta, customOidc, etc.
  providerName: Azure AD
  clientId: your-client-id
  callbackUrl: https://your-domain.com/callback
  authority: https://your-authority-url
  jwtTeamClaimMapping: "department"  # New field
  # ... other configuration
```

### Environment Variable
```bash
export AUTHENTICATION_JWT_TEAM_CLAIM_MAPPING="department"
```

## Usage Examples

### Example 1: Azure AD Department (SAML)
**Configuration**:
```yaml
jwtTeamClaimMapping: "department"
```

**Azure AD Setup**:
1. Users have Department field set (e.g., "Engineering", "Sales")
2. Department is included in SAML assertion
3. Create teams in OpenMetadata with matching names

**Result**: User with department "Engineering" is automatically assigned to "Engineering" team

### Example 2: Azure AD Department (OIDC)
**Configuration**:
```yaml
jwtTeamClaimMapping: "department"
```

**Azure AD Token Configuration**:
1. Add "department" as optional claim in token configuration
2. Enable Microsoft Graph profile permission
3. Create teams in OpenMetadata with matching names

**Result**: User's department claim is read from JWT and user is assigned to matching team

### Example 3: Custom Attribute
**Configuration**:
```yaml
jwtTeamClaimMapping: "organizationalUnit"
```

**Result**: Reads custom "organizationalUnit" attribute and assigns to matching team

## Behavior Details

### Team Assignment Logic
1. **Claim Extraction**: Read value from configured SAML attribute or JWT claim
2. **Team Lookup**: Search for team with exact matching name (case-sensitive)
3. **Assignment**: Add team to user's team list if found and not already assigned
4. **Graceful Failure**: If team not found, log warning and continue authentication

### Error Handling
- Missing claim/attribute: No team assignment, authentication continues
- Team not found: Warning logged, authentication continues
- Empty claim value: No team assignment, authentication continues
- Multiple values: Only first value used (current limitation)

### Security Considerations
- Teams must pre-exist in OpenMetadata (no auto-creation)
- Team names must match exactly (case-sensitive)
- Only one claim/attribute supported per configuration
- Trusts IdP-provided attributes (ensure IdP is properly secured)

## Testing Recommendations

### Manual Testing
1. **Setup**:
   - Create teams in OpenMetadata matching your department/group names
   - Configure `jwtTeamClaimMapping` with appropriate attribute name
   - Ensure IdP includes the attribute in SAML/JWT responses

2. **Test Cases**:
   - New user login with valid department → should create user and assign team
   - Existing user login with valid department → should assign team if not already assigned
   - User login with non-existent department → should log warning, login succeeds without team
   - User login without department attribute → should login without team assignment

3. **Verification**:
   - Check OpenMetadata logs for team assignment messages
   - Verify user profile shows assigned team
   - Confirm user has team-based permissions

### Unit Testing
Key methods to test:
- `SecurityUtil.findTeamFromClaims()` - extracts correct claim value
- `UserUtil.assignTeamFromClaim()` - assigns team correctly, handles errors
- SAML servlet team extraction - properly reads SAML attributes
- OIDC handler team extraction - properly reads JWT claims

## Documentation

### User Documentation
1. **SAML SSO Configuration** (`samlSSOClientConfig.md`):
   - Field definition and purpose
   - Configuration examples
   - Usage notes and limitations

2. **Azure AD Configuration** (`azureSSOClientConfig.md`):
   - Azure AD specific guidance
   - Department attribute setup
   - Token configuration steps

3. **Example Guide** (`SAML_TEAM_MAPPING_EXAMPLE.md`):
   - Comprehensive configuration examples
   - Multiple provider examples (Azure AD, Okta, custom OIDC)
   - Troubleshooting guide
   - Security considerations

## Limitations

1. **Single Claim Only**: Only one claim/attribute can be configured
2. **First Value Only**: For multi-valued claims, only first value is used
3. **Exact Match Required**: Team names must match exactly (case-sensitive)
4. **No Auto-Creation**: Teams must be created in OpenMetadata before assignment
5. **No Dynamic Updates**: Team assignment happens at login, not continuously synced

## Future Enhancements

Potential improvements for future iterations:
- Support for multiple team assignments from array claims
- Case-insensitive team name matching option
- Auto-creation of teams from claim values
- Support for nested claim paths (e.g., "user.department")
- Removal of teams when claim value changes
- Support for claim value transformations/mapping

## Files Changed

### Backend (Java)
1. `openmetadata-spec/src/main/resources/json/schema/configuration/authenticationConfiguration.json`
2. `openmetadata-service/src/main/java/org/openmetadata/service/security/JwtFilter.java`
3. `openmetadata-service/src/main/java/org/openmetadata/service/security/SecurityUtil.java`
4. `openmetadata-service/src/main/java/org/openmetadata/service/security/saml/SamlAssertionConsumerServlet.java`
5. `openmetadata-service/src/main/java/org/openmetadata/service/security/AuthenticationCodeFlowHandler.java`
6. `openmetadata-service/src/main/java/org/openmetadata/service/util/UserUtil.java`

### Documentation
1. `openmetadata-ui/src/main/resources/ui/public/locales/en-US/SSO/samlSSOClientConfig.md`
2. `openmetadata-ui/src/main/resources/ui/public/locales/en-US/SSO/azureSSOClientConfig.md`
3. `SAML_TEAM_MAPPING_EXAMPLE.md` (new)

### Statistics
- 9 files changed
- 332 lines added
- 4 lines removed
- Key additions:
  - 1 new schema field
  - 2 new utility methods
  - 4 modified authentication handlers
  - 3 documentation files updated/created

## Backward Compatibility

✅ **Fully Backward Compatible**
- `jwtTeamClaimMapping` is optional (not in required fields)
- If not configured, behavior is unchanged
- Existing deployments continue to work without modification
- No database migrations required
- No breaking changes to APIs

## Deployment Notes

1. **Configuration Update**: Add `jwtTeamClaimMapping` to authentication configuration
2. **Team Preparation**: Create teams in OpenMetadata matching IdP attribute values
3. **IdP Configuration**: Ensure IdP includes the attribute in SAML/JWT responses
4. **Testing**: Test with a single user before rolling out to all users
5. **Monitoring**: Watch logs for team assignment warnings

## Contact and Support

For questions or issues:
- Review the example guide: `SAML_TEAM_MAPPING_EXAMPLE.md`
- Check OpenMetadata documentation
- Review logs for warning/error messages
- Contact OpenMetadata support team
