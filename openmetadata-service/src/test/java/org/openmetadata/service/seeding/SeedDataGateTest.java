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

package org.openmetadata.service.seeding;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.configuration.StartupChecksums;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.config.StartupConfiguration;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.seeding.RequiredSeedRows.SeedTable;

class SeedDataGateTest {

  @AfterEach
  void resetGate() {
    SeedDataGate.getInstance().reset();
  }

  @Test
  void successfulFingerprintStampSkipsTheNextWarmBoot() {
    SystemRepository repository = mock(SystemRepository.class);
    SeedDataGate gate = SeedDataGate.getInstance();
    gate.configure(new StartupConfiguration(), repository);

    assertTrue(gate.shouldSeed());
    verify(repository, never()).hasRequiredSeedRows(any());
    gate.stampIfClean();

    ArgumentCaptor<Settings> settingCaptor = ArgumentCaptor.forClass(Settings.class);
    verify(repository).updateSetting(settingCaptor.capture());
    Settings stampedSetting = settingCaptor.getValue();
    StartupChecksums checksums = (StartupChecksums) stampedSetting.getConfigValue();
    assertNotNull(checksums.getSeedDataFingerprint());

    SystemRepository warmBootRepository = mock(SystemRepository.class);
    when(warmBootRepository.getConfigWithKey(SettingsType.STARTUP_CHECKSUMS.toString()))
        .thenReturn(stampedSetting);
    when(warmBootRepository.hasRequiredSeedRows(any())).thenReturn(true);
    gate.configure(new StartupConfiguration(), warmBootRepository);

    assertFalse(gate.shouldSeed());
    assertFalse(gate.shouldSeed());
    ArgumentCaptor<RequiredSeedRows> seedRowsCaptor =
        ArgumentCaptor.forClass(RequiredSeedRows.class);
    verify(warmBootRepository, times(1)).hasRequiredSeedRows(seedRowsCaptor.capture());
    RequiredSeedRows seedRows = seedRowsCaptor.getValue();
    assertTrue(seedRows.identities(SeedTable.TYPE).contains("table"));
    assertTrue(seedRows.identities(SeedTable.POLICY).contains("OrganizationPolicy"));
    assertFalse(seedRows.identities(SeedTable.POLICY).contains("DomainOnlyAccessPolicy"));
    assertTrue(seedRows.identities(SeedTable.ROLE).contains("DataConsumer"));
    assertFalse(seedRows.identities(SeedTable.ROLE).contains("DomainOnlyAccessRole"));
    assertTrue(seedRows.identities(SeedTable.TASK_FORM_SCHEMA).contains("DataAccessRequest"));
    assertTrue(seedRows.identities(SeedTable.DOCUMENT).contains("KnowledgePanel.ActivityFeed"));
    assertTrue(seedRows.identities(SeedTable.DOCUMENT).contains("account-activity-change"));
    assertTrue(
        seedRows.identities(SeedTable.WORKFLOW_DEFINITION).contains("AIAssetApprovalWorkflow"));
    assertTrue(seedRows.identities(SeedTable.EVENT_SUBSCRIPTION).contains("ActivityFeedAlert"));
    assertTrue(
        seedRows
            .identities(SeedTable.NOTIFICATION_TEMPLATE)
            .contains("system-notification-entity-created"));
    assertTrue(
        seedRows.identities(SeedTable.LEARNING_RESOURCE).contains("CollateClues_GettingStarted"));
    assertTrue(seedRows.identities(SeedTable.TEST_DEFINITION).contains("tableRowCountToEqual"));
    assertTrue(
        seedRows
            .identities(SeedTable.TEST_CONNECTION_DEFINITION)
            .contains("Rest.testConnectionDefinition"));
    assertTrue(seedRows.identities(SeedTable.WEB_ANALYTIC_EVENT).contains("CustomEvent"));
    assertTrue(
        seedRows.identities(SeedTable.DATA_INSIGHT_CHART).contains("AggregatedUnusedAssetsCount"));
    assertTrue(seedRows.identities(SeedTable.BOT).contains("ingestion-bot"));
    assertTrue(seedRows.identities(SeedTable.CLASSIFICATION).contains("Tier"));
    assertTrue(seedRows.identities(SeedTable.TAG).contains("Tier.Tier1"));
    assertTrue(seedRows.identities(SeedTable.AI_GOVERNANCE_POLICY).contains("drift_threshold"));
    assertTrue(seedRows.identities(SeedTable.AI_GOVERNANCE_FRAMEWORK).contains("canada_aida"));
    assertTrue(seedRows.identities(SeedTable.AI_FRAMEWORK_CONTROL).contains("canada_aida.aida-1"));
    assertTrue(seedRows.identities(SeedTable.AI_APPLICATION).contains("claims-triage-copilot"));
    assertTrue(seedRows.identities(SeedTable.LLM_SERVICE).contains("ai_governance_llm"));
    assertTrue(
        seedRows.identities(SeedTable.LLM_MODEL).contains("ai_governance_llm.gpt_4o_claims_prod"));
    assertTrue(seedRows.identities(SeedTable.MCP_SERVICE).contains("ai_governance_mcp"));
    assertTrue(
        seedRows
            .identities(SeedTable.MCP_SERVER)
            .contains("ai_governance_mcp.code_repo_assistant"));
  }

