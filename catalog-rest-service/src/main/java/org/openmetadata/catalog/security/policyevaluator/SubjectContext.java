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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import com.google.common.util.concurrent.UncheckedExecutionException;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import javax.annotation.CheckForNull;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.jdbi3.EntityRepository;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityUtil.Fields;

/** Subject context used for Access Control Policies */
@Slf4j
public class SubjectContext {
  // Cache used for caching subject context for a user
  private static final LoadingCache<String, SubjectContext> CACHE =
      CacheBuilder.newBuilder().maximumSize(1000).expireAfterAccess(1, TimeUnit.MINUTES).build(new SubjectLoader());
  private static final EntityRepository<User> USER_REPOSITORY = Entity.getEntityRepository(Entity.USER);
  private static final Fields SUBJECT_FIELDS = USER_REPOSITORY.getFields("roles, teams");

  private final User user;

  public SubjectContext(User user) {
    this.user = user;
  }

  public static SubjectContext getSubjectContext(String userName) throws EntityNotFoundException {
    try {
      return CACHE.get(userName);
    } catch (ExecutionException | UncheckedExecutionException ex) {
      throw new EntityNotFoundException(ex.getMessage());
    }
  }

  public static void cleanup() {
    CACHE.invalidateAll();
  }

  public static void invalidateKey(String userName) {
    CACHE.invalidate(userName);
  }

  public boolean isAdmin() {
    return Boolean.TRUE.equals(user.getIsAdmin());
  }

  public boolean isBot() {
    return Boolean.TRUE.equals(user.getIsBot());
  }

  public boolean isOwner(EntityReference owner) {
    if (owner == null) {
      return false;
    }
    if (owner.getType().equals(Entity.USER) && owner.getName().equals(user.getName())) {
      return true; // Owner is same as user.
    }
    if (owner.getType().equals(Entity.TEAM)) {
      for (EntityReference userTeam : user.getTeams()) {
        if (userTeam.getName().equals(owner.getName())) {
          return true; // Owner is a team, and the user is part of this team.
        }
      }
    }
    return false;
  }

  public List<EntityReference> getAllRoles() {
    List<EntityReference> allRoles = new ArrayList<>(listOrEmpty(user.getRoles()));
    allRoles.addAll(listOrEmpty(user.getInheritedRoles()));
    return allRoles.stream().distinct().collect(Collectors.toList()); // Remove duplicates
  }

  static class SubjectLoader extends CacheLoader<String, SubjectContext> {
    @Override
    public SubjectContext load(@CheckForNull String userName) throws IOException {
      User user = USER_REPOSITORY.getByName(null, userName, SUBJECT_FIELDS);
      user.getRoles().forEach(r -> LOG.debug("User " + user.getRoles() + " role " + r));
      return new SubjectContext(user);
    }
  }
}
