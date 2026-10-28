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

import java.nio.file.Path;
import java.util.Map;
import java.util.Set;
import org.apache.jena.fuseki.main.FusekiServer;
import org.apache.jena.fuseki.main.sys.FusekiAutoModule;
import org.apache.jena.fuseki.server.Operation;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.riot.WebContent;
import org.openmetadata.fuseki.storage.GuardedUpdate;
import org.openmetadata.fuseki.storage.StorageGuard;
import org.openmetadata.fuseki.storage.StorageServlet;

/**
 * Bounded Graph Store writes, a free-space guard in front of every write, and the storage report
 * OpenMetadata reads to decide when to compact.
 */
public final class OpenMetadataFusekiModule implements FusekiAutoModule {
  static final String STORAGE_ROOT = "OPENMETADATA_STORAGE_ROOT";

  @Override
  public String name() {
    return "OpenMetadata bounded Graph Store writes and storage guard";
  }

  @Override
  public void prepare(
      final FusekiServer.Builder builder, final Set<String> datasetNames, final Model config) {
    final Map<String, String> environment = System.getenv();
    final Path databases = storageRoot(environment);
    final StorageGuard guard = StorageGuard.forVolume(databases, environment);
    builder.registerOperation(Operation.GSP_RW, new BoundedGraphStore(guard::requireWritable));
    // Fuseki routes a POST to the dataset URL by content type; registering the operation without
    // one would drop that route and answer SPARQL updates sent there with 415.
    builder.registerOperation(
        Operation.Update, WebContent.contentTypeSPARQLUpdate, new GuardedUpdate(guard));
    builder.addServlet(StorageServlet.PATH_SPEC, new StorageServlet(databases, guard));
  }

  /** The directory holding one TDB2 directory per dataset: $FUSEKI_BASE/databases by default. */
  static Path storageRoot(final Map<String, String> environment) {
    final String root = environment.get(STORAGE_ROOT);
    return root == null || root.isBlank()
        ? Path.of(environment.getOrDefault("FUSEKI_BASE", "/fuseki")).resolve("databases")
        : Path.of(root);
  }
}