  @Test
  void matchingFingerprintWithMissingRequiredSeedRowReseeds() {
    Settings stampedSetting = stampCurrentSeedFingerprint();
    SystemRepository warmBootRepository = mock(SystemRepository.class);
    when(warmBootRepository.getConfigWithKey(SettingsType.STARTUP_CHECKSUMS.toString()))
        .thenReturn(stampedSetting);
    when(warmBootRepository.hasRequiredSeedRows(any())).thenReturn(false);

    SeedDataGate gate = SeedDataGate.getInstance();
    gate.configure(new StartupConfiguration(), warmBootRepository);

    assertTrue(gate.shouldSeed());
    assertTrue(gate.shouldSeed());
    verify(warmBootRepository, times(1)).hasRequiredSeedRows(any());
  }

  @Test
  void requiredSeedDataProbeFailureFailsOpen() {
    Settings stampedSetting = stampCurrentSeedFingerprint();
    SystemRepository warmBootRepository = mock(SystemRepository.class);
    when(warmBootRepository.getConfigWithKey(SettingsType.STARTUP_CHECKSUMS.toString()))
        .thenReturn(stampedSetting);
    when(warmBootRepository.hasRequiredSeedRows(any()))
        .thenThrow(new IllegalStateException("database unavailable"));

    SeedDataGate gate = SeedDataGate.getInstance();
    gate.configure(new StartupConfiguration(), warmBootRepository);

    assertTrue(gate.shouldSeed());
    verify(warmBootRepository, times(1)).hasRequiredSeedRows(any());
  }

  @Test
  void missingEmailConfigurationDefaultsToOpenMetadataProvider() {
    RequiredSeedRows requiredSeedRows =
        new RequiredSeedRows(
            Map.of(SeedTable.DOCUMENT, List.of("shared-document")),
            List.of("openmetadata-email-document"),
            List.of("collate-email-document"));

    List<String> documents =
        requiredSeedRows.selectEmailDocuments(null).identities(SeedTable.DOCUMENT);

    assertTrue(documents.containsAll(List.of("shared-document", "openmetadata-email-document")));
    assertFalse(documents.contains("collate-email-document"));
  }

  @Test
  void newIndexesAndChangedTemplatesBypassTheTemplateGate() {
    SystemRepository repository = mock(SystemRepository.class);
    StartupChecksums stored =
        new StartupChecksums()
            .withSeedDataFingerprint("seed")
            .withSearchTemplateFingerprint("templates")
            .withServerVersion("version");
    when(repository.getConfigWithKey(SettingsType.STARTUP_CHECKSUMS.toString()))
        .thenReturn(
            new Settings().withConfigType(SettingsType.STARTUP_CHECKSUMS).withConfigValue(stored));

    SeedDataGate gate = SeedDataGate.getInstance();
    gate.configure(new StartupConfiguration(), repository);

    assertFalse(gate.shouldUpdateSearchTemplates("templates", 0));
    assertTrue(gate.shouldUpdateSearchTemplates("templates", 1));
    assertTrue(gate.shouldUpdateSearchTemplates("changed", 0));
  }

