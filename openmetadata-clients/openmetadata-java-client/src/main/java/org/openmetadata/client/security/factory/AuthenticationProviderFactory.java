package org.openmetadata.client.security.factory;

import org.openmetadata.catalog.services.connections.metadata.OpenMetadataServerConnection;
import org.openmetadata.client.security.GoogleAuthenticationProvider;
import org.openmetadata.client.security.NoOpAuthenticationProvider;
import org.openmetadata.client.security.OktaAuthenticationProvider;
import org.openmetadata.client.security.interfaces.AuthenticationProvider;

public class AuthenticationProviderFactory {
    public AuthenticationProvider getAuthProvider(OpenMetadataServerConnection serverConfig){
        switch(serverConfig.getAuthProvider()){
            case NO_AUTH:
                return new NoOpAuthenticationProvider();
            case GOOGLE:
                return new GoogleAuthenticationProvider(serverConfig);
            case OKTA:
                return new OktaAuthenticationProvider(serverConfig);
            case AUTH_0:
            case CUSTOM_OIDC:
            case AZURE:
            case OPENMETADATA:
                return null;
        }
        return null;
    }
}
