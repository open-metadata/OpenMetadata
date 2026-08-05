/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.tasks;

/**
 * Stage and transition identifiers declared by the {@code TestCaseResolutionTaskWorkflow} seed
 * definition. Kept in one place so the code paths that mirror or drive that workflow —
 * {@code IncidentTcrsSyncHandler} and the incident auto-assignment path — cannot drift apart.
 */
public final class IncidentWorkflowStages {
  public static final String NEW_STAGE_ID = "new";
  public static final String ACK_STAGE_ID = "ack";
  public static final String ASSIGNED_STAGE_ID = "assigned";
  public static final String RESOLVED_STAGE_ID = "resolved";

  public static final String ASSIGN_TRANSITION_ID = "assign";

  private IncidentWorkflowStages() {}
}
