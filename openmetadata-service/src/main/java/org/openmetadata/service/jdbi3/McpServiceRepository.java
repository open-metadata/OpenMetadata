/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.services.McpService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.services.connections.mcp.McpServerConfig;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.McpConnection;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.resources.services.mcp.McpServiceResource;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
@Repository
public class McpServiceRepository extends ServiceEntityRepository<McpService, McpConnection> {

  public McpServiceRepository() {
    super(
        McpServiceResource.COLLECTION_PATH,
        Entity.MCP_SERVICE,
        Entity.getCollectionDAO().mcpServiceDAO(),
        McpConnection.class,
        "",
        ServiceType.MCP);
    supportsSearch = true;
  }

  @Override
  public void prepare(McpService service, boolean update) {
    List<McpServerConfig> servers = serversWithoutKeys(service);
    // Checked whenever the servers change apart from their keys, order included, so an unrelated
    // edit never blocks a stored service. A PUT reaches here with update=true before the stored id
    // is applied, so look it up by name.
    McpService stored =
        update
            ? findByNameOrNull(FullyQualifiedName.quoteName(service.getName()), Include.ALL)
            : null;
    if (stored == null || !servers.equals(serversWithoutKeys(stored))) {
      validateUniqueServerNames(servers.stream().map(McpServerConfig::getName).toList());
    }
    super.prepare(service, update);
  }

  /** Copies of the service's servers without their keys, which are masked or encrypted. */
  private static List<McpServerConfig> serversWithoutKeys(McpService service) {
    if (service.getConnection() == null || service.getConnection().getConfig() == null) {
      return List.of();
    }
    org.openmetadata.schema.services.connections.mcp.McpConnection config =
        JsonUtils.convertValue(
            service.getConnection().getConfig(),
            org.openmetadata.schema.services.connections.mcp.McpConnection.class);
    return JsonUtils.deepCopyList(listOrEmpty(config.getServers()), McpServerConfig.class).stream()
        .map(server -> server.withApiKey(null))
        .toList();
  }

  /**
   * Each server's settings are stored and restored by its name, so the name must identify one
   * server (e.g. two entries named "local" could not be told apart after a reorder).
   */
  private static void validateUniqueServerNames(List<String> names) {
    Set<String> seen = new HashSet<>();
    for (String name : names) {
      if (!seen.add(name)) {
        throw new BadRequestException(
            String.format("MCP server names must be unique, found [%s] more than once", name));
      }
    }
  }
}
