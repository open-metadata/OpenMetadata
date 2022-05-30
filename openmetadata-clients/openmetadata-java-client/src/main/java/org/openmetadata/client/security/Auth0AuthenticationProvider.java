package org.openmetadata.client.security;

import feign.RequestInterceptor;
import feign.RequestTemplate;
import org.openmetadata.catalog.services.connections.metadata.OpenMetadataServerConnection;
import org.openmetadata.client.security.interfaces.AuthenticationProvider;

public class Auth0AuthenticationProvider implements AuthenticationProvider {
    @Override
    public AuthenticationProvider create(OpenMetadataServerConnection iConfig) {
        return null;
    }

    @Override
    public String authToken() {
        return null;
    }

    @Override
    public String getAccessToken() {
        return null;
    }

    @Override
    public void apply(RequestTemplate requestTemplate) {

    }
}
