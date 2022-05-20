package org.openmetada.restclient.security;

import feign.RequestInterceptor;
import feign.RequestTemplate;
import feign.codec.Decoder;
import org.openmetada.restclient.security.interfaces.AuthenticationProvider;
import org.openmetadata.catalog.services.connections.metadata.OpenMetadataServerConnection;

public class NoOpAuthenticationProvider implements AuthenticationProvider, RequestInterceptor {

    private OpenMetadataServerConnection serverConfig;

    public NoOpAuthenticationProvider(OpenMetadataServerConnection iConfig){
        serverConfig = iConfig;
    }

    @Override
    public AuthenticationProvider create(OpenMetadataServerConnection iConfig) {
        return new NoOpAuthenticationProvider(iConfig);
    }

    @Override
    public String authToken() {
        return null;
    }

    @Override
    public String getAccessToken() {
        return "no_token";
    }

    @Override
    public void apply(RequestTemplate requestTemplate) {

    }
}
