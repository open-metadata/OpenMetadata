---
title: LDAP Authentication Configuration | OpenMetadata
description: Configure LDAP Authentication for OpenMetadata with complete field reference
slug: /main-concepts/metadata-standard/schemas/security/client/ldap-auth
---

# LDAP Authentication Configuration

LDAP authentication enables users to log in with their LDAP directory credentials (Active Directory, OpenLDAP, etc.).

## <span data-id="clientId">Client ID</span>

- **Definition:** Client identifier for the LDAP authentication configuration.
- **Example:** ldap-client-123
- **Why it matters:** Used to identify this specific LDAP configuration.
- **Note:** Optional for LDAP, mainly used for tracking and configuration management

## <span data-id="callbackUrl">Callback URL</span>

- **Definition:** URL where users are redirected after LDAP authentication.
- **Example:** https://yourapp.company.com/callback
- **Why it matters:** Defines where users land after successful LDAP authentication.
- **Note:** Usually your OpenMetadata application URL

## <span data-id="authority">Authority</span>

- **Definition:** Authentication authority URL for the LDAP provider.
- **Example:** https://yourapp.company.com/auth/ldap
- **Why it matters:** Specifies the authentication endpoint for LDAP.
- **Note:** Used by the authentication system to route LDAP requests

## <span data-id="enableSelfSignup">Enable Self Signup</span>

- **Definition:** Allows users to automatically create accounts on first LDAP login.
- **Options:** Enabled | Disabled
- **Example:** Enabled
- **Why it matters:** Controls whether new LDAP users can join automatically or need manual approval.
- **Note:** Disable for stricter control over user access

## <span data-id="host">LDAP Host</span>

- **Definition:** LDAP server address without scheme.
- **Example:** ldap.company.com or 192.168.1.100
- **Why it matters:** This is the server OpenMetadata will connect to for authentication.
- **Note:**
  - Don't include protocol (ldap:// or ldaps://)
  - Can be hostname or IP address

## <span data-id="port">LDAP Port</span>

- **Definition:** Port number for LDAP server connection.
- **Example:** 389 (standard LDAP) or 636 (LDAPS)
- **Why it matters:** Must match your LDAP server's configured port.
- **Note:**
  - Standard LDAP: 389
  - LDAPS (secure): 636
  - Custom ports may be used

## <span data-id="maxPoolSize">Max Pool Size</span>

- **Definition:** Maximum number of connections to maintain in the LDAP connection pool.
- **Default:** 3
- **Example:** 5
- **Why it matters:** Affects performance and resource usage.
- **Note:** Higher values support more concurrent users but use more resources

## <span data-id="isFullDn">Full DN Required</span>

- **Definition:** Whether users must provide their full Distinguished Name to login.
- **Default:** false
- **Example:** false
- **Why it matters:** Affects user experience - full DN login is more complex.
- **Note:**
  - false: Users can login with username only
  - true: Users must provide full DN (e.g., cn=john,ou=users,dc=company,dc=com)

## <span data-id="dnAdminPrincipal">Admin Principal DN</span>

- **Definition:** Distinguished Name of admin user with search capabilities.
- **Example:** cn=admin,ou=system,dc=company,dc=com
- **Why it matters:** OpenMetadata uses this account to search for and authenticate users.
- **Note:** This user needs read access to user and group entries

## <span data-id="dnAdminPassword">Admin Password</span>

- **Definition:** Password for the LDAP admin user.
- **Example:** adminPassword123
- **Why it matters:** Required for OpenMetadata to authenticate as the admin user.
- **Note:** Store securely and use a dedicated service account

## <span data-id="sslEnabled">SSL Enabled</span>

- **Definition:** Whether to use LDAPS (secure LDAP) connection.
- **Default:** false
- **Example:** true
- **Why it matters:** Encrypts communication between OpenMetadata and LDAP server.
- **Note:**
  - true: Use LDAPS (typically port 636)
  - false: Use plain LDAP (typically port 389)

## <span data-id="userBaseDN">User Base DN</span>

- **Definition:** Base Distinguished Name where user accounts are located.
- **Example:** ou=users,dc=company,dc=com
- **Why it matters:** Tells OpenMetadata where to search for user accounts.
- **Note:** Should contain all users who need access to OpenMetadata

## <span data-id="groupBaseDN">Group Base DN</span>

