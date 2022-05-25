package org.openmetadata.client.security.interfaces;

import io.swagger.client.model.OpenMetadataServerConnection;

public interface AuthenticationProvider {
    AuthenticationProvider create(OpenMetadataServerConnection iConfig);
    String authToken();
    String getAccessToken();
}