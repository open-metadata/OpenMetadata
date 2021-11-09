package org.openmetadata.catalog.ingestion;

import javax.validation.constraints.NotEmpty;

public class AirflowConfiguration {

    @NotEmpty
    private String apiEndpoint;

    @NotEmpty
    private String username;

    @NotEmpty
    private String password;

    private Integer timeout = 30;

    private String metadataApiEndpoint;

    private String authProvider;

    private String secretKey = "";

    public String getApiEndpoint() {
        return apiEndpoint;
    }

    public void setApiEndpoint(String apiEndpoint) {
        this.apiEndpoint = apiEndpoint;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public Integer getTimeout() {
        return timeout;
    }

    public void setTimeout(Integer timeout) {
        this.timeout = timeout;
    }

    public String getMetadataApiEndpoint() {
        return metadataApiEndpoint;
    }

    public String getAuthProvider() {
        return authProvider;
    }

    public String getSecretKey() {
        return secretKey;
    }

    @Override
    public String toString() {
        return "AirflowConfiguration{" +
                "apiEndpoint='" + apiEndpoint + '\'' +
                ", username='" + username + '\'' +
                ", password='" + password + '\'' +
                '}';
    }
}

