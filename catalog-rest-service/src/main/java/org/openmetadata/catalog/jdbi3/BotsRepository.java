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

package org.openmetadata.catalog.jdbi3;

import com.fasterxml.jackson.core.JsonProcessingException;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.Bots;
import org.openmetadata.catalog.resources.bots.BotsResource.BotsList;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.ResultList;

import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.security.GeneralSecurityException;
import java.text.ParseException;
import java.util.List;
import java.util.UUID;

public class BotsRepository extends EntityRepository<Bots>{
  private final CollectionDAO dao;

  public BotsRepository(CollectionDAO dao) {
    super(Bots.class, dao.botsDAO());
    this.dao = dao; }

  public Bots insert(Bots bots) throws JsonProcessingException {
    bots.setHref(null);
    dao.botsDAO().insert(bots);
    return bots;
  }

  @Override
  public String getFullyQualifiedName(Bots entity) {
    return entity.getName();
  }

  @Override
  public Bots setFields(Bots entity, Fields fields) throws IOException, ParseException {
    return entity;
  }

  @Override
  public ResultList<Bots> getResultList(List<Bots> entities, String beforeCursor, String afterCursor, int total) throws GeneralSecurityException, UnsupportedEncodingException {
    return new BotsList(entities);
  }

  @Override
  public void validate(Bots entity) throws IOException {
    return;
  }

  @Override
  public void store(Bots entity, boolean update) throws IOException {
    dao.botsDAO().insert(entity);
  }

  @Override
  public void storeRelationships(Bots entity) throws IOException {
    return;
  }

  static class BotsEntityInterface implements EntityInterface<Bots> {
    private final Bots entity;

    BotsEntityInterface(Bots entity) {
      this.entity = entity;
    }

    @Override
    public UUID getId() {
      return entity.getId();
    }

    @Override
    public String getDescription() {
      return entity.getDescription();
    }

    @Override
    public String getDisplayName() {
      return entity.getDisplayName();
    }

    @Override
    public EntityReference getOwner() { return null; }

    @Override
    public String getFullyQualifiedName() { return entity.getName(); }

    @Override
    public List<TagLabel> getTags() { return null; }

    @Override
    public EntityReference getEntityReference() {
      return new EntityReference().withId(getId()).withName(getFullyQualifiedName()).withDescription(getDescription())
              .withDisplayName(getDisplayName()).withType(Entity.BOTS);
    }

    @Override
    public void setDescription(String description) {
      entity.setDescription(description);
    }

    @Override
    public void setDisplayName(String displayName) {
      entity.setDisplayName(displayName);
    }

    @Override
    public void setTags(List<TagLabel> tags) { }
  }
}