- **Definition:** Base Distinguished Name where group objects are located.
- **Example:** ou=groups,dc=company,dc=com
- **Why it matters:** Used for group-based authorization and role mapping.
- **Note:** Optional if not using LDAP groups for authorization

## <span data-id="roleAdminName">Admin Role Name</span>

- **Definition:** LDAP group name that should have admin privileges.
- **Example:** OpenMetadata-Admins
- **Why it matters:** Members of this group get admin access to OpenMetadata.
- **Note:** Must be an existing LDAP group

## <span data-id="allAttributeName">All Attribute Name</span>

- **Definition:** LDAP attribute that contains all user attributes.
- **Example:** \* or memberOf
- **Why it matters:** Used to retrieve comprehensive user information.
- **Note:** Use "\*" to retrieve all attributes

## <span data-id="mailAttributeName">Email Attribute Name</span>

- **Definition:** LDAP attribute that contains user email addresses.
- **Example:** mail or email
- **Why it matters:** OpenMetadata uses email as the primary user identifier.
- **Note:** Common values: mail, email, userPrincipalName

## <span data-id="usernameAttributeName">Username Attribute Name</span>

- **Definition:** LDAP attribute that contains the username.
- **Example:** sAMAccountName or uid
- **Why it matters:** Specifies which attribute users enter as their username.
- **Note:**
  - Active Directory: sAMAccountName or userPrincipalName
  - OpenLDAP: uid or cn

## <span data-id="groupAttributeName">Group Attribute Name</span>

- **Definition:** LDAP attribute that defines group membership.
- **Example:** memberOf or member
- **Why it matters:** Used to determine user's group memberships.
- **Note:**
  - memberOf: Groups the user belongs to
  - member: Users in the group

## <span data-id="groupAttributeValue">Group Attribute Value</span>

- **Definition:** Value format for group attribute matching.
- **Example:** cn or dn
- **Why it matters:** Determines how group membership is evaluated.
- **Note:** Depends on your LDAP schema structure

## <span data-id="groupMemberAttributeName">Group Member Attribute Name</span>

- **Definition:** Attribute in group objects that lists members.
- **Example:** member or uniqueMember
- **Why it matters:** Used when querying group membership from group objects.
- **Note:** Common values: member, uniqueMember, memberUid

## <span data-id="authRolesMapping">Auth Roles Mapping</span>

- **Definition:** JSON mapping between LDAP groups and OpenMetadata roles.
- **Example:** {"LDAP-Admins": "Admin", "LDAP-Users": "User"}
- **Why it matters:** Automatically assigns OpenMetadata roles based on LDAP group membership.
- **Note:** Use JSON format with LDAP group names as keys

## <span data-id="authReassignRoles">Auth Reassign Roles</span>

- **Definition:** Roles that should be reassigned every time user logs in.
- **Example:** ["Admin", "DataConsumer"]
- **Why it matters:** Ensures role assignments stay synchronized with LDAP.
- **Note:** Leave empty to only assign roles on first login

## <span data-id="truststoreFormat">Truststore Format</span>

- **Definition:** Format of truststore for SSL/TLS connections.
- **Example:** PKCS12 or JKS
- **Why it matters:** Required when using SSL and custom certificates.
- **Note:** Only needed if using custom SSL certificates

## <span data-id="trustStoreConfig">Trust Store Configuration</span>

- **Definition:** SSL truststore configuration for secure LDAP connections.
- **Why it matters:** Required for LDAPS connections with custom certificates.
- **Note:** Contains certificate validation settings and truststore details

## <span data-id="truststoreConfigType">Trust Store Configuration Type</span>

- **Definition:** Type of SSL truststore configuration for secure LDAP connections.
- **Options:** TrustAll | JVMDefault | HostName | CustomTrustStore
- **Example:** CustomTrustStore
- **Why it matters:** Determines how SSL certificates are validated.
- **Note:**
  - **TrustAll:** Accept all certificates (unsafe for production)
  - **JVMDefault:** Use Java's default certificate store
  - **HostName:** Verify hostname matching
  - **CustomTrustStore:** Use custom certificate store

### Trust Store Types:

#### <span data-id="customTrustManagerConfig">Custom Trust Manager</span>

- **Definition:** Custom certificate validation configuration.
- **Use case:** When using self-signed or internal CA certificates.

#### <span data-id="hostNameConfig">Hostname Verification</span>

