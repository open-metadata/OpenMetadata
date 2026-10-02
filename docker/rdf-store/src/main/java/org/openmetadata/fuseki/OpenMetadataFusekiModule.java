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
package org.openmetadata.fuseki;

import java.util.Set;
import org.apache.jena.fuseki.main.FusekiServer;
import org.apache.jena.fuseki.main.sys.FusekiAutoModule;
import org.apache.jena.fuseki.server.Operation;
import org.apache.jena.rdf.model.Model;

public final class OpenMetadataFusekiModule implements FusekiAutoModule {
  @Override
  public String name() {
    return "OpenMetadata bounded Graph Store writes";
  }

  @Override
  public void prepare(
      final FusekiServer.Builder builder, final Set<String> datasetNames, final Model config) {
    builder.registerOperation(Operation.GSP_RW, new BoundedGraphStore());
  }
}
