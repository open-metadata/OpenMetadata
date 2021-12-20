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

package org.openmetadata.catalog;

import static org.openmetadata.catalog.resources.teams.UserResource.FIELD_LIST;
import static org.openmetadata.catalog.resources.teams.UserResource.LOG;

import com.codahale.metrics.health.HealthCheck;
import java.io.IOException;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.UserRepository;
import org.openmetadata.catalog.util.EntityUtil;

public class CatalogHealthCheck extends HealthCheck {
  private final UserRepository userRepository;
  private final EntityUtil.Fields fields = new EntityUtil.Fields(FIELD_LIST, "profile");

  public CatalogHealthCheck(CatalogApplicationConfig config, Jdbi jdbi) {
    super();
    CollectionDAO repo = jdbi.onDemand(CollectionDAO.class);
    this.userRepository = new UserRepository(repo);
  }

  @Override
  protected Result check() throws Exception {
    try {
      userRepository.listAfter(null, fields, null, 1, null);
      return Result.healthy();
    } catch (IOException e) {
      LOG.error("Health check error {}", e.getMessage());
      return Result.unhealthy(e.getMessage());
    }
  }
}
