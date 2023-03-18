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
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.RoleRepository;
import org.openmetadata.service.util.EntityUtil.Fields;

/** Subject context used for Access Control Policies */
@Slf4j
public class RoleCache {
  private static final RoleCache INSTANCE = new RoleCache();
  private static volatile boolean INITIALIZED = false;
  protected static LoadingCache<UUID, Role> ROLE_CACHE;
  private static RoleRepository ROLE_REPOSITORY;
  private static Fields FIELDS;

  public static RoleCache getInstance() {
    return INSTANCE;
  }

  /** To be called only once during the application start from DefaultAuthorizer */
  public static void initialize() {
    if (!INITIALIZED) {
      ROLE_CACHE =
              CacheBuilder.newBuilder().maximumSize(100).expireAfterWrite(3, TimeUnit.MINUTES).build(new RoleLoader());
      ROLE_REPOSITORY = (RoleRepository) Entity.getEntityRepository(Entity.ROLE);
      FIELDS = ROLE_REPOSITORY.getFields("policies");
      INITIALIZED = true;
    }
  }

  public Role getRole(UUID roleId) {
    try {
      return ROLE_CACHE.get(roleId);
    } catch (ExecutionException | UncheckedExecutionException ex) {
      throw new EntityNotFoundException(ex.getMessage());
    }
  }

  public void invalidateRole(UUID roleId) {
    try {
      ROLE_CACHE.invalidate(roleId);
    } catch (Exception ex) {
      LOG.error("Failed to invalidate cache for role {}", roleId, ex);
    }
  }

  static class RoleLoader extends CacheLoader<UUID, Role> {
    @Override
    public Role load(@CheckForNull UUID roleId) throws IOException {
      Role role = ROLE_REPOSITORY.get(null, roleId, FIELDS);
      LOG.info("Loaded role {}:{}", role.getName(), role.getId());
      return role;
    }
  }

  public static void cleanUp() {
    ROLE_CACHE.cleanUp();
    INITIALIZED = false;
  }
}
