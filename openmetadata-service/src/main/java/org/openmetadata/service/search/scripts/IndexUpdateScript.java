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
package org.openmetadata.service.search.scripts;

import java.util.Map;
import org.openmetadata.service.search.capability.EntityIndexCapability;

/**
 * A painless script targeted at an OpenSearch / Elasticsearch index, paired with the entity-type
 * capabilities it requires. Sealed so the script catalogue is closed and discoverable; each
 * implementation declares both its rendered painless source and the {@code compatibleWith} check
 * that prevents misapplication.
 *
 * <p>Prior to this abstraction the soft-delete script was a {@code String.format} template in
 * {@code SearchClient} with no notion of which indexes it was safe to run against — that
 * directly caused the Incident Manager Jackson error when {@code deleted} got stamped onto
 * {@code testCaseResolutionStatus} docs whose schema declares no such field. Adding a new
 * script type now requires answering "which capabilities does the target index need" before
 * it can compile.
 */
public sealed interface IndexUpdateScript permits SoftDeleteScript {

  String painless();

  Map<String, Object> params();

  boolean compatibleWith(EntityIndexCapability capability);
}
