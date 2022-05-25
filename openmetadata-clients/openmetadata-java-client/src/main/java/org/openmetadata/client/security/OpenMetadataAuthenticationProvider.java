package org.openmetadata.client.security;

import feign.RequestInterceptor;
import feign.RequestTemplate;
import io.swagger.client.model.OpenMetadataServerConnection;
import org.openmetadata.client.security.interfaces.AuthenticationProvider;

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
