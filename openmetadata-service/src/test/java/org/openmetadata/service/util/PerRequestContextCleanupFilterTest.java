/*
 *  Copyright 2026 Collate
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
package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.openmetadata.schema.type.Include.NON_DELETED;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.ImpersonationContext;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

class PerRequestContextCleanupFilterTest {

  private static final String BOT_NAME = "ingestion-bot";
  private static final Fields FIELDS = new Fields(Set.of("authenticationMechanism"));
  private static final RelationIncludes INCLUDES = RelationIncludes.fromInclude(NON_DELETED);

  private final PerRequestContextCleanupFilter filter = new PerRequestContextCleanupFilter();

  @AfterEach
  void cleanup() {
    PerRequestContextCleaner.clear();
  }

  @Test
  void stateARequestLeavesOnTheThreadIsGoneWhenItEnds() throws Exception {
    filter.doFilter(request(), response(), (req, resp) -> leaveStateOnThread());

    assertThreadIsClean();
  }

  @Test
  void stateIsGoneEvenWhenTheRequestFails() {
    FilterChain failingChain =
        (req, resp) -> {
          leaveStateOnThread();
          throw new ServletException("handler failed");
        };

    assertThrows(
        ServletException.class, () -> filter.doFilter(request(), response(), failingChain));

    assertThreadIsClean();
  }

  @Test
  void aRequestDoesNotSeeStateLeftOnTheThreadBeforeIt() throws Exception {
    leaveStateOnThread();

    filter.doFilter(request(), response(), (req, resp) -> assertThreadIsClean());
  }

  private static void leaveStateOnThread() {
    ImpersonationContext.setImpersonatedBy(BOT_NAME);
    RequestEntityCache.putByName(
        Entity.USER,
        BOT_NAME,
        FIELDS,
        INCLUDES,
        false,
        new User().withId(UUID.randomUUID()).withName(BOT_NAME),
        User.class);
  }

  private static void assertThreadIsClean() {
    assertNull(ImpersonationContext.getImpersonatedBy());
    assertNull(
        RequestEntityCache.getByName(Entity.USER, BOT_NAME, FIELDS, INCLUDES, false, User.class));
  }

  private static ServletRequest request() {
    return mock(ServletRequest.class);
  }

  private static ServletResponse response() {
    return mock(ServletResponse.class);
  }
}
