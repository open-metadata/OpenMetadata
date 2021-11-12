/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.events;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;
import org.apache.commons.lang3.StringUtils;
import org.apache.http.HttpHost;
import org.apache.http.auth.AuthScope;
import org.apache.http.auth.UsernamePasswordCredentials;
import org.apache.http.client.CredentialsProvider;
import org.apache.http.impl.client.BasicCredentialsProvider;
import org.elasticsearch.action.ActionListener;
import org.elasticsearch.action.update.UpdateRequest;
import org.elasticsearch.action.update.UpdateResponse;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestClient;
import org.elasticsearch.client.RestClientBuilder;
import org.elasticsearch.client.RestHighLevelClient;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.catalog.CatalogApplicationConfig;
import org.openmetadata.catalog.ElasticSearchConfiguration;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Dashboard;
import org.openmetadata.catalog.entity.data.Pipeline;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.entity.data.Topic;
import org.openmetadata.catalog.type.Column;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.container.ContainerResponseContext;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Predicate;
import java.util.stream.Collectors;

public class ElasticSearchEventHandler implements EventHandler {
  private static final Logger LOG = LoggerFactory.getLogger(AuditEventHandler.class);
  private RestHighLevelClient client;
  private final ActionListener<UpdateResponse> listener = new ActionListener<>() {
    @Override
    public void onResponse(UpdateResponse updateResponse) {
      LOG.info("Updated Elastic Search {}", updateResponse);
    }

    @Override
    public void onFailure(Exception e) {
      LOG.error("Failed to update Elastic Search", e);
    }
  };

  public void init(CatalogApplicationConfig config, Jdbi jdbi) {
    ElasticSearchConfiguration esConfig = config.getElasticSearchConfiguration();
    RestClientBuilder restClientBuilder = RestClient.builder(new HttpHost(esConfig.getHost(), esConfig.getPort(), "http"));
    if(StringUtils.isNotEmpty(esConfig.getUsername())){
      CredentialsProvider credentialsProvider = new BasicCredentialsProvider();
      credentialsProvider.setCredentials(AuthScope.ANY, new UsernamePasswordCredentials(esConfig.getUsername(), esConfig.getPassword()));
      restClientBuilder.setHttpClientConfigCallback(httpAsyncClientBuilder -> {
        httpAsyncClientBuilder.setDefaultCredentialsProvider(credentialsProvider);
        return  httpAsyncClientBuilder;
      });
    }
    this.client = new RestHighLevelClient(restClientBuilder);
  }

  public Void process(ContainerRequestContext requestContext,
                      ContainerResponseContext responseContext) {
    try {
      LOG.info("request Context "+ requestContext.toString());
      if (responseContext.getEntity() != null) {
        Object entity = responseContext.getEntity();
        UpdateRequest updateRequest = null;
        String entityClass = entity.getClass().toString();
        if (entityClass.toLowerCase().endsWith(Entity.TABLE.toLowerCase())) {
          Table instance = (Table) entity;
          updateRequest = updateTable(instance);
        } else if (entityClass.toLowerCase().endsWith(Entity.DASHBOARD.toLowerCase())) {
          Dashboard instance = (Dashboard) entity;
          updateRequest = updateDashboard(instance);
        } else if (entityClass.toLowerCase().endsWith(Entity.TOPIC.toLowerCase())) {
          Topic instance = (Topic) entity;
          updateRequest = updateTopic(instance);
        }  else if (entityClass.toLowerCase().endsWith(Entity.PIPELINE.toLowerCase())) {
          Pipeline instance = (Pipeline) entity;
          updateRequest = updatePipeline(instance);
        }
        if (updateRequest != null) {
          client.updateAsync(updateRequest, RequestOptions.DEFAULT, listener);
        }
      }
    } catch (Exception e) {
      LOG.error("failed to update ES doc", e);
    }
    return null;
  }

  private UpdateRequest updateTable(Table instance) {
    Map<String, Object> jsonMap = new HashMap<>();
    jsonMap.put("description", instance.getDescription());
    Set<String> tags = new HashSet<>();
    List<String> columnDescriptions = new ArrayList<>();
    List<String> columnNames = new ArrayList<>();
    if (instance.getTags() != null) {
      instance.getTags().forEach(tag -> tags.add(tag.getTagFQN()));
    }
    if (instance.getColumns() != null) {

      List<FlattenColumn> cols = new ArrayList<>();
      cols = parseColumns(instance.getColumns(), cols, null);

      for (FlattenColumn col : cols) {
        if (col.getTags() != null) {
          tags.addAll(col.getTags());
        }
        columnDescriptions.add(col.getDescription());
        columnNames.add(col.getName());
      }
    }
    
    if (!tags.isEmpty()) {
      List<String> tagsList = new ArrayList<>(tags);
      String tierTag = null;
      for (String tag: tagsList) {
        if (tag.toLowerCase().matches("(.*)tier(.*)")) {
          tierTag = tag;
          break;
        }
      }
      if (tierTag != null) {
        tagsList.remove(tierTag);
        jsonMap.put("tier", tierTag);
      }
      jsonMap.put("tags", tagsList);
    }
    if (!columnNames.isEmpty()) {
      jsonMap.put("column_names", columnNames);
    }
    if (!columnDescriptions.isEmpty()) {
      jsonMap.put("column_descriptions", columnDescriptions);
    }
    if(instance.getOwner() != null) {
      jsonMap.put("owner", instance.getOwner().getId().toString());
    }
    if (instance.getFollowers() != null) {
      List<String> followers = new ArrayList<>();
      for(EntityReference follower: instance.getFollowers()) {
        followers.add(follower.getId().toString());
      }
      jsonMap.put("followers", followers);
    }
    jsonMap.put("last_updated_timestamp", System.currentTimeMillis());
    UpdateRequest updateRequest = new UpdateRequest("table_search_index", instance.getId().toString());
    updateRequest.doc(jsonMap);
    return updateRequest;
  }

