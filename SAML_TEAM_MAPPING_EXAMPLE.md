# SAML/JWT Team Claim Mapping Example

This document provides examples of how to configure automatic team assignment based on SAML/JWT claims.

## Overview

The `jwtTeamClaimMapping` configuration allows OpenMetadata to automatically assign users to teams based on attributes from their SAML assertions or JWT tokens during login. This is particularly useful for:

- Azure AD's `department` attribute
- SAML group memberships
- Custom organizational attributes
- Job titles or roles

## How It Works

1. **Claim Extraction**: When a user logs in via SAML/JWT SSO, OpenMetadata extracts the value from the configured claim/attribute
2. **Team Matching**: The extracted value is matched against existing team names in OpenMetadata
3. **Automatic Assignment**: If a matching team is found, the user is automatically assigned to that team
4. **Graceful Handling**: If no matching team is found, a warning is logged but login proceeds normally

## Configuration Examples

### Example 1: Azure AD Department Attribute (SAML)

Configure OpenMetadata to use Azure AD's department attribute:

```yaml
authenticationConfiguration:
  provider: saml
  providerName: Azure AD
  clientId: your-client-id
  callbackUrl: https://your-domain.com/api/v1/saml/acs
  authority: https://your-domain.com/auth/saml
  jwtTeamClaimMapping: "department"  # Azure AD department attribute
  samlConfiguration:
    idp:
      entityId: https://sts.windows.net/your-tenant-id/
      ssoLoginUrl: https://login.microsoftonline.com/your-tenant-id/saml2
      # ... other SAML settings
```

**Azure AD Setup:**
1. In Azure AD, ensure users have their "Department" field populated (e.g., "Engineering", "Sales")
2. Configure Azure AD to include the department attribute in SAML assertions
3. Create matching teams in OpenMetadata with the same names (e.g., "Engineering", "Sales")

### Example 2: Azure AD with OIDC/JWT

For Azure AD using OAuth2/OIDC instead of SAML:

```yaml
authenticationConfiguration:
  provider: azure
  providerName: Azure AD
  clientType: confidential
  clientId: your-application-id
  callbackUrl: https://your-domain.com/callback
  authority: https://login.microsoftonline.com/your-tenant-id
  jwtTeamClaimMapping: "department"  # JWT claim name
  oidcConfiguration:
    # ... OIDC settings
```

**Azure AD Token Configuration:**
1. Go to Azure AD → App registrations → Your app → Token configuration
2. Add optional claims → Select "ID token"
3. Add "department" claim
4. Save configuration

### Example 3: Custom OIDC Provider with Group Attribute

```yaml
authenticationConfiguration:
  provider: customOidc
  providerName: Custom OIDC
  clientId: your-client-id
  callbackUrl: https://your-domain.com/callback
  authority: https://your-oidc-provider.com
  jwtTeamClaimMapping: "groups"  # Use groups claim
  oidcConfiguration:
    # ... OIDC settings
```

**Note**: When using "groups", only the first group value is used for team assignment.

### Example 4: Okta with Custom Attribute

```yaml
authenticationConfiguration:
  provider: okta
  providerName: Okta SSO
  clientId: your-okta-client-id
  callbackUrl: https://your-domain.com/callback
  authority: https://your-domain.okta.com
  jwtTeamClaimMapping: "organizationalUnit"  # Custom Okta attribute
  oidcConfiguration:
    # ... OKTA OIDC settings
```

## Environment Variable Configuration

You can also configure this using environment variables:

```bash
# Set the team claim mapping
export AUTHENTICATION_JWT_TEAM_CLAIM_MAPPING="department"

# Other authentication settings
export AUTHENTICATION_PROVIDER="saml"
export AUTHENTICATION_CLIENT_ID="your-client-id"
# ... other variables
```

## OpenMetadata Team Setup

**Important**: Teams must already exist in OpenMetadata before automatic assignment works.

### Creating Teams via UI:
1. Navigate to Settings → Teams
2. Create teams with names that match your SAML/JWT claim values
3. Example: If Azure AD department is "Engineering", create a team named "Engineering"

### Creating Teams via API:
```bash
curl -X POST "https://your-openmetadata-instance.com/api/v1/teams" \
  -H "Authorization: Bearer $OM_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Engineering",
    "displayName": "Engineering Team",
    "description": "Engineering department team"
  }'
```

## Troubleshooting

### User Not Assigned to Team

**Possible Causes:**
1. **Team doesn't exist**: Create the team in OpenMetadata first
2. **Name mismatch**: Team names are case-sensitive. Ensure exact match
3. **Claim not present**: Verify the SAML/JWT token contains the configured claim
4. **Claim value empty**: Check that users have the attribute populated in your IdP

**Debugging:**
- Check OpenMetadata logs for warnings like: `Team 'XYZ' from claim mapping not found`
- Enable debug logging for SAML: `samlConfiguration.debugMode: true`

### Multiple Values in Claim

Currently, only the first value from the claim is used for team assignment. If your claim contains multiple values (e.g., multiple groups), only the first one will be used to assign the team.

### Team Name Contains Special Characters

If your department/organizational unit names contain special characters or spaces, ensure:
1. The team name in OpenMetadata exactly matches (including spaces and special characters)
2. The SAML/JWT claim value exactly matches

## Security Considerations

1. **Trust Boundary**: This feature trusts the IdP-provided attributes. Ensure your IdP is properly configured
2. **Team Permissions**: Assigned teams grant access based on team roles. Review team permissions carefully
3. **Audit Logging**: User team assignments are logged in OpenMetadata audit logs

## Limitations

- Only one claim/attribute can be configured for team mapping
- Only the first value from multi-valued claims is used
- Teams must pre-exist in OpenMetadata
- Team names must match exactly (case-sensitive)
- The feature does not create teams automatically

## Additional Resources

- [SAML SSO Configuration](./openmetadata-ui/src/main/resources/ui/public/locales/en-US/SSO/samlSSOClientConfig.md)
- [Azure AD SSO Configuration](./openmetadata-ui/src/main/resources/ui/public/locales/en-US/SSO/azureSSOClientConfig.md)
- [OpenMetadata Teams Documentation](https://docs.open-metadata.org/v1.6.x/how-to-guides/admin-guide/teams-and-users)
