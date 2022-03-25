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

import com.codahale.metrics.health.HealthCheck;
import java.io.IOException;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.jdbi3.ListFilter;
import org.openmetadata.catalog.jdbi3.UserRepository;
import org.openmetadata.catalog.util.EntityUtil.Fields;

@Slf4j
public class CatalogHealthCheck extends HealthCheck {
  private final UserRepository userRepository;

  public CatalogHealthCheck(Jdbi jdbi) {
    super();
    CollectionDAO repo = jdbi.onDemand(CollectionDAO.class);
    this.userRepository = new UserRepository(repo);
  }

  @Override
  protected Result check() throws Exception {
    try {
      ListFilter filter = new ListFilter();
      userRepository.listAfter(null, Fields.EMPTY_FIELDS, filter, 1, null);
      return Result.healthy();
    } catch (IOException e) {
      LOG.error("Health check error {}", e.getMessage());
      return Result.unhealthy(e.getMessage());
    }
  }
}
