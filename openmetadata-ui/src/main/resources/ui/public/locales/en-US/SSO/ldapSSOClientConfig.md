---
title: LDAP Authentication Configuration | OpenMetadata
description: Configure LDAP Authentication for OpenMetadata with complete field reference
slug: /main-concepts/metadata-standard/schemas/security/client/ldap-auth
---

LDAP authentication enables users to log in with their LDAP directory credentials (Active Directory, OpenLDAP, etc.).

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

- **Definition:** Special marker used in role mapping to grant admin privileges instead of regular roles.
- **Example:** Admin
- **Why it matters:** When this value appears in role mapping, users get admin access instead of the specified role being created.
- **Note:**
  - This is NOT an LDAP group name
  - It's a special string used in the Auth Roles Mapping to indicate admin access
  - Example: Map `cn=admins,ou=groups,dc=company,dc=com` → `["Admin"]` to grant admin privileges

## <span data-id="allAttributeName">All Attribute Name</span>

- **Definition:** Special wildcard character to retrieve all attributes from LDAP group objects.
- **Default:** \*
- **Why it matters:** When searching for user's groups, this determines which attributes are returned.
- **Note:**
  - Always use "\*" (asterisk) to retrieve all attributes
  - This is used internally when querying groups - you rarely need to change this

## <span data-id="mailAttributeName">Email Attribute Name</span>

- **Definition:** LDAP attribute that contains user email addresses.
- **Example:** mail
- **Why it matters:** OpenMetadata searches LDAP for users by email and uses this attribute as the primary identifier.
- **Critical:**
  - This is the most important LDAP field - if wrong, authentication will fail
  - The email address determines the OpenMetadata username
  - Username is automatically derived as the part before @ (e.g., john.doe@company.com → username: john.doe)
  - **The LDAP CN or UID attribute is NOT used** - only the email matters
- **Common values:**
  - Active Directory: `mail`, `userPrincipalName`
  - OpenLDAP: `mail`, `email`
- **How to find in phpLDAPadmin:** Open a user object and look for the attribute containing their email address
- **Validation:** OpenMetadata verifies this attribute exists on actual users before saving

## <span data-id="groupAttributeName">Group Attribute Name</span>

- **Definition:** Attribute name used to identify and filter group objects in LDAP.
- **Example:** objectClass
- **Why it matters:** Used together with Group Attribute Value to find groups in the Group Base DN.
- **How it's used:** Creates LDAP filter: `(groupAttributeName=groupAttributeValue)`
- **Common usage:**
  - `objectClass` with value `groupOfNames` → finds all groupOfNames objects
  - `objectClass` with value `groupOfUniqueNames` → finds all groupOfUniqueNames objects
- **How to find in phpLDAPadmin:**
  1. Open a group object (e.g., `cn=users,ou=groups,dc=company,dc=com`)
  2. Look for `objectClass` attribute
  3. Use `objectClass` as the attribute name
  4. Use one of its values (e.g., `groupOfNames`) as the attribute value
- **Validation:** OpenMetadata verifies groups can be found with this filter

## <span data-id="groupAttributeValue">Group Attribute Value</span>

- **Definition:** Value for the group attribute to identify group objects.
- **Example:** groupOfNames
- **Why it matters:** Specifies which type of group objects to search for.
- **How it's used:** Creates LDAP filter: `(groupAttributeName=groupAttributeValue)`
  - Example: `(objectClass=groupOfNames)` finds all groupOfNames objects
- **Common values:**
  - `groupOfNames` - standard LDAP group type
  - `groupOfUniqueNames` - LDAP group with unique members
  - `posixGroup` - Unix/Linux style group
- **How to find in phpLDAPadmin:**
  1. Open a group object
  2. Find the `objectClass` attribute
  3. Use one of the objectClass values here (e.g., `groupOfNames`)
- **Validation:** OpenMetadata tests that groups exist with this combination

## <span data-id="groupMemberAttributeName">Group Member Attribute Name</span>

- **Definition:** Attribute in group objects that lists the members of that group.
- **Example:** member
- **Why it matters:** OpenMetadata checks if a user is a member of a group by looking for the user's DN in this attribute.
- **How it's used:** Creates filter: `(groupMemberAttributeName=userDN)` to find which groups contain the user
- **Common values by group type:**
  - `groupOfNames` → use `member`
  - `groupOfUniqueNames` → use `uniqueMember`
  - `posixGroup` → use `memberUid` (contains usernames, not full DNs)
- **How to find in phpLDAPadmin:**
  1. Open a group object
  2. Look for attributes containing user DNs or usernames
  3. The attribute name is what you need (e.g., `member`, `uniqueMember`)
  4. Example: `member: cn=john,ou=users,dc=company,dc=com` → use `member`
- **Validation:** OpenMetadata checks this attribute exists on actual group objects

## <span data-id="authRolesMapping">Auth Roles Mapping</span>

- **Definition:** Mapping between LDAP groups and OpenMetadata roles.
- **Example:** Map "cn=admins,ou=groups,dc=company,dc=com" to "Admin" role
- **Why it matters:** Automatically assigns OpenMetadata roles based on LDAP group membership.
- **Note:**
  - Use full LDAP Group Distinguished Names (DN) as keys
  - Map to existing OpenMetadata role names
  - Users in mapped LDAP groups will automatically receive the corresponding roles
  - Validation ensures all mapped roles exist in OpenMetadata

## <span data-id="authReassignRoles">Auth Reassign Roles</span>

- **Definition:** Roles that should be reassigned every time user logs in.
- **Example:** ["Admin", "DataConsumer"]
- **Why it matters:** Ensures role assignments stay synchronized with LDAP.
- **Note:** Leave empty to only assign roles on first login

---

## Authorizer Configuration

The following settings control authorization and access control across OpenMetadata. These settings apply globally to all authentication providers.

### <span data-id="adminPrincipals">Admin Principals</span>

- **Definition:** List of user principals who will have admin access to OpenMetadata.
- **Example:** ["john.doe", "jane.admin", "admin"]
- **Why it matters:** These users will have full administrative privileges in OpenMetadata.
- **Note:**
  - Use usernames (NOT full email addresses) - these are derived from the email prefix (part before @)
  - At least one admin principal is required
  - **Critical:** If a user's email is `john.doe@company.com`, their username will be `john.doe`
  - The username is NOT derived from LDAP CN or UID attributes - only from the email address

### <span data-id="principalDomain">Principal Domain</span>

- **Definition:** Default domain for user principals.
- **Example:** company.com
- **Why it matters:** Used to construct full user principals when only username is provided.
- **Note:** Typically your organization's domain

### <span data-id="enforcePrincipalDomain">Enforce Principal Domain</span>

- **Definition:** Whether to enforce that all users belong to the principal domain.
- **Default:** false
- **Example:** true
- **Why it matters:** Adds an extra layer of security by restricting access to users from specific domains.
- **Note:** When enabled, only users from the configured principal domain can access OpenMetadata

### <span data-id="allowedDomains">Allowed Domains</span>

- **Definition:** List of email domains that are permitted to access OpenMetadata.
- **Example:** ["company.com", "partner.com", "contractor-company.com"]
- **Why it matters:** Provides fine-grained control over which email domains can authenticate via LDAP.
- **Note:**
  - Works in conjunction with `enforcePrincipalDomain`
  - When `enforcePrincipalDomain` is enabled, only users with email addresses from these domains can access OpenMetadata
  - Leave empty or use single `principalDomain` if you only have one domain
  - Use this field for multi-domain organizations (e.g., company.com + partner.com)

---

## Advanced Configuration

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
