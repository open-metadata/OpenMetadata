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

package org.openmetadata.service.governance.approval;

import java.util.UUID;

/**
 * Identifies the approved revision an apply is publishing. It authorizes nothing by itself: the
 * gate re-reads the request inside the apply transaction and refuses unless it is Approved for
 * exactly this revision and entity.
 */
public record ApprovedApplication(
    UUID changeRequestId, UUID revisionId, UUID entityId, String requestedBy) {}
