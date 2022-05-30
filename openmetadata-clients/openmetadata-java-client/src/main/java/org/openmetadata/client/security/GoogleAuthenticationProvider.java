package org.openmetadata.client.security;


import com.google.auth.oauth2.AccessToken;
import com.google.auth.oauth2.IdTokenCredentials;
import com.google.auth.oauth2.ServiceAccountCredentials;
import feign.RequestTemplate;
import org.openmetadata.catalog.security.client.GoogleSSOClientConfig;
import org.openmetadata.catalog.services.connections.metadata.OpenMetadataServerConnection;
import org.openmetadata.client.security.interfaces.AuthenticationProvider;

import java.io.FileInputStream;
import java.util.Arrays;

public class GoogleAuthenticationProvider  implements AuthenticationProvider {
    private OpenMetadataServerConnection serverConfig;
    private GoogleSSOClientConfig securityConfig;
    private String generatedAuthToken;
    private Long expirationTimeMillis;
    private final String OPENID_SCOPE = "https://www.googleapis.com/auth/plus.me";
    private final String PROFILE_SCOPE = "https://www.googleapis.com/auth/userinfo.profile";
    private final String EMAIL_SCOPE = "https://www.googleapis.com/auth/userinfo.email";

    public GoogleAuthenticationProvider(OpenMetadataServerConnection iConfig){
        if(!iConfig.getAuthProvider().equals(OpenMetadataServerConnection.AuthProvider.GOOGLE)){
            throw new RuntimeException("Required type to invoke is Google OKTA");
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
            String credPath = securityConfig.getSecretKey();
            String targetAudience = securityConfig.getAudience();

            ServiceAccountCredentials saCreds = ServiceAccountCredentials.fromStream(new FileInputStream(credPath));

            saCreds = (ServiceAccountCredentials) saCreds.createScoped(Arrays.asList(OPENID_SCOPE, PROFILE_SCOPE , EMAIL_SCOPE));
            IdTokenCredentials tokenCredential = IdTokenCredentials.newBuilder().setIdTokenProvider(saCreds).setTargetAudience(targetAudience).build();
            AccessToken token = tokenCredential.refreshAccessToken();
            this.expirationTimeMillis = token.getExpirationTime().getTime();
            this.generatedAuthToken = token.getTokenValue();
        }catch(Exception ex){
            System.out.println(ex.getMessage());
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
