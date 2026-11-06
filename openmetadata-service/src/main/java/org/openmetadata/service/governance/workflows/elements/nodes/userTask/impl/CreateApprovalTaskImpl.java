/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl;

import org.openmetadata.service.governance.workflows.elements.nodes.userTask.CreateTask;

/**
 * Compatibility shim for pre-Task-V2 Flowable process definitions.
 *
 * <p>Task V2 (v200, PR #25894) replaced this listener with {@link CreateTask}. Fresh WD deployments
 * reference the new class, but any Flowable process instance that was deployed <em>before</em> the
 * v200 upgrade still carries this class name frozen in its {@code ACT_RE_PROCDEF} row. When such an
 * instance advances into a userTask node, Flowable resolves the createListener implementation by
 * FQN — a missing class would raise {@code ClassNotFoundException} and permanently stall the
 * process instance.
 *
 * <p>The subclass keeps the FQN alive at the historical package path and inherits every field
 * extension + {@code notify} behavior from {@link CreateTask}. Since {@link CreateTask} tolerates a
 * {@code null} {@code transitionMetadataExpr} / {@code stageIdExpr} / {@code taskStatusExpr}, older
 * BPMN that only injected the pre-V2 field subset ({@code inputNamespaceMapExpr},
 * {@code approvalThresholdExpr}, {@code rejectionThresholdExpr}) continues to work.
 *
 * <p>Remove once no supported upgrade path can leave an ACT_RE_PROCDEF referencing this FQN.
 */
@Deprecated(forRemoval = true, since = "2.0")
public class CreateApprovalTaskImpl extends CreateTask {}
