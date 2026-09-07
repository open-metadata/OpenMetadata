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

import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public final class PostCommitActionQueue {
  private static final ThreadLocal<List<Runnable>> ACTIONS = new ThreadLocal<>();

  private PostCommitActionQueue() {}

  public static boolean begin() {
    final boolean isOwner = ACTIONS.get() == null;
    if (isOwner) {
      ACTIONS.set(new ArrayList<>());
    }
    return isOwner;
  }

  public static int checkpoint() {
    final List<Runnable> actions = ACTIONS.get();
    return actions == null ? 0 : actions.size();
  }

  public static void rollbackToCheckpoint(final int checkpoint) {
    final List<Runnable> actions = ACTIONS.get();
    if (actions != null) {
      while (actions.size() > checkpoint) {
        actions.removeLast();
      }
    }
  }

  public static void runOrDefer(final Runnable action) {
    final List<Runnable> actions = ACTIONS.get();
    if (actions == null) {
      action.run();
    } else {
      actions.add(action);
    }
  }

  public static List<Runnable> drain() {
    final List<Runnable> actions = ACTIONS.get();
    ACTIONS.remove();
    return actions == null ? List.of() : List.copyOf(actions);
  }

  public static void run(final List<Runnable> actions) {
    actions.forEach(PostCommitActionQueue::runGuarded);
  }

  public static void clear() {
    ACTIONS.remove();
  }

  private static void runGuarded(final Runnable action) {
    try {
      action.run();
    } catch (RuntimeException exception) {
      LOG.warn("Post-commit action failed", exception);
    }
  }
}
