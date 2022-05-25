package org.openmetadata.client.security;

import feign.RequestInterceptor;
import feign.RequestTemplate;
import io.swagger.client.model.OpenMetadataServerConnection;
import org.openmetadata.catalog.security.client.OktaSSOClientConfig;
import org.openmetadata.client.security.interfaces.AuthenticationProvider;

public class OktaAuthenticationProvider  implements AuthenticationProvider, RequestInterceptor {
    private OpenMetadataServerConnection serverConfig;
    private OktaSSOClientConfig securityConfig;
    private String generatedAuthToken;
    private String expiry;
    public OktaAuthenticationProvider(OpenMetadataServerConnection iConfig){
        if(!iConfig.getAuthProvider().equals(OpenMetadataServerConnection.AuthProviderEnum.OKTA)){
            throw new RuntimeException("Required type to invoke is OKTA SSO");
        }
        serverConfig = iConfig;
        securityConfig = (OktaSSOClientConfig) iConfig.getSecurityConfig();
        generatedAuthToken = "";
        expiry = "";
    }
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
