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

  // Method to get access token
  public static String getAccessToken() throws MalformedURLException {
    // Build confidential client application
    ConfidentialClientApplication app =
        ConfidentialClientApplication.builder(
                CLIENT_ID,
                ClientCredentialFactory.createFromSecret(
                    CLIENT_SECRET)) // authenticate using client secret
            .authority("https://login.microsoftonline.com/" + TENANT_ID) // Azure AD authority
            .build();

    // Set the permission scope (for PostgreSQL it's ossrdbms-aad)
    Set<String> scopes = Set.of(SCOPE);

    // Create request for a token
    ClientCredentialParameters parameters = ClientCredentialParameters.builder(scopes).build();
    IAuthenticationResult result = app.acquireToken(parameters).join(); // Get the token

    return result.accessToken(); // Return the access token
  }
}
