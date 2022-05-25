package org.openmetadata.client.security;

import feign.RequestInterceptor;
import feign.RequestTemplate;
import io.swagger.client.model.OpenMetadataServerConnection;
import org.openmetadata.client.security.interfaces.AuthenticationProvider;

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