  private UpdateRequest updateTopic(Topic instance) {
    Map<String, Object> jsonMap = new HashMap<>();
    jsonMap.put("description", instance.getDescription());
    Set<String> tags = new HashSet<>();

    if (instance.getTags() != null) {
      instance.getTags().forEach(tag -> tags.add(tag.getTagFQN()));
    }
    if (!tags.isEmpty()) {
      List<String> tagsList = new ArrayList<>(tags);
      String tierTag = null;
      for (String tag: tagsList) {
        if (tag.toLowerCase().matches("(.*)tier(.*)")) {
          tierTag = tag;
          break;
        }
      }
      if (tierTag != null) {
        tagsList.remove(tierTag);
        jsonMap.put("tier", tierTag);
      }
      jsonMap.put("tags", tagsList);
    }

    if(instance.getOwner() != null) {
      jsonMap.put("owner", instance.getOwner().getId().toString());
    }
    if (instance.getFollowers() != null) {
      List<String> followers = new ArrayList<>();
      for(EntityReference follower: instance.getFollowers()) {
        followers.add(follower.getId().toString());
      }
      jsonMap.put("followers", followers);
    }
    jsonMap.put("last_updated_timestamp", System.currentTimeMillis());
    UpdateRequest updateRequest = new UpdateRequest("topic_search_index", instance.getId().toString());
    updateRequest.doc(jsonMap);
    return updateRequest;
  }

  private UpdateRequest updateDashboard(Dashboard instance) {
    Map<String, Object> jsonMap = new HashMap<>();
    jsonMap.put("description", instance.getDescription());
    Set<String> tags = new HashSet<>();
    if (instance.getTags() != null) {
      instance.getTags().forEach(tag -> tags.add(tag.getTagFQN()));
    }

    if (!tags.isEmpty()) {
      List<String> tagsList = new ArrayList<>(tags);
      String tierTag = null;
      for (String tag: tagsList) {
        if (tag.toLowerCase().matches("(.*)tier(.*)")) {
          tierTag = tag;
          break;
        }
      }
      if (tierTag != null) {
        tagsList.remove(tierTag);
        jsonMap.put("tier", tierTag);
      }
      jsonMap.put("tags", tagsList);
    }

    if(instance.getOwner() != null) {
      jsonMap.put("owner", instance.getOwner().getId().toString());
    }
    if (instance.getFollowers() != null) {
      List<String> followers = new ArrayList<>();
      for(EntityReference follower: instance.getFollowers()) {
        followers.add(follower.getId().toString());
      }
      jsonMap.put("followers", followers);
    }
    jsonMap.put("last_updated_timestamp", System.currentTimeMillis());
    UpdateRequest updateRequest = new UpdateRequest("dashboard_search_index", instance.getId().toString());
    updateRequest.doc(jsonMap);
    return updateRequest;
  }

  private UpdateRequest updatePipeline(Pipeline instance) {
    Map<String, Object> jsonMap = new HashMap<>();
    jsonMap.put("description", instance.getDescription());
    Set<String> tags = new HashSet<>();
    if (instance.getTags() != null) {
      instance.getTags().forEach(tag -> tags.add(tag.getTagFQN()));
    }

    if (!tags.isEmpty()) {
      List<String> tagsList = new ArrayList<>(tags);
      String tierTag = null;
      for (String tag: tagsList) {
        if (tag.toLowerCase().matches("(.*)tier(.*)")) {
          tierTag = tag;
          break;
        }
      }
      if (tierTag != null) {
        tagsList.remove(tierTag);
        jsonMap.put("tier", tierTag);
      }
      jsonMap.put("tags", tagsList);
    }

    if(instance.getOwner() != null) {
      jsonMap.put("owner", instance.getOwner().getId().toString());
    }
    if (instance.getFollowers() != null) {
      List<String> followers = new ArrayList<>();
      for(EntityReference follower: instance.getFollowers()) {
        followers.add(follower.getId().toString());
      }
      jsonMap.put("followers", followers);
    }
    jsonMap.put("last_updated_timestamp", System.currentTimeMillis());
    UpdateRequest updateRequest = new UpdateRequest("pipeline_search_index", instance.getId().toString());
    updateRequest.doc(jsonMap);
    return updateRequest;
  }

  private List<FlattenColumn> parseColumns(List<Column> columns, List<FlattenColumn> flattenColumns,
                                           String parentColumn) {
    Optional<String> optParentColumn = Optional.ofNullable(parentColumn).filter(Predicate.not(String::isEmpty));
    List<String> tags = new ArrayList<>();
    for (Column col: columns) {
      String columnName = col.getName();
      if (optParentColumn.isPresent()) {
        columnName = optParentColumn.get() + "." + columnName;
      }
      if (col.getTags() != null) {
        tags = col.getTags().stream().map(TagLabel::getTagFQN).collect(Collectors.toList());
      }

      FlattenColumn flattenColumn = FlattenColumn.builder()
              .name(columnName)
              .description(col.getDescription()).build();
      if (!tags.isEmpty()) {
        flattenColumn.tags = tags;
      }
      flattenColumns.add(flattenColumn);
      if (col.getChildren() != null) {
        parseColumns(col.getChildren(), flattenColumns, col.getName());
      }
    }
    return flattenColumns;
  }

  @Getter
  @Builder
  public static class FlattenColumn {
    String name;
    String description;
    List<String> tags;
  }

  public void close() {
    try {
      this.client.close();
    } catch (Exception e) {
      LOG.error("Failed to close elastic search", e);
    }
  }

}
