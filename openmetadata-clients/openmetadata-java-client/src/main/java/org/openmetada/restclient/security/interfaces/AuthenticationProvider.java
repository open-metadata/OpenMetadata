package org.openmetada.restclient.security.interfaces;

import org.openmetadata.catalog.services.connections.metadata.OpenMetadataServerConnection;

public interface AuthenticationProvider {
    AuthenticationProvider create(OpenMetadataServerConnection iConfig);
    String authToken();
    String getAccessToken();
}