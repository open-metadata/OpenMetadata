package org.openmetada.restclient.security.factory;

import org.openmetada.restclient.security.GoogleAuthenticationProvider;
import org.openmetada.restclient.security.NoOpAuthenticationProvider;
import org.openmetada.restclient.security.interfaces.AuthenticationProvider;
import org.openmetadata.catalog.services.connections.metadata.OpenMetadataServerConnection;

public class AuthenticationProviderFactory {
    public AuthenticationProvider getAuthProvider(OpenMetadataServerConnection.AuthProvider type){
        switch (type){
            case NO_AUTH:
            case GOOGLE:
            case OKTA:
            case AUTH_0:
            case CUSTOM_OIDC:
            case AZURE:
            case OPENMETADATA:
        }
        OpenMetadataServerConnection server = new OpenMetadataServerConnection();
        return new GoogleAuthenticationProvider(server);
    }
}
