package org.openmetadata.client.security.interfaces;

import feign.RequestInterceptor;
import org.openmetadata.catalog.services.connections.metadata.OpenMetadataServerConnection;

public interface AuthenticationProvider extends RequestInterceptor {
    AuthenticationProvider create(OpenMetadataServerConnection iConfig);
    String authToken();
    String getAccessToken();
}