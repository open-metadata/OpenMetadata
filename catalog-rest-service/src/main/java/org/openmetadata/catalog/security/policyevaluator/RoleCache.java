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

package org.openmetadata.catalog.security.policyevaluator;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import com.google.common.util.concurrent.UncheckedExecutionException;
import java.io.IOException;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import javax.annotation.CheckForNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.teams.Role;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.jdbi3.EntityRepository;
import org.openmetadata.catalog.util.EntityUtil.Fields;

/** Subject context used for Access Control Policies */
@Slf4j
public class RoleCache {
  private static final LoadingCache<UUID, Role> ROLE_CACHE =
      CacheBuilder.newBuilder().maximumSize(100).build(new RoleLoader());

  public static Role getRole(UUID roleId) {
    try {
      return ROLE_CACHE.get(roleId);
    } catch (ExecutionException | UncheckedExecutionException ex) {
      throw new EntityNotFoundException(ex.getMessage());
    }
  }

  public static void invalidateRole(UUID roleId) {
    try {
      ROLE_CACHE.invalidate(roleId);
    } catch (Exception ex) {
      LOG.error("Failed to invalidate cache for role {}", roleId, ex);
    }
  }

  static class RoleLoader extends CacheLoader<UUID, Role> {
    private static final EntityRepository<Role> ROLE_REPOSITORY = Entity.getEntityRepository(Entity.ROLE);
    private static final Fields FIELDS = ROLE_REPOSITORY.getFields("policies");

    @Override
    public Role load(@CheckForNull UUID roleId) throws IOException {
      Role role = ROLE_REPOSITORY.get(null, roleId.toString(), FIELDS);
      LOG.info("Loaded role {}:{}", role.getName(), role.getId());
      return role;
    }
  }
}
