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

import java.io.IOException;
import java.net.URI;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.Type;
import org.openmetadata.catalog.resources.types.TypeResource;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.FullyQualifiedName;

public class TypeRepository extends EntityRepository<Type> {
  // TODO fix this
  private static final String UPDATE_FIELDS = "";
  private static final String PATCH_FIELDS = "";

  public TypeRepository(CollectionDAO dao) {
    super(TypeResource.COLLECTION_PATH, Entity.TYPE, Type.class, dao.typeEntityDAO(), dao, PATCH_FIELDS, UPDATE_FIELDS);
    allowEdits = true;
  }

  @Override
  public Type setFields(Type attribute, Fields fields) throws IOException {
    return attribute;
  }

  @Override
  public void prepare(Type type) throws IOException {
    setFullyQualifiedName(type);
  }

  @Override
  public void storeEntity(Type type, boolean update) throws IOException {
    URI href = type.getHref();
    type.withHref(null);
    store(type.getId(), type, update);
    type.withHref(href);
  }

  @Override
  public void storeRelationships(Type type) {
    // Nothing to do
  }

  @Override
  public EntityUpdater getUpdater(Type original, Type updated, Operation operation) {
    return new AttributeUpdater(original, updated, operation);
  }

  /** Handles entity updated from PUT and POST operation. */
  public class AttributeUpdater extends EntityUpdater {
    public AttributeUpdater(Type original, Type updated, Operation operation) {
      super(original, updated, operation);
    }
  }
}
