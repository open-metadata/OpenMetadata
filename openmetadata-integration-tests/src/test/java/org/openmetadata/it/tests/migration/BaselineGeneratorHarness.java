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

import java.nio.file.Path;
import java.nio.file.Paths;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.tests.migration.BaselineScratchSupport.GlobalState;
import org.openmetadata.it.tests.migration.BaselineScratchSupport.ScratchDatabase;

/**
 * NOT a regression test — a manually-invoked generator for the committed baseline artifact under
 * {@code bootstrap/sql/migrations/baseline/}. Run via {@code scripts/generate_migration_baseline.sh}
 * (or {@code mvn test -pl openmetadata-integration-tests -Dtest=BaselineGeneratorHarness
 * -Dbaseline.generate=true}, once per dialect via {@code -DdatabaseType=mysql}).
 *
 * <p>It chain-installs every migration strictly below 2.0.0 (Flyway v000-v015 + native
 * 1.1.0-1.13.4) into a scratch database inside the session's container, then dumps schema + seed
 * data as the baseline. {@code @Isolated} because the chain run re-points the Entity globals.
 */
@Isolated
@EnabledIfSystemProperty(named = "baseline.generate", matches = "true")
class BaselineGeneratorHarness {

  private static final org.slf4j.Logger LOG =
      org.slf4j.LoggerFactory.getLogger(BaselineGeneratorHarness.class);

  private static final String SCRATCH_DATABASE_NAME = "baseline_generation";

  @TempDir Path tempDir;

  @Test
  void generateBaselineForCurrentDialect() throws Exception {
    GlobalState globals = BaselineScratchSupport.captureGlobals();
    try {
      ScratchDatabase database =
          BaselineScratchSupport.createScratchDatabase(SCRATCH_DATABASE_NAME);
      Path preTwoZeroRoot = BaselineScratchSupport.buildPreTwoZeroNativeRoot(tempDir);
      LOG.info("[BaselineGenerator] Chain-installing pre-2.0 migrations into {}", database.name());
      BaselineScratchSupport.runMigrations(database, preTwoZeroRoot.toString(), false);
      Path baselineRoot = repoRoot().resolve("bootstrap/sql/migrations/baseline");
      LOG.info("[BaselineGenerator] Writing baseline artifact to {}", baselineRoot);
      new BaselineArtifactWriter(database, BaselineScratchSupport.currentConnectionType())
          .write(baselineRoot);
      exportDataInsightChartSeeds(database);
    } finally {
      BaselineScratchSupport.restoreGlobals(globals);
    }
  }

  /**
   * The system Data Insight charts are the only rows a chain install leaves behind that the
   * application does not create for itself; export them as seed JSON so it does. Dialect
   * independent — running it from either dialect's generation produces the same files.
   */
  private void exportDataInsightChartSeeds(ScratchDatabase database) throws Exception {
    Path seedDirectory =
        repoRoot().resolve("openmetadata-service/src/main/resources/json/data/dataInsight/custom");
    int exported = new DataInsightChartSeedExporter(database).export(seedDirectory);
    LOG.info(
        "[BaselineGenerator] Exported {} Data Insight chart seeds to {}", exported, seedDirectory);
  }

  private Path repoRoot() {
    Path workingDir = Paths.get(System.getProperty("user.dir"));
    return workingDir.endsWith("openmetadata-integration-tests")
        ? workingDir.getParent()
        : workingDir;
  }
}
