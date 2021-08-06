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

import org.apache.http.HttpHost;
import org.elasticsearch.action.ActionListener;
import org.elasticsearch.action.update.UpdateRequest;
import org.elasticsearch.action.update.UpdateResponse;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestClient;
import org.elasticsearch.client.RestHighLevelClient;
import org.openmetadata.catalog.CatalogApplicationConfig;
import org.openmetadata.catalog.ElasticSearchConfiguration;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.jdbi3.TableRepository;
import org.openmetadata.catalog.type.Column;
import org.openmetadata.catalog.type.EntityReference;
import org.skife.jdbi.v2.DBI;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.container.ContainerResponseContext;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class ElasticSearchEventHandler implements EventHandler {
  private static final Logger LOG = LoggerFactory.getLogger(AuditEventHandler.class);
  private RestHighLevelClient client;
  private TableRepository tableRepository;
  private final ActionListener<UpdateResponse> listener = new ActionListener<>() {
    @Override
    public void onResponse(UpdateResponse updateResponse) {
      LOG.info("Updated Elastic Search", updateResponse);
    }

    @Override
    public void onFailure(Exception e) {
      LOG.error("Failed to update Elastic Search", e);
    }
  };

  public void init(CatalogApplicationConfig config, DBI jdbi) {
    ElasticSearchConfiguration esConfig = config.getElasticSearchConfiguration();
    this.client = new RestHighLevelClient(
            RestClient.builder(new HttpHost(esConfig.getHost(), esConfig.getPort(), "http"))
    );
  }

  public Void process(ContainerRequestContext requestContext,
                      ContainerResponseContext responseContext) {
    try {
      int responseCode = responseContext.getStatus();
      String method = requestContext.getMethod();
      LOG.info("request Context "+ requestContext.toString());
      if (responseContext.getEntity() != null) {
        Object entity = responseContext.getEntity();
        if (entity.getClass().toString().toLowerCase().endsWith(Entity.TABLE.toLowerCase())) {
          Table instance = (Table) entity;
          Map<String, Object> jsonMap = new HashMap<>();
          jsonMap.put("description", instance.getDescription());
          Set<String> tags = new HashSet<>();
          List<String> columnDescriptions = new ArrayList<>();
          if (instance.getTags() != null) {
            instance.getTags().forEach(tag -> tags.add(tag.getTagFQN()));
          }
          if (instance.getColumns() != null) {
            for (Column column : instance.getColumns()) {
              column.getTags().forEach(tag -> tags.add(tag.getTagFQN()));
              columnDescriptions.add(column.getDescription());
            }
          }
          if (!tags.isEmpty()) {
            List<String> tagsList = new ArrayList<>();
            tagsList.addAll(tags);
            jsonMap.put("tags", tagsList);
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
          client.updateAsync(updateRequest, RequestOptions.DEFAULT, listener);
        }
      }
    } catch (Exception e) {
      LOG.error("failed to update ES doc", e);
    }
    return null;
  }

  public void close() {
    try {
      this.client.close();
    } catch (Exception e) {
      LOG.error("Failed to close elastic search", e);
    }
  }

}
