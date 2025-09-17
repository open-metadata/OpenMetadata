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

package org.openmetadata.search.index;

import java.io.IOException;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch.indices.CreateIndexRequest;
import os.org.opensearch.client.opensearch.indices.DeleteIndexRequest;
import os.org.opensearch.client.opensearch.indices.ExistsRequest;
import os.org.opensearch.client.opensearch.indices.PutMappingRequest;
import os.org.opensearch.client.opensearch.indices.UpdateAliasesRequest;
import os.org.opensearch.client.opensearch.indices.update_aliases.Action;
import os.org.opensearch.client.opensearch.indices.update_aliases.AddAction;
import os.org.opensearch.client.opensearch.indices.update_aliases.RemoveAction;

@Slf4j
public class OpenSearchIndexCrud implements SearchIndexCrud {

  private final OpenSearchClient client;
  private final String clusterAlias;

  public OpenSearchIndexCrud(OpenSearchClient client, String clusterAlias) {
    this.client = client;
    this.clusterAlias = clusterAlias;
  }

  @Override
  public boolean indexExists(String indexName) {
    try {
      return client
          .indices()
          .exists(ExistsRequest.of(e -> e.index(getIndexName(indexName))))
          .value();
    } catch (IOException e) {
      log.error("Failed to check if index {} exists", indexName, e);
      return false;
    }
  }

  @Override
  public void createIndex(String indexName, String indexMappingContent) throws IOException {
    String fullIndexName = getIndexName(indexName);
    log.info("Creating index: {}", fullIndexName);

    CreateIndexRequest request =
        CreateIndexRequest.of(
            builder -> {
              builder.index(fullIndexName);
              if (indexMappingContent != null) {
                builder.withJson(new StringReader(indexMappingContent));
              }
              return builder;
            });

    client.indices().create(request);
    log.info("Successfully created index: {}", fullIndexName);
  }

  @Override
  public void addIndexAlias(String indexName, String... aliasNames) throws IOException {
    String fullIndexName = getIndexName(indexName);
    log.info("Adding aliases {} to index {}", aliasNames, fullIndexName);

    List<Action> actions = new ArrayList<>();
    for (String aliasName : aliasNames) {
      String fullAliasName = getAliasName(aliasName);
      actions.add(
          Action.of(
              actionBuilder ->
                  actionBuilder.add(
                      AddAction.of(
                          addBuilder -> addBuilder.index(fullIndexName).alias(fullAliasName)))));
    }

    UpdateAliasesRequest request = UpdateAliasesRequest.of(builder -> builder.actions(actions));

    client.indices().updateAliases(request);
    log.info("Successfully added aliases {} to index {}", aliasNames, fullIndexName);
  }

  @Override
  public void createAliases(String indexName, String aliasName, String... parentAliases)
      throws IOException {
    Set<String> aliases = new HashSet<>();
    aliases.add(aliasName);
    if (parentAliases != null) {
      for (String parentAlias : parentAliases) {
        aliases.add(parentAlias);
      }
    }

    addIndexAlias(indexName, aliases.toArray(new String[0]));
  }

  @Override
  public void updateIndex(String indexName, String indexMappingContent) throws IOException {
    String fullIndexName = getIndexName(indexName);
    log.info("Updating mapping for index: {}", fullIndexName);

    PutMappingRequest request =
        PutMappingRequest.of(
            builder -> {
              builder.index(fullIndexName);
              if (indexMappingContent != null) {
                builder.withJson(new StringReader(indexMappingContent));
              }
              return builder;
            });

    client.indices().putMapping(request);
    log.info("Successfully updated mapping for index: {}", fullIndexName);
  }

  @Override
  public void deleteIndex(String indexName) throws IOException {
    String fullIndexName = getIndexName(indexName);
    log.info("Deleting index: {}", fullIndexName);

    client.indices().delete(DeleteIndexRequest.of(d -> d.index(fullIndexName)));
    log.info("Successfully deleted index: {}", fullIndexName);
  }

  @Override
  public void deleteAlias(String indexName, String aliasName) throws IOException {
    String fullIndexName = getIndexName(indexName);
    String fullAliasName = getAliasName(aliasName);
    log.info("Deleting alias {} from index {}", fullAliasName, fullIndexName);

    UpdateAliasesRequest request =
        UpdateAliasesRequest.of(
            builder ->
                builder.actions(
                    Action.of(
                        actionBuilder ->
                            actionBuilder.remove(
                                RemoveAction.of(
                                    removeBuilder ->
                                        removeBuilder
                                            .index(fullIndexName)
                                            .alias(fullAliasName))))));

    client.indices().updateAliases(request);
    log.info("Successfully deleted alias {} from index {}", fullAliasName, fullIndexName);
  }

  private String getIndexName(String indexName) {
    return clusterAlias != null ? clusterAlias + "_" + indexName : indexName;
  }

  private String getAliasName(String aliasName) {
    return clusterAlias != null ? clusterAlias + "_" + aliasName : aliasName;
  }
}
