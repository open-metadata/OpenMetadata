/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.resources.ai;

import java.util.List;
import org.openmetadata.schema.type.EntityReference;

/**
 * The assembled audit pack snapshot: report provenance plus every in-scope AI asset with its
 * compliance record set. Serialised verbatim as the JSON artifact and handed to
 * {@link AuditPackPdfRenderer} so both artifacts describe exactly the same point-in-time walk.
 *
 * <p>Public because renderer implementations live outside this package.
 */
public record AuditPackDocument(
    String reportId,
    String name,
    String scope,
    EntityReference framework,
    EntityReference scopeTarget,
    Long asOfDate,
    long generatedAt,
    List<AuditPackAsset> assets) {}
