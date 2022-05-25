package org.openmetadata.client.security;


import com.google.auth.oauth2.AccessToken;
import com.google.auth.oauth2.GoogleCredentials;
import feign.RequestInterceptor;
import feign.RequestTemplate;
import org.apache.commons.io.IOUtils;
import org.openmetadata.catalog.security.client.GoogleSSOClientConfig;
import io.swagger.client.model.OpenMetadataServerConnection;
import org.openmetadata.client.security.interfaces.AuthenticationProvider;

import java.nio.charset.StandardCharsets;

public class GoogleAuthenticationProvider  implements AuthenticationProvider, RequestInterceptor {
    private OpenMetadataServerConnection serverConfig;
    private GoogleSSOClientConfig securityConfig;
    private String generatedAuthToken;
    private Long expirationTimeMillis;
    public GoogleAuthenticationProvider(OpenMetadataServerConnection iConfig){
        if(!iConfig.getAuthProvider().equals(OpenMetadataServerConnection.AuthProviderEnum.GOOGLE)){
            throw new RuntimeException("Required type to incoke is Google OKTA");
        }
        serverConfig = iConfig;
        securityConfig = (GoogleSSOClientConfig) iConfig.getSecurityConfig();
        generatedAuthToken = "";
    }
    @Override
    public AuthenticationProvider create(OpenMetadataServerConnection iConfig) {
        return new GoogleAuthenticationProvider(iConfig);
    }

    @Override
    public String authToken() {
        try {
            GoogleCredentials credentials = GoogleCredentials.fromStream(IOUtils.toInputStream(securityConfig.getSecretKey(), StandardCharsets.UTF_8));
            credentials.refreshIfExpired();
            AccessToken token = credentials.getAccessToken();
            this.expirationTimeMillis = token.getExpirationTime().getTime();
            this.generatedAuthToken = token.getTokenValue();
        }catch(Exception ex){
        }
        return generatedAuthToken;
    }

    @Override
    public String getAccessToken() {
        return generatedAuthToken;
    }

    @Override
    public void apply(RequestTemplate requestTemplate) {
        if (requestTemplate.headers().containsKey("Authorization")) {
            return;
        }
        // If first time, get the token
        if (expirationTimeMillis == null || System.currentTimeMillis() >= expirationTimeMillis) {
            this.authToken();
        }
        if (getAccessToken() != null) {
            requestTemplate.header("Authorization", "Bearer " + getAccessToken());
        }
    }
}
