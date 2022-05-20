package org.openmetada.restclient.security;

import feign.RequestInterceptor;
import feign.RequestTemplate;
import org.openmetada.restclient.security.interfaces.AuthenticationProvider;
import org.openmetadata.catalog.services.connections.metadata.OpenMetadataServerConnection;
import org.openmetada.restclient.security.interfaces.AuthenticationProvider;

public class OpenMetadataAuthenticationProvider  implements AuthenticationProvider, RequestInterceptor {
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