- **Definition:** Hostname verification settings for SSL connections.
- **Use case:** When certificate hostname doesn't match LDAP server hostname.

#### <span data-id="jvmDefaultConfig">JVM Default Trust Store</span>

- **Definition:** Use Java's default certificate trust store.
- **Use case:** When LDAP server uses publicly trusted certificates.

#### <span data-id="trustAllConfig">Trust All Certificates</span>

- **Definition:** Accept all certificates without validation.
- **Use case:** Development/testing only - NOT recommended for production.
- **Security Warning:** This bypasses all SSL security checks.

### Additional Trust Store Configuration Fields

#### <span data-id="verifyHostname">Verify Hostname</span>

- **Definition:** Whether to verify the hostname in the certificate matches the LDAP server hostname.
- **Default:** false
- **Example:** true
- **Why it matters:** Prevents man-in-the-middle attacks by ensuring certificate hostname matches.
- **Note:** Enable for production security

#### <span data-id="examineValidityDates">Examine Validity Dates</span>

- **Definition:** Check if certificates are within their valid date range.
- **Default:** false
- **Example:** true
- **Why it matters:** Prevents using expired or not-yet-valid certificates.
- **Note:** Should be enabled in production

#### <span data-id="trustStoreFilePath">Trust Store File Path</span>

- **Definition:** Path to the Java truststore file containing trusted CA certificates.
- **Example:** /path/to/truststore.jks
- **Why it matters:** Specifies which certificates are trusted for SSL connections.
- **Note:** Required when using custom trust manager

#### <span data-id="trustStoreFilePassword">Trust Store File Password</span>

- **Definition:** Password to access the truststore file.
- **Example:** truststorePassword123
- **Why it matters:** Required to read certificates from the truststore.
- **Note:** Store securely and use strong passwords

#### <span data-id="trustStoreFileFormat">Trust Store File Format</span>

- **Definition:** Format of the truststore file.
- **Example:** JKS or PKCS12
- **Why it matters:** Tells the system how to read the truststore file.
- **Note:** JKS is the traditional Java format, PKCS12 is the modern standard

#### <span data-id="allowWildCards">Allow Wildcards</span>

- **Definition:** Whether to accept wildcard certificates (\*.company.com).
- **Default:** false
- **Example:** true
- **Why it matters:** Controls acceptance of wildcard SSL certificates.
- **Note:** Enable if your LDAP server uses wildcard certificates

#### <span data-id="acceptableHostNames">Acceptable Host Names</span>

- **Definition:** List of hostnames that are acceptable for certificate validation.
- **Example:** ["ldap.company.com", "ldap-backup.company.com"]
- **Why it matters:** Defines which hostnames are trusted for connections.
- **Note:** Add all valid LDAP server hostnames

## <span data-id="publicKeyUrls">Public Key URLs</span>

- **Definition:** List of URLs where public keys are published for token verification.
- **Example:** ["https://yourapp.company.com/.well-known/jwks.json"]
- **Why it matters:** Used to verify JWT token signatures if LDAP is configured with token-based authentication.
- **Note:** Usually auto-discovered, rarely needs manual configuration for pure LDAP

## <span data-id="jwtPrincipalClaims">JWT Principal Claims</span>

- **Definition:** JWT claims used to identify the user principal when LDAP is combined with JWT tokens.
- **Example:** ["preferred_username", "email", "sub"]
- **Why it matters:** Determines which claim from JWT tokens identifies the LDAP user.
- **Note:** Only applicable when LDAP authentication generates JWT tokens

## <span data-id="jwtPrincipalClaimsMapping">JWT Principal Claims Mapping</span>

- **Definition:** Maps JWT claims to OpenMetadata user attributes for LDAP users.
- **Example:** ["email:mail", "name:displayName", "firstName:givenName"]
- **Why it matters:** Controls how LDAP user information maps to OpenMetadata user profiles.
- **Note:** Format: "openmetadata_field:ldap_attribute" or "openmetadata_field:jwt_claim"

## <span data-id="tokenValidationAlgorithm">Token Validation Algorithm</span>

- **Definition:** Algorithm used to validate JWT token signatures when LDAP uses token-based authentication.
- **Options:** RS256 | RS384 | RS512
- **Default:** RS256
- **Example:** RS256
- **Why it matters:** Must match the algorithm used to sign tokens in hybrid LDAP+JWT setups.
- **Note:** Only relevant when LDAP authentication generates or validates JWT tokens
