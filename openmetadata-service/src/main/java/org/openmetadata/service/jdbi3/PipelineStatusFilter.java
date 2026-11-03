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

package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.type.Status;

/**
 * The execution-status, task-name and duration filters of a pipeline status listing, applied in
 * that order. A task-name search narrows each status to its matching tasks, and the duration is
 * measured over the tasks that remain.
 *
 * @param executionStatuses the execution statuses to keep, or null for any
 * @param taskNameSearch the lower-cased text a task name must contain, or null for any
 */
record PipelineStatusFilter(
    Set<String> executionStatuses, String taskNameSearch, Long minDuration, Long maxDuration) {

  static final PipelineStatusFilter NONE = new PipelineStatusFilter(null, null, null, null);

  static PipelineStatusFilter of(String status, String search, Long minDuration, Long maxDuration) {
    Set<String> executionStatuses =
        nullOrEmpty(status)
            ? null
            : Arrays.stream(status.split(",")).map(String::trim).collect(Collectors.toSet());
    String taskNameSearch = nullOrEmpty(search) ? null : search.toLowerCase(Locale.ROOT);
    return new PipelineStatusFilter(executionStatuses, taskNameSearch, minDuration, maxDuration);
  }

  boolean isEmpty() {
    return executionStatuses == null
        && taskNameSearch == null
        && minDuration == null
        && maxDuration == null;
  }

  /** The status as a listing returns it, or empty when it does not match. */
  Optional<PipelineStatus> apply(PipelineStatus status) {
    return Optional.of(status)
        .filter(this::hasWantedExecutionStatus)
        .flatMap(this::narrowToSearchedTasks)
        .filter(this::hasWantedDuration);
  }

  /** Time from the earliest task start to the latest task end, or null without task timings. */
  static Long actualDuration(PipelineStatus status) {
    List<Status> tasks = listOrEmpty(status.getTaskStatus());
    Long earliestStart =
        tasks.stream()
            .map(Status::getStartTime)
            .filter(Objects::nonNull)
            .min(Long::compare)
            .orElse(null);
    Long latestEnd =
        tasks.stream()
            .map(Status::getEndTime)
            .filter(Objects::nonNull)
            .max(Long::compare)
            .orElse(null);
    boolean hasTimings = earliestStart != null && latestEnd != null && latestEnd >= earliestStart;
    return hasTimings ? latestEnd - earliestStart : null;
  }

  private boolean hasWantedExecutionStatus(PipelineStatus status) {
    return executionStatuses == null
        || (status.getExecutionStatus() != null
            && executionStatuses.contains(status.getExecutionStatus().value()));
  }

  private Optional<PipelineStatus> narrowToSearchedTasks(PipelineStatus status) {
    if (taskNameSearch == null) {
      return Optional.of(status);
    }
    List<Status> matchingTasks =
        listOrEmpty(status.getTaskStatus()).stream().filter(this::isSearchedTask).toList();
    return matchingTasks.isEmpty()
        ? Optional.empty()
        : Optional.of(status.withTaskStatus(matchingTasks));
  }

  private boolean isSearchedTask(Status task) {
    return task.getName() != null
        && task.getName().toLowerCase(Locale.ROOT).contains(taskNameSearch);
  }

  private boolean hasWantedDuration(PipelineStatus status) {
    if (minDuration == null && maxDuration == null) {
      return true;
    }
    Long duration = actualDuration(status);
    return duration != null
        && (minDuration == null || duration >= minDuration)
        && (maxDuration == null || duration <= maxDuration);
  }
}
