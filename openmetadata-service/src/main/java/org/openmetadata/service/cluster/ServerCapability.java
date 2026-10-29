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
package org.openmetadata.service.cluster;

/**
 * A cross-server protocol a server takes part in. A server registers every value its code has; a
 * feature that only works when every server follows the protocol waits until all of them do.
 */
public enum ServerCapability {
  /** Holds writes to the RDF serving dataset back while storage maintenance runs. */
  RDF_LIVE_WRITE_PAUSE
}
