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

import static org.openmetadata.service.exception.CatalogExceptionMessage.entityNotFound;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import com.google.common.util.concurrent.UncheckedExecutionException;
import java.io.IOException;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import javax.annotation.CheckForNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;

/** Subject context used for Access Control Policies */
@Slf4j
public class RoleCache {
  protected static final LoadingCache<String, Role> CACHE =
      CacheBuilder.newBuilder().maximumSize(100).expireAfterWrite(3, TimeUnit.MINUTES).build(new RoleLoader());
  protected static final LoadingCache<UUID, Role> CACHE_WITH_ID =
      CacheBuilder.newBuilder().maximumSize(100).expireAfterWrite(3, TimeUnit.MINUTES).build(new RoleLoaderWithId());

  private RoleCache() {
    // Private constructor for singleton
  }

  public static Role getRole(String roleName) {
    try {
      return CACHE.get(roleName);
    } catch (ExecutionException | UncheckedExecutionException ex) {
      throw EntityNotFoundException.byMessage(entityNotFound(Entity.ROLE, roleName));
    }
  }

  public static Role getRoleById(UUID roleId) {
    try {
      return CACHE_WITH_ID.get(roleId);
    } catch (ExecutionException | UncheckedExecutionException ex) {
      throw EntityNotFoundException.byMessage(entityNotFound(Entity.ROLE, roleId));
    }
  }

  public static void invalidateRole(UUID roleId) {
    try {
      CACHE_WITH_ID.invalidate(roleId);
    } catch (Exception ex) {
      LOG.error("Failed to invalidate cache for role {}", roleId, ex);
    }
  }

  static class RoleLoader extends CacheLoader<String, Role> {
    @Override
    public Role load(@CheckForNull String roleName) throws IOException {
      Role role = Entity.getEntityByName(Entity.ROLE, roleName, "policies", Include.NON_DELETED);
      LOG.info("Loaded role {}:{}", role.getName(), role.getId());
      return role;
    }
  }

  static class RoleLoaderWithId extends CacheLoader<UUID, Role> {
    @Override
    public Role load(@CheckForNull UUID roleId) throws IOException {
      Role role = Entity.getEntity(Entity.ROLE, roleId, "policies", Include.NON_DELETED);
      LOG.info("Loaded role {}:{}", role.getName(), role.getId());
      return role;
    }
  }

  public static void cleanUp() {
    CACHE_WITH_ID.cleanUp();
  }
}
