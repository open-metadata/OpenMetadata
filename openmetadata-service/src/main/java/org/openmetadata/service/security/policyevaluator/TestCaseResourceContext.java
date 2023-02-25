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

package org.openmetadata.service.security.policyevaluator;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import lombok.Builder;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.TestCaseRepository;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.util.EntityUtil;

/**
 * Builds ResourceContext lazily. ResourceContext includes all the attributes of a resource a user is trying to access
 * to be used for evaluating Access Control policies.
 *
 * <p>As multiple threads don't access this, the class is not thread-safe by design.
 */
@Builder
public class TestCaseResourceContext implements ResourceContextInterface {
  private final EntityLink entityLink;
  private final UUID id;
  private final String name;
  private EntityInterface entity; // Will be lazily initialized to the entity that has this test case

  @Override
  public String getResource() {
    return entityLink.getEntityType();
  }

  @Override
  public EntityReference getOwner() throws IOException {
    resolveEntity();
    return entity == null ? null : entity.getOwner();
  }

  @Override
  public List<TagLabel> getTags() throws IOException {
    resolveEntity();
    return entity == null ? null : listOrEmpty(entity.getTags());
  }

  @Override
  public EntityInterface getEntity() throws IOException {
    return resolveEntity();
  }

  private EntityInterface resolveEntity() throws IOException {
    if (entity == null) {
      if (entityLink != null) {
        entity = resolveEntityByEntityLink(entityLink);
      } else if (id != null) {
        entity = resolveEntityById(id);
      } else {
        entity = resolveEntityByName(name);
      }
    }
    return entity;
  }

  private static EntityInterface resolveEntityByEntityLink(EntityLink entityLink) throws IOException {
    EntityRepository<? extends EntityInterface> entityRepository =
        Entity.getEntityRepository(entityLink.getEntityType());
    String fields = "";
    if (entityRepository.isSupportsOwner()) {
      fields = EntityUtil.addField(fields, Entity.FIELD_OWNER);
    }
    if (entityRepository.isSupportsTags()) {
      fields = EntityUtil.addField(fields, Entity.FIELD_TAGS);
    }
    return entityRepository.getByName(null, entityLink.getEntityFQN(), entityRepository.getFields(fields));
  }

  private static EntityInterface resolveEntityById(UUID id) throws IOException {
    TestCaseRepository dao = (TestCaseRepository) Entity.getEntityRepository(Entity.TEST_CASE);
    TestCase testCase = dao.get(null, id, dao.getFields("entityLink"), Include.ALL);
    return resolveEntityByEntityLink(EntityLink.parse(testCase.getEntityLink()));
  }

  private static EntityInterface resolveEntityByName(String fqn) throws IOException {
    if (fqn == null) return null;
    TestCaseRepository dao = (TestCaseRepository) Entity.getEntityRepository(Entity.TEST_CASE);
    TestCase testCase = dao.getByName(null, fqn, dao.getFields("entityLink"), Include.ALL);
    return resolveEntityByEntityLink(EntityLink.parse(testCase.getEntityLink()));
  }
}
