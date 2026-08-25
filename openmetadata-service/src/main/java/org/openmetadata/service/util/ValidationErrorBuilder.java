package org.openmetadata.service.util;

import org.openmetadata.schema.system.FieldError;

public class ValidationErrorBuilder {

  private ValidationErrorBuilder() {
    // Utility class
  }

  public static FieldError createFieldError(String fieldPath, String errorMessage) {
    return new FieldError().withField(fieldPath).withError(errorMessage);
  }

  public static class FieldPaths {
    // Authentication Configuration
    public static final String AUTH_PROVIDER = "authenticationConfiguration.provider";
    public static final String AUTH_CLIENT_TYPE = "authenticationConfiguration.clientType";
    public static final String AUTH_JWT_PRINCIPAL_CLAIMS =
        "authenticationConfiguration.jwtPrincipalClaims";
    public static final String AUTH_JWT_PRINCIPAL_CLAIMS_MAPPING =
        "authenticationConfiguration.jwtPrincipalClaimsMapping";
    public static final String AUTH_PUBLIC_KEY_URLS = "authenticationConfiguration.publicKeyUrls";
    public static final String AUTH_AUTHORITY = "authenticationConfiguration.authority";
    public static final String AUTH_CLIENT_ID = "authenticationConfiguration.clientId";
    public static final String AUTH_CALLBACK_URL = "authenticationConfiguration.callbackUrl";

    // OIDC Configuration
    public static final String OIDC_CLIENT_ID = "authenticationConfiguration.oidcConfiguration.id";
    public static final String OIDC_CLIENT_SECRET =
        "authenticationConfiguration.oidcConfiguration.secret";
    public static final String OIDC_DISCOVERY_URI =
        "authenticationConfiguration.oidcConfiguration.discoveryUri";
    public static final String OIDC_SERVER_URL =
        "authenticationConfiguration.oidcConfiguration.serverUrl";
    public static final String OIDC_SCOPE = "authenticationConfiguration.oidcConfiguration.scope";
    public static final String OIDC_CALLBACK_URL =
        "authenticationConfiguration.oidcConfiguration.callbackUrl";
    public static final String OIDC_TENANT = "authenticationConfiguration.oidcConfiguration.tenant";
    public static final String OIDC_PROMPT = "authenticationConfiguration.oidcConfiguration.prompt";

    // LDAP Configuration
    public static final String LDAP_HOST = "authenticationConfiguration.ldapConfiguration.host";
    public static final String LDAP_PORT = "authenticationConfiguration.ldapConfiguration.port";
    public static final String LDAP_DN_ADMIN_PRINCIPAL =
        "authenticationConfiguration.ldapConfiguration.dnAdminPrincipal";
    public static final String LDAP_DN_ADMIN_PASSWORD =
        "authenticationConfiguration.ldapConfiguration.dnAdminPassword";
    public static final String LDAP_USER_BASE_DN =
        "authenticationConfiguration.ldapConfiguration.userBaseDN";
    public static final String LDAP_MAIL_ATTRIBUTE =
        "authenticationConfiguration.ldapConfiguration.mailAttributeName";
    public static final String LDAP_MAX_POOL_SIZE =
        "authenticationConfiguration.ldapConfiguration.maxPoolSize";
    public static final String LDAP_SSL_ENABLED =
        "authenticationConfiguration.ldapConfiguration.sslEnabled";
    public static final String LDAP_TRUSTSTORE_PATH =
        "authenticationConfiguration.ldapConfiguration.truststorePath";
    public static final String LDAP_TRUSTSTORE_PASSWORD =
        "authenticationConfiguration.ldapConfiguration.truststorePassword";
    public static final String LDAP_AUTH_ROLES_MAPPING =
        "authenticationConfiguration.ldapConfiguration.authRolesMapping";
    public static final String LDAP_GROUP_BASE_DN =
        "authenticationConfiguration.ldapConfiguration.groupBaseDN";
    public static final String LDAP_GROUP_ATTRIBUTE_NAME =
        "authenticationConfiguration.ldapConfiguration.groupAttributeName";
    public static final String LDAP_GROUP_ATTRIBUTE_VALUE =
        "authenticationConfiguration.ldapConfiguration.groupAttributeValue";
    public static final String LDAP_GROUP_MEMBER_ATTRIBUTE_NAME =
        "authenticationConfiguration.ldapConfiguration.groupMemberAttributeName";

    // SAML Configuration
    public static final String SAML_DEBUG_MODE =
        "authenticationConfiguration.samlConfiguration.debugMode";
    public static final String SAML_IDP_ENTITY_ID =
        "authenticationConfiguration.samlConfiguration.idp.entityId";
    public static final String SAML_IDP_SSO_URL =
        "authenticationConfiguration.samlConfiguration.idp.ssoLoginUrl";
    public static final String SAML_IDP_CERT =
        "authenticationConfiguration.samlConfiguration.idp.idpX509Certificate";
    public static final String SAML_IDP_NAME_ID =
        "authenticationConfiguration.samlConfiguration.idp.nameId";
    public static final String SAML_SP_ENTITY_ID =
        "authenticationConfiguration.samlConfiguration.sp.entityId";
    public static final String SAML_SP_ACS_URL =
        "authenticationConfiguration.samlConfiguration.sp.acs";
    public static final String SAML_SP_CERT =
        "authenticationConfiguration.samlConfiguration.sp.spX509Certificate";
    public static final String SAML_SP_KEY =
        "authenticationConfiguration.samlConfiguration.sp.spPrivateKey";
    public static final String SAML_SP_CALLBACK =
        "authenticationConfiguration.samlConfiguration.sp.callback";
    public static final String SAML_SECURITY_AUTHN_SIGNED =
        "authenticationConfiguration.samlConfiguration.security.wantAuthnRequestsSigned";
    public static final String SAML_SECURITY_ASSERTIONS_SIGNED =
        "authenticationConfiguration.samlConfiguration.security.wantAssertionsSigned";
    public static final String SAML_SECURITY_ASSERTIONS_ENCRYPTED =
        "authenticationConfiguration.samlConfiguration.security.wantAssertionsEncrypted";
    public static final String SAML_SECURITY_NAME_ID_ENCRYPTED =
        "authenticationConfiguration.samlConfiguration.security.wantNameIdEncrypted";
    public static final String SAML_SECURITY_SIGNATURE_ALGO =
        "authenticationConfiguration.samlConfiguration.security.signatureAlgorithm";
    public static final String SAML_SECURITY_VALIDATE_SIGNATURE =
        "authenticationConfiguration.samlConfiguration.security.validateSignature";
    public static final String SAML_SECURITY_VALIDATE_RESPONSE_SIGNATURE =
        "authenticationConfiguration.samlConfiguration.security.validateResponseSignature";

    // Authorizer Configuration
    public static final String AUTHZ_PRINCIPAL_DOMAIN = "authorizerConfiguration.principalDomain";
    public static final String AUTHZ_ADMIN_PRINCIPALS = "authorizerConfiguration.adminPrincipals";
    public static final String AUTHZ_ALLOWED_REGISTRATION_DOMAINS =
        "authorizerConfiguration.allowedRegistrationDomains";
    public static final String AUTHZ_CONTAINER_REQUEST_FILTER =
        "authorizerConfiguration.containerRequestFilter";

    private FieldPaths() {
      // Constants class
    }
  }
}
