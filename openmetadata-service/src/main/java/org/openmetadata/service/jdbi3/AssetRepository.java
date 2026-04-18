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

import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.attachments.Asset;
import org.openmetadata.schema.attachments.AssetType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.feeds.MessageParser;

@Slf4j
public class AssetRepository {
  private final CollectionDAO.AssetDAO dao;
  private static final String ENTITY_TYPE = "Asset";

  public AssetRepository(CollectionDAO.AssetDAO dao) {
    this.dao = dao;
  }

  public Asset create(Asset asset) {
    if (asset.getId() == null || asset.getId().isEmpty()) {
      asset.setId(UUID.randomUUID().toString());
    }

    MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(asset.getEntityLink());
    String json = JsonUtils.pojoToJson(asset);
    try {
      dao.insert(entityLink.getEntityFQN(), json);
      LOG.info("Created asset with id {}", asset.getId());
    } catch (Exception e) {
      LOG.error("Failed to create asset with id {}: {}", asset.getId(), e.getMessage(), e);
      throw e;
    }
    return asset;
  }

  public List<Asset> getByFQN(String fqn, AssetType assetType) {
    try {
      List<String> json = dao.getByFqnExact(assetType.value(), fqn);
      if (json == null) {
        throw EntityNotFoundException.byMessage(
            CatalogExceptionMessage.entityNotFound(ENTITY_TYPE, fqn));
      }
      return JsonUtils.readObjects(json, Asset.class);
    } catch (Exception e) {
      LOG.error("Failed to read asset with id {}: {}", fqn, e.getMessage(), e);
      throw e;
    }
  }

  public Asset getById(String id) {
    try {
      String json = dao.getById(id);
      if (json == null) {
        throw EntityNotFoundException.byMessage(
            CatalogExceptionMessage.entityNotFound(ENTITY_TYPE, id));
      }
      return JsonUtils.readValue(json, Asset.class);
    } catch (Exception e) {
      LOG.error("Failed to get asset with id {}: {}", id, e.getMessage(), e);
      throw e;
    }
  }

  public List<Asset> getByFqnPrefix(String fqnPrefix, AssetType assetType) {
    try {
      List<String> jsonList = dao.getByFqnPrefix(fqnPrefix, assetType.value());
      if (jsonList == null || jsonList.isEmpty()) {
        throw EntityNotFoundException.byMessage(
            CatalogExceptionMessage.entityNotFound(ENTITY_TYPE, fqnPrefix));
      }
      return JsonUtils.readObjects(jsonList, Asset.class);
    } catch (Exception e) {
      LOG.error("Failed to get assets with fqnPrefix {}: {}", fqnPrefix, e.getMessage(), e);
      throw e;
    }
  }

  public Asset update(Asset asset) {
    String json = JsonUtils.pojoToJson(asset);
    try {
      dao.update(json, asset.getFullyQualifiedName());
      LOG.info("Updated asset with id {}", asset.getId());
    } catch (Exception e) {
      LOG.error("Failed to update asset with id {}: {}", asset.getId(), e.getMessage(), e);
      throw e;
    }
    return asset;
  }

  public void markDeleted(String fqnPrefix) {
    try {
      dao.markDeletedByFqnPrefix(fqnPrefix);
      LOG.info("Marked asset {} as deleted", fqnPrefix);
    } catch (Exception e) {
      LOG.error("Failed to mark asset {} as deleted: {}", fqnPrefix, e.getMessage(), e);
      throw e;
    }
  }

  public void delete(String id) {
    try {
      dao.delete(id);
      LOG.info("Deleted asset {}", id);
    } catch (Exception e) {
      LOG.error("Failed to delete asset {}: {}", id, e.getMessage(), e);
      throw e;
    }
  }
}
