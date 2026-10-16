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

package org.openmetadata.mcp.tools;

/**
 * Raised when a knowledge-graph tool is called on a server where the RDF triplestore is turned off.
 *
 * <p>A deployment state, not a broken backend. A bare {@code IllegalStateException} matched no rule
 * in {@code DefaultToolContext.CATEGORY_MATCHERS}, so it fell through to 500 and {@code
 * McpResponseTrim#summarizeFailure} told the caller the backend was faulty and a narrower request
 * might help - both untrue. The distinct type gives the category table something to match.
 */
class RdfNotEnabledException extends IllegalStateException {

  private static final String MESSAGE =
      "The RDF knowledge graph is not enabled on this OpenMetadata server, so knowledge-graph "
          + "tools cannot run. An administrator enables it by setting rdf.enabled=true "
          + "(RDF_ENABLED) and pointing rdf.remoteEndpoint at a running triplestore. Use "
          + "search_metadata or get_entity_lineage for catalog questions instead.";

  RdfNotEnabledException() {
    super(MESSAGE);
  }
}