  @Test
  void seedFailuresDoNotStampTheCurrentSeedFingerprint() {
    SystemRepository repository = mock(SystemRepository.class);
    SeedDataGate gate = SeedDataGate.getInstance();
    gate.configure(new StartupConfiguration(), repository);
    gate.recordSeedFailure();

    gate.stampIfClean();

    ArgumentCaptor<Settings> settingCaptor = ArgumentCaptor.forClass(Settings.class);
    verify(repository).updateSetting(settingCaptor.capture());
    StartupChecksums checksums = (StartupChecksums) settingCaptor.getValue().getConfigValue();
    assertNull(checksums.getSeedDataFingerprint());
  }

  @Test
  void failedForcedTemplateRefreshClearsTheStoredFingerprint() {
    SystemRepository repository = mock(SystemRepository.class);
    StartupChecksums stored =
        new StartupChecksums()
            .withSeedDataFingerprint("seed")
            .withSearchTemplateFingerprint("templates")
            .withServerVersion("version");
    when(repository.getConfigWithKey(SettingsType.STARTUP_CHECKSUMS.toString()))
        .thenReturn(
            new Settings().withConfigType(SettingsType.STARTUP_CHECKSUMS).withConfigValue(stored));

    SeedDataGate gate = SeedDataGate.getInstance();
    gate.configure(new StartupConfiguration(), repository);
    assertTrue(gate.shouldUpdateSearchTemplates("templates", 1));

    gate.recordSearchTemplateFailure();
    gate.stampIfClean();

    ArgumentCaptor<Settings> settingCaptor = ArgumentCaptor.forClass(Settings.class);
    verify(repository).updateSetting(settingCaptor.capture());
    StartupChecksums checksums = (StartupChecksums) settingCaptor.getValue().getConfigValue();
    assertNull(checksums.getSearchTemplateFingerprint());
  }

  @Test
  void failedForcedSeedRefreshClearsTheStoredFingerprint() {
    SystemRepository firstBootRepository = mock(SystemRepository.class);
    SeedDataGate gate = SeedDataGate.getInstance();
    gate.configure(new StartupConfiguration(), firstBootRepository);
    gate.stampIfClean();

    ArgumentCaptor<Settings> firstStampCaptor = ArgumentCaptor.forClass(Settings.class);
    verify(firstBootRepository).updateSetting(firstStampCaptor.capture());

    SystemRepository forcedBootRepository = mock(SystemRepository.class);
    when(forcedBootRepository.getConfigWithKey(SettingsType.STARTUP_CHECKSUMS.toString()))
        .thenReturn(firstStampCaptor.getValue());
    StartupConfiguration forcedConfiguration = new StartupConfiguration();
    forcedConfiguration.setForceSeedData(true);
    gate.configure(forcedConfiguration, forcedBootRepository);
    gate.recordSeedFailure();
    gate.stampIfClean();

    ArgumentCaptor<Settings> failedStampCaptor = ArgumentCaptor.forClass(Settings.class);
    verify(forcedBootRepository).updateSetting(failedStampCaptor.capture());
    StartupChecksums checksums = (StartupChecksums) failedStampCaptor.getValue().getConfigValue();
    assertNull(checksums.getSeedDataFingerprint());
  }

  private Settings stampCurrentSeedFingerprint() {
    SystemRepository repository = mock(SystemRepository.class);
    SeedDataGate gate = SeedDataGate.getInstance();
    gate.configure(new StartupConfiguration(), repository);
    gate.stampIfClean();

    ArgumentCaptor<Settings> settingCaptor = ArgumentCaptor.forClass(Settings.class);
    verify(repository).updateSetting(settingCaptor.capture());
    return settingCaptor.getValue();
  }
}
