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

package org.openmetadata.catalog;

import com.codahale.metrics.health.HealthCheck;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.UserRepository3;
import org.openmetadata.catalog.jdbi3.UserRepositoryHelper;
import org.openmetadata.catalog.util.EntityUtil;

import java.io.IOException;

import static org.openmetadata.catalog.resources.teams.UserResource.FIELD_LIST;

public class CatalogHealthCheck extends HealthCheck {
  private final UserRepositoryHelper userRepositoryHelper;
  private final EntityUtil.Fields fields = new EntityUtil.Fields(FIELD_LIST, "profile");

  public CatalogHealthCheck(CatalogApplicationConfig config, Jdbi jdbi) {
    super();
    CollectionDAO repo = jdbi.onDemand(CollectionDAO.class);
    this.userRepositoryHelper = new UserRepositoryHelper(repo);
  }

  @Override
  protected Result check() throws Exception {
    try {
      userRepositoryHelper.listAfter(fields, null, 1, "");
      return Result.healthy();
    } catch (IOException e) {
      return Result.unhealthy(e.getMessage());
    }
  }
}
