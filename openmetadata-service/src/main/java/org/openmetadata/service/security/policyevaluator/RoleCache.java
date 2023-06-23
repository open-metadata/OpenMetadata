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
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.RoleRepository;
import org.openmetadata.service.util.EntityUtil.Fields;

/** Subject context used for Access Control Policies */
@Slf4j
public class RoleCache {
  private static final RoleCache INSTANCE = new RoleCache();
  private static volatile boolean initialized = false;
  protected static LoadingCache<String, Role> roleCache;
  protected static LoadingCache<UUID, Role> roleCacheWithId;
  private static RoleRepository roleRepository;
  private static Fields fields;

  public static RoleCache getInstance() {
    return INSTANCE;
  }

  /** To be called only once during the application start from DefaultAuthorizer */
  public static void initialize() {
    if (!initialized) {
      roleCache =
          CacheBuilder.newBuilder().maximumSize(100).expireAfterWrite(3, TimeUnit.MINUTES).build(new RoleLoader());
      roleCacheWithId =
          CacheBuilder.newBuilder()
              .maximumSize(100)
              .expireAfterWrite(3, TimeUnit.MINUTES)
              .build(new RoleLoaderWithId());
      roleRepository = (RoleRepository) Entity.getEntityRepository(Entity.ROLE);
      fields = roleRepository.getFields("policies");
      initialized = true;
    }
  }

  public Role getRole(String roleName) {
    try {
      return roleCache.get(roleName);
    } catch (ExecutionException | UncheckedExecutionException ex) {
      throw EntityNotFoundException.byMessage(entityNotFound(Entity.ROLE, roleName));
    }
  }

  public Role getRoleById(UUID roleId) {
    try {
      return roleCacheWithId.get(roleId);
    } catch (ExecutionException | UncheckedExecutionException ex) {
      throw EntityNotFoundException.byMessage(entityNotFound(Entity.ROLE, roleId));
    }
  }

  public void invalidateRole(UUID roleId) {
    try {
      roleCacheWithId.invalidate(roleId);
    } catch (Exception ex) {
      LOG.error("Failed to invalidate cache for role {}", roleId, ex);
    }
  }

  static class RoleLoader extends CacheLoader<String, Role> {
    @Override
    public Role load(@CheckForNull String roleName) throws IOException {
      Role role = roleRepository.getByName(null, roleName, fields);
      LOG.info("Loaded role {}:{}", role.getName(), role.getId());
      return role;
    }
  }

  static class RoleLoaderWithId extends CacheLoader<UUID, Role> {
    @Override
    public Role load(@CheckForNull UUID roleId) throws IOException {
      Role role = roleRepository.get(null, roleId, fields);
      LOG.info("Loaded role {}:{}", role.getName(), role.getId());
      return role;
    }
  }

  public static void cleanUp() {
    roleCacheWithId.cleanUp();
    initialized = false;
  }
}
