package org.openmetadata.catalog.validators;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import javax.validation.ConstraintValidator;
import javax.validation.ConstraintValidatorContext;
import org.openmetadata.catalog.airflow.AirflowConfiguration;
import org.openmetadata.catalog.airflow.AuthConfiguration;
import org.openmetadata.catalog.security.client.Auth0SSOClientConfig;
import org.openmetadata.catalog.security.client.AzureSSOClientConfig;
import org.openmetadata.catalog.security.client.CustomOIDCSSOClientConfig;
import org.openmetadata.catalog.security.client.GoogleSSOClientConfig;
import org.openmetadata.catalog.security.client.OktaSSOClientConfig;
import org.openmetadata.catalog.security.client.OpenMetadataJWTClientConfig;
import org.openmetadata.catalog.services.connections.metadata.OpenMetadataServerConnection;

public class AirflowConfigValidationImpl implements ConstraintValidator<AirflowConfigValidation, AirflowConfiguration> {
  public static final String CLIENT_ID = "clientId";
  public static final String DOMAIN = "domain";
  public static final String EMAIL = "email";
  public static final String SCOPES = "scopes";
  public static final String AUTHORITY = "authority";
  public static final String CLIENT_SECRET = "clientSecret";
  public static final String SECRET_KEY = "secretKey";
  public static final String JWT_TOKEN = "jwtToken";

  @Override
  public boolean isValid(AirflowConfiguration configuration, ConstraintValidatorContext context) {
    OpenMetadataServerConnection.AuthProvider authProvider =
        OpenMetadataServerConnection.AuthProvider.fromValue(configuration.getAuthProvider());
    AuthConfiguration authConfig = configuration.getAuthConfig();
    context.disableDefaultConstraintViolation();
    StringBuilder message = new StringBuilder();
    if (authProvider != OpenMetadataServerConnection.AuthProvider.NO_AUTH && authConfig == null) {
      message.append(String.format("\n%s SSO client config requires authConfig section", authProvider));
      context.buildConstraintViolationWithTemplate(message.toString()).addConstraintViolation();
      return false;
    }
    switch (authProvider) {
      case GOOGLE:
        GoogleSSOClientConfig googleSSOClientConfig = authConfig.getGoogle();
        checkRequiredField(SECRET_KEY, googleSSOClientConfig.getSecretKey(), authProvider, message);
        break;
      case AUTH_0:
        Auth0SSOClientConfig auth0SSOClientConfig = authConfig.getAuth0();
        checkRequiredField(CLIENT_ID, auth0SSOClientConfig.getClientId(), authProvider, message);
        checkRequiredField(SECRET_KEY, auth0SSOClientConfig.getSecretKey(), authProvider, message);
        checkRequiredField(DOMAIN, auth0SSOClientConfig.getDomain(), authProvider, message);
        break;
      case OKTA:
        OktaSSOClientConfig oktaSSOClientConfig = authConfig.getOkta();
        checkRequiredField(CLIENT_ID, oktaSSOClientConfig.getClientId(), authProvider, message);
        checkRequiredField("privateKey", oktaSSOClientConfig.getPrivateKey(), authProvider, message);
        checkRequiredField(EMAIL, oktaSSOClientConfig.getEmail(), authProvider, message);
        checkRequiredField("orgUrl", oktaSSOClientConfig.getOrgURL(), authProvider, message);
        break;
      case AZURE:
        AzureSSOClientConfig azureSSOClientConfig = authConfig.getAzure();
        checkRequiredField(CLIENT_ID, azureSSOClientConfig.getClientId(), authProvider, message);
        checkRequiredField(CLIENT_SECRET, azureSSOClientConfig.getClientSecret(), authProvider, message);
        checkRequiredField(AUTHORITY, azureSSOClientConfig.getAuthority(), authProvider, message);
        checkRequiredField(SCOPES, azureSSOClientConfig.getScopes(), authProvider, message);
        break;
      case CUSTOM_OIDC:
        CustomOIDCSSOClientConfig customOIDCSSOClientConfig = authConfig.getCustomOidc();
        checkRequiredField(CLIENT_ID, customOIDCSSOClientConfig.getClientId(), authProvider, message);
        checkRequiredField(SECRET_KEY, customOIDCSSOClientConfig.getSecretKey(), authProvider, message);
        checkRequiredField("tokenEndpoint", customOIDCSSOClientConfig.getTokenEndpoint(), authProvider, message);
        break;
      case OPENMETADATA:
        OpenMetadataJWTClientConfig openMetadataJWTClientConfig = authConfig.getOpenmetadata();
        checkRequiredField(JWT_TOKEN, openMetadataJWTClientConfig.getJwtToken(), authProvider, message);
      case NO_AUTH:
        break;
      default:
        message.append(String.format("\nOpenMetadata doesn't support auth provider type %s", authProvider.value()));
    }
    if (message.length() != 0) {
      context.buildConstraintViolationWithTemplate(message.toString()).addConstraintViolation();
      return false;
    }
    return true;
  }

  public static void checkRequiredField(
      String fieldName,
      String fieldValue,
      OpenMetadataServerConnection.AuthProvider authProvider,
      StringBuilder message) {
    if (nullOrEmpty(fieldValue)) {
      message.append(String.format("\n%s SSO client config requires %s", authProvider, fieldName));
    }
  }

  public static void checkRequiredField(
      String fieldName,
      List<?> fieldValue,
      OpenMetadataServerConnection.AuthProvider authProvider,
      StringBuilder message) {
    if (nullOrEmpty(fieldValue)) {
      message.append(String.format("\n%s SSO client config requires %s", authProvider, fieldName));
    }
  }
}
