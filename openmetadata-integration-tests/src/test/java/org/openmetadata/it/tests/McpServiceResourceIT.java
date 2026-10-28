package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.services.CreateMcpService;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.McpService;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.services.mcp.McpServiceResource.McpServiceList;
import org.openmetadata.service.secrets.masker.PasswordEntityMasker;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class McpServiceResourceIT {
  private static final String COLLECTION = "/v1/services/mcpServices";
  private static final String API_KEY = "synthetic-mcp-smoke-api-key";

  @Test
  void list_preservesIdentityFieldsAndCredentialMasking(TestNamespace ns) {
    final Domain domain =
        ns.trackRoot(
            Entity.DOMAIN,
            SdkClients.adminClient()
                .domains()
                .create(
                    new CreateDomain()
                        .withName(ns.prefix("mcp_domain"))
                        .withDescription("MCP service list isolation")
                        .withDomainType(CreateDomain.DomainType.AGGREGATE)));
    final CreateMcpService request =
        JsonUtils.readValue(
                """
        {"serviceType":"Mcp","connection":{"config":{"type":"Mcp","servers":[{
          "name":"http-server","transport":"SSE","url":"http://localhost:9000/sse",
          "apiKey":"synthetic-mcp-smoke-api-key"}]}}}
        """,
                CreateMcpService.class)
            .withName(ns.prefix("mcp_service"))
            .withDescription("Healthy MCP service")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    final HttpClient human = SdkClients.adminClient().getHttpClient();
    final McpService created =
        human.execute(HttpMethod.POST, COLLECTION, request, McpService.class);
    try {
      final McpServiceList listed =
          human.execute(
              HttpMethod.GET,
              COLLECTION,
              null,
              McpServiceList.class,
              RequestOptions.builder()
                  .queryParam("domain", domain.getFullyQualifiedName())
                  .queryParam("fields", "domains,owners")
                  .queryParam("includePermissions", "true")
                  .build());
      assertEquals(1, listed.getData().size());
      final McpService row = listed.getData().getFirst();
      assertEquals(created.getId(), row.getId());
      assertEquals(request.getDescription(), row.getDescription());
      assertEquals(
          List.of(domain.getId()),
          row.getDomains().stream().map(reference -> reference.getId()).toList());
      assertTrue(listed.getEntityPermissions().containsKey(created.getId().toString()));
      assertEquals(
          PasswordEntityMasker.PASSWORD_MASK,
          JsonUtils.readTree(JsonUtils.pojoToJson(row.getConnection().getConfig()))
              .path("servers")
              .get(0)
              .path("apiKey")
              .asText());
      final McpService bot =
          SdkClients.ingestionBotClient()
              .getHttpClient()
              .execute(HttpMethod.GET, COLLECTION + "/" + created.getId(), null, McpService.class);
      assertEquals(
          API_KEY,
          JsonUtils.readTree(JsonUtils.pojoToJson(bot.getConnection().getConfig()))
              .path("servers")
              .get(0)
              .path("apiKey")
              .asText());
    } finally {
      human.execute(
          HttpMethod.DELETE,
          COLLECTION + "/" + created.getId(),
          null,
          Void.class,
          RequestOptions.builder()
              .queryParam("hardDelete", "true")
              .queryParam("recursive", "true")
              .build());
    }
  }
}
