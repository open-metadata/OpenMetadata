package org.openmetadata.service.util;

import com.microsoft.aad.msal4j.*;
import java.net.MalformedURLException;
import java.util.Set;

public class AzureTokenProvider {

  private static final String CLIENT_ID = "your-client-id"; // From Azure AD App Registration
  private static final String TENANT_ID = "your-tenant-id"; // Your Azure AD tenant ID
  private static final String CLIENT_SECRET = "your-client-secret"; // Generated in App Registration
  private static final String SCOPE =
      "https://ossrdbms-aad.database.windows.net/.default"; // Scope for PostgreSQL

  public static String getAccessToken() throws MalformedURLException {
    ConfidentialClientApplication app =
        ConfidentialClientApplication.builder(
                CLIENT_ID, ClientCredentialFactory.createFromSecret(CLIENT_SECRET))
            .authority("https://login.microsoftonline.com/" + TENANT_ID) // Azure AD authority
            .build();

    Set<String> scopes = Set.of(SCOPE);
    ClientCredentialParameters parameters = ClientCredentialParameters.builder(scopes).build();
    IAuthenticationResult result = app.acquireToken(parameters).join(); // Get the token

    return result.accessToken(); // Return the access token
  }
}
