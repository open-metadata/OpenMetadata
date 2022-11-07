package org.openmetadata.service.pipelineServiceClient.argo;

import io.argoproj.workflow.ApiClient;
import io.argoproj.workflow.Configuration;
import io.argoproj.workflow.auth.ApiKeyAuth;


public class WorkflowClient {

    public final ApiClient client;
    public final String host;
    public final String namespace;


    public WorkflowClient(String host, String token, String namespace) {
        ApiClient defaultClient = Configuration.getDefaultApiClient();

        defaultClient.setBasePath(host);
        defaultClient.setVerifyingSsl(false); // we don't have any local SSL. Tune it accordingly

        // Configure API key authorization: BearerToken
        ApiKeyAuth BearerToken = (ApiKeyAuth) defaultClient.getAuthentication("BearerToken");

        // Store the token as an env var or change it here
        BearerToken.setApiKey(token);
        BearerToken.setApiKeyPrefix("Bearer");

        this.client = defaultClient;
        this.host = host;
        this.namespace = namespace;
    }

}
