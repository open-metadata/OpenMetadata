package org.openmetadata.service.mcp.tools;

import com.fasterxml.jackson.databind.JsonNode;
import io.modelcontextprotocol.server.McpServerFeatures;
import io.modelcontextprotocol.spec.McpSchema;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.JsonUtils;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
public class SearchMetadataTool {
    public static McpServerFeatures.SyncToolSpecification tool() {
        // Step 1: Load the JSON schema for the tool input arguments.
        final String schema =
                "{\"$schema\":\"http://json-schema.org/draft-07/schema#\",\"type\":\"object\",\"properties\":{\"query\":{\"type\":\"string\",\"description\":\"The search query or keywords to find relevant metadata\"}},\"required\":[\"query\"]}";

        // Step 2: Create a tool with name, description, and JSON schema.
        McpSchema.Tool tool =
                new McpSchema.Tool(
                        "search_metadata", "Search for metadata in the OpenMetadata catalog", schema);

        // Step 3: Create a tool specification with the tool and the call function.
        return new McpServerFeatures.SyncToolSpecification(
                tool,
                (exchange, arguments) -> {
                    McpSchema.Content content =
                            new McpSchema.TextContent(JsonUtils.pojoToJson(searchMetadata(arguments)));
                    return new McpSchema.CallToolResult(List.of(content), false);
                });
    }


    @SneakyThrows
    private static Map<String, Object> searchMetadata(Map<String, Object> params) {
        try {
            LOG.info("Executing searchMetadata with params: {}", params);
            String query = params.containsKey("query") ? (String) params.get("query") : "*";
            int limit = 10;
            if (params.containsKey("limit")) {
                Object limitObj = params.get("limit");
                if (limitObj instanceof Number) {
                    limit = ((Number) limitObj).intValue();
                } else if (limitObj instanceof String) {
                    limit = Integer.parseInt((String) limitObj);
                }
            }

            boolean includeDeleted = false;
            if (params.containsKey("include_deleted")) {
                Object deletedObj = params.get("include_deleted");
                if (deletedObj instanceof Boolean) {
                    includeDeleted = (Boolean) deletedObj;
                } else if (deletedObj instanceof String) {
                    includeDeleted = "true".equals(deletedObj);
                }
            }

            String entityType =
                    params.containsKey("entity_type") ? (String) params.get("entity_type") : null;
            String index = "table_search_index";

            LOG.info(
                    "Search query: {}, index: {}, limit: {}, includeDeleted: {}",
                    query,
                    index,
                    limit,
                    includeDeleted);

            SearchRequest searchRequest =
                    new SearchRequest()
                            .withQuery(query)
                            .withIndex(index)
                            .withSize(limit)
                            .withFrom(0)
                            .withFetchSource(true)
                            .withDeleted(includeDeleted);

            javax.ws.rs.core.Response response = Entity.getSearchRepository().search(searchRequest, null);

            if (response.getEntity() instanceof String responseStr) {
                LOG.info("Search returned string response");
                JsonNode jsonNode = JsonUtils.readTree(responseStr);
                return JsonUtils.convertValue(jsonNode, Map.class);
            } else {
                LOG.info("Search returned object response: {}", response.getEntity().getClass().getName());
                return JsonUtils.convertValue(response.getEntity(), Map.class);
            }
        } catch (Exception e) {
            LOG.error("Error in searchMetadata", e);
            Map<String, Object> error = new HashMap<>();
            error.put("error", e.getMessage());
            return error;
        }
    }
}
