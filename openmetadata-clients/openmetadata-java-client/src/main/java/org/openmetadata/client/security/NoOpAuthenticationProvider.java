package org.openmetadata.client.security;

import feign.RequestInterceptor;
import feign.RequestTemplate;
import org.openmetadata.catalog.services.connections.metadata.OpenMetadataServerConnection;
import org.openmetadata.client.security.interfaces.AuthenticationProvider;

public class NoOpAuthenticationProvider implements AuthenticationProvider {
    public NoOpAuthenticationProvider(){
    }
    @Override
    public AuthenticationProvider create(OpenMetadataServerConnection iConfig) {
        return new NoOpAuthenticationProvider();
    }

    @Override
    public String authToken() {
        return null;
    }

    @Override
    public String getAccessToken() {
        return "";
    }

    @Override
    public void apply(RequestTemplate requestTemplate) {
        //no-auth we dont apply anything
        return;
    }
}
