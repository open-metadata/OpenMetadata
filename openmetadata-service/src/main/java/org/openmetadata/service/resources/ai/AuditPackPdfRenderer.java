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

import java.util.Optional;
import org.openmetadata.schema.entity.ai.AuditReportManifest;

/**
 * Extension point for turning an assembled audit pack into the auditor-facing PDF artifact.
 * Rendering is pluggable because the document is a branded deliverable: distributions supply their
 * own template, fonts, and identity rather than sharing one hardcoded layout here.
 *
 * <p>Register an implementation at server startup — before
 * {@link AuditPackGenerator#recoverInterruptedReports()} runs — via
 * {@link AuditPackGenerator#setPdfRenderer(AuditPackPdfRenderer)}. With no renderer registered,
 * {@code Pdf} and {@code Both} packs still complete, carrying the JSON artifact alone.
 *
 * <p>Implementations must not throw. An audit pack is a long-running async job whose failure
 * surfaces to the requester as a failed report, so a template or font problem must degrade to
 * {@link Optional#empty()} — the pack then completes with its JSON evidence intact.
 */
@FunctionalInterface
public interface AuditPackPdfRenderer {

  /**
   * Renders {@code document} as PDF bytes, or returns empty when rendering is not possible. The
   * manifest carries the same counts the JSON artifact reports, so both artifacts agree.
   */
  Optional<byte[]> render(AuditPackDocument document, AuditReportManifest manifest);
}
