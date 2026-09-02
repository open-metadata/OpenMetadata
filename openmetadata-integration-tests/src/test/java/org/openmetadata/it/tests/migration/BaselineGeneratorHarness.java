/*
 *  Copyright 2021 Collate
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
package org.openmetadata.it.tests.migration;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.tests.migration.BaselineScratchSupport.GlobalState;
import org.openmetadata.it.tests.migration.BaselineScratchSupport.ScratchDatabase;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/**
 * NOT a regression test — a manually-invoked generator for the committed baseline artifact under
 * {@code bootstrap/sql/migrations/baseline/}. Run only via {@code
 * scripts/generate_migration_baseline.sh}; that script copies this harness into the pinned
 * historical source tree where the removed Flyway parser and migration classes still exist.
 *
 * <p>It chain-installs every migration strictly below 2.0.0 (Flyway v000-v015 + native
 * 1.1.0-1.13.4) into a scratch database inside the session's container, then dumps its schema as
 * the baseline. {@code @Isolated} because the chain run re-points the Entity globals.
 */
@Isolated
@EnabledIfSystemProperty(named = "baseline.generate", matches = "true")
class BaselineGeneratorHarness {

  private static final org.slf4j.Logger LOG =
      org.slf4j.LoggerFactory.getLogger(BaselineGeneratorHarness.class);

  private static final String SCRATCH_DATABASE_NAME = "baseline_generation";
  private static final String REFERENCE_REVISION_PROPERTY = "baseline.referenceRevision";
  private static final String OUTPUT_ROOT_PROPERTY = "baseline.outputRoot";

  @Test
  void generateBaselineForCurrentDialect() throws Exception {
    GlobalState globals = BaselineScratchSupport.captureGlobals();
    try {
      Path repoRoot = BaselineScratchSupport.repoRoot();
      Path nativeRoot = repoRoot.resolve(BaselineScratchSupport.realNativePath()).normalize();
      Path flywayRoot = repoRoot.resolve(BaselineScratchSupport.realFlywayPath()).normalize();
      assertHistoricalChainExists(nativeRoot, flywayRoot);
      ScratchDatabase database =
          BaselineScratchSupport.createScratchDatabase(SCRATCH_DATABASE_NAME);
      LOG.info("[BaselineGenerator] Chain-installing pre-2.0 migrations into {}", database.name());
      BaselineScratchSupport.runMigrations(
          database, nativeRoot.toString(), flywayRoot.toString(), false);
      Path baselineRoot = Path.of(requiredProperty(OUTPUT_ROOT_PROPERTY));
      LOG.info("[BaselineGenerator] Writing baseline artifact to {}", baselineRoot);
      new BaselineArtifactWriter(
              database,
              BaselineScratchSupport.currentConnectionType(),
              requiredProperty(REFERENCE_REVISION_PROPERTY))
          .write(baselineRoot);
    } finally {
      BaselineScratchSupport.restoreGlobals(globals);
    }
  }

  private void assertHistoricalChainExists(Path nativeRoot, Path flywayRoot) {
    ConnectionType connectionType = BaselineScratchSupport.currentConnectionType();
    String flywayDriver =
        connectionType == ConnectionType.MYSQL
            ? "com.mysql.cj.jdbc.Driver"
            : "org.postgresql.Driver";
    Path firstFlyway =
        flywayRoot.resolve(flywayDriver).resolve("v000__create_server_change_log.sql");
    Path lastNative =
        nativeRoot
            .resolve("1.13.4")
            .resolve(connectionType == ConnectionType.MYSQL ? "mysql" : "postgres")
            .resolve("schemaChanges.sql");
    if (!Files.isRegularFile(firstFlyway) || !Files.isRegularFile(lastNative)) {
      throw new IllegalStateException(
          "The complete historical migration chain is missing. Run the pinned"
              + " scripts/generate_migration_baseline.sh workflow instead of invoking this harness"
              + " from the current checkout.");
    }
  }

  private String requiredProperty(String name) {
    String value = System.getProperty(name);
    if (value == null || value.isBlank()) {
      throw new IllegalStateException("Missing required system property: " + name);
    }
    return value;
  }
}
