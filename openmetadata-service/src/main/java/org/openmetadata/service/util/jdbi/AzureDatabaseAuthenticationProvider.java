package org.openmetadata.service.util.jdbi;

import com.azure.core.credential.AccessToken;
import com.azure.core.credential.TokenRequestContext;
import com.azure.identity.DefaultAzureCredential;
import com.azure.identity.DefaultAzureCredentialBuilder;

public class AzureDatabaseAuthenticationProvider implements DatabaseAuthenticationProvider {
  public static final String AZURE = "azure";

  @Override
  public String authenticate(String jdbcUrl, String username, String password) {
    try {
      return fetchAzureADToken();
    } catch (Exception e) {
      throw new DatabaseAuthenticationProviderException(e);
    }
  }

  private String fetchAzureADToken() {
    try {
      DefaultAzureCredential defaultCredential = new DefaultAzureCredentialBuilder().build();
      TokenRequestContext requestContext =
          new TokenRequestContext().addScopes("https://ossrdbms-aad.database.windows.net/.default");
      AccessToken token = defaultCredential.getToken(requestContext).block();

      if (token != null) {
        return token.getToken();
      } else {
        throw new DatabaseAuthenticationProviderException("Failed to fetch token");
      }
    } catch (Exception e) {
      throw new DatabaseAuthenticationProviderException("Error fetching Azure AD token", e);
    }
  }
}
