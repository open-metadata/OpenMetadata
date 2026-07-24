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

package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.configuration.StartupChecksums;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.search.IndexMappingLoader;
import org.openmetadata.service.config.StartupConfiguration;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventDispatcher;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.search.elasticsearch.ElasticSearchGenericManager;
import org.openmetadata.service.search.opensearch.OpenSearchGenericManager;
import org.openmetadata.service.search.opensearch.OsUtils;
import org.openmetadata.service.seeding.SeedDataGate;

class IndexTemplateManagerTest {
  @AfterEach
  void resetSeedDataGate() {
    SeedDataGate.getInstance().reset();
  }

  @Test
  void unavailableClientsFailTemplateUpdates() {
    ElasticSearchGenericManager elasticsearch = new ElasticSearchGenericManager(null);
    OpenSearchGenericManager opensearch = new OpenSearchGenericManager(null, null);

    assertThrows(
        IOException.class,
        () -> elasticsearch.createOrUpdateIndexTemplate("template", "index*", "{}"));
    assertThrows(
        IOException.class,
        () -> opensearch.createOrUpdateIndexTemplate("template", "index*", "{}"));
    assertThrows(IOException.class, () -> elasticsearch.getIndexTemplateFingerprints("om_*"));
    assertThrows(IOException.class, () -> opensearch.getIndexTemplateFingerprints("om_*"));
  }

  @Test
  void openSearchFingerprintUsesTheEffectiveMapping() {
    OpenSearchGenericManager opensearch = new OpenSearchGenericManager(null, null);
    String mapping =
        """
        {"mappings":{"properties":{"metadata":{"type":"flattened"}}}}
        """;
    String transformedMapping = OsUtils.enrichIndexMappingForOpenSearch(mapping);

    assertNotEquals(mapping.strip(), transformedMapping);
    assertEquals(
        GenericClient.calculateIndexTemplateFingerprint("index*", transformedMapping),
        opensearch.indexTemplateFingerprint("index*", mapping));
  }

  @Test
  void matchingLiveTemplateFingerprintSkipsTemplateUpdate() throws IOException {
    SearchClient searchClient = mock(SearchClient.class);
    IndexMapping mapping = indexMapping("current_search_index");
    TestSearchRepository repository =
        newRepository(new LinkedHashMap<>(Map.of("current", mapping)), searchClient);
    repository.setMappingContent(mapping, "{}");
    configureMatchingStoredFingerprint("om_current_search_index", "{}");
    when(searchClient.getIndexTemplateFingerprints("om_*"))
        .thenReturn(
            Map.of(
                "om_current_search_index",
                GenericClient.calculateIndexTemplateFingerprint("current_search_index*", "{}")));

    repository.createOrUpdateIndexTemplates(0);

    verify(searchClient).getIndexTemplateFingerprints("om_*");
    verify(searchClient, never())
        .createOrUpdateIndexTemplate(anyString(), anyString(), anyString());
  }

  @Test
  void missingLiveTemplateIsRebuilt() throws IOException {
    SearchClient searchClient = mock(SearchClient.class);
    IndexMapping mapping = indexMapping("missing_search_index");
    TestSearchRepository repository =
        newRepository(new LinkedHashMap<>(Map.of("missing", mapping)), searchClient);
    repository.setMappingContent(mapping, "{}");
    configureMatchingStoredFingerprint("om_missing_search_index", "{}");
    when(searchClient.getIndexTemplateFingerprints("om_*")).thenReturn(Map.of());

    repository.createOrUpdateIndexTemplates(0);

    verify(searchClient)
        .createOrUpdateIndexTemplate("om_missing_search_index", "missing_search_index*", "{}");
  }

  @Test
  void staleLiveTemplateIsRebuilt() throws IOException {
    SearchClient searchClient = mock(SearchClient.class);
    IndexMapping mapping = indexMapping("stale_search_index");
    TestSearchRepository repository =
        newRepository(new LinkedHashMap<>(Map.of("stale", mapping)), searchClient);
    repository.setMappingContent(mapping, "{}");
    configureMatchingStoredFingerprint("om_stale_search_index", "{}");
    when(searchClient.getIndexTemplateFingerprints("om_*"))
        .thenReturn(Map.of("om_stale_search_index", "stale-fingerprint"));

    repository.createOrUpdateIndexTemplates(0);

    verify(searchClient)
        .createOrUpdateIndexTemplate("om_stale_search_index", "stale_search_index*", "{}");
  }

  @Test
  void failedLiveTemplateVerificationRebuildsTemplates() throws IOException {
    SearchClient searchClient = mock(SearchClient.class);
    IndexMapping mapping = indexMapping("unverified_search_index");
    TestSearchRepository repository =
        newRepository(new LinkedHashMap<>(Map.of("unverified", mapping)), searchClient);
    repository.setMappingContent(mapping, "{}");
    configureMatchingStoredFingerprint("om_unverified_search_index", "{}");
    when(searchClient.getIndexTemplateFingerprints("om_*"))
        .thenThrow(new IOException("template read failed"));

    repository.createOrUpdateIndexTemplates(0);

    verify(searchClient)
        .createOrUpdateIndexTemplate(
            "om_unverified_search_index", "unverified_search_index*", "{}");
  }

  @Test
  void failedExpectedFingerprintCalculationRebuildsTemplates() throws IOException {
    SearchClient searchClient = mock(SearchClient.class);
    IndexMapping mapping = indexMapping("invalid_search_index");
    TestSearchRepository repository =
        newRepository(new LinkedHashMap<>(Map.of("invalid", mapping)), searchClient);
    repository.setMappingContent(mapping, "{}");
    configureMatchingStoredFingerprint("om_invalid_search_index", "{}");
    when(searchClient.indexTemplateFingerprint("invalid_search_index*", "{}"))
        .thenThrow(new IllegalArgumentException("fingerprint failed"));

    repository.createOrUpdateIndexTemplates(0);

    verify(searchClient)
        .createOrUpdateIndexTemplate("om_invalid_search_index", "invalid_search_index*", "{}");
  }

  @Test
  void skippedMappingsDoNotPreventFingerprintStamping() throws IOException {
    SearchClient searchClient = mock(SearchClient.class);
    IndexMapping availableMapping = indexMapping("available_search_index");
    IndexMapping unavailableMapping = indexMapping("unavailable_search_index");
    TestSearchRepository repository =
        newRepository(
            new LinkedHashMap<>(
                Map.of("available", availableMapping, "unavailable", unavailableMapping)),
            searchClient);
    repository.setMappingContent(availableMapping, "{}");

    SystemRepository systemRepository = mock(SystemRepository.class);
    SeedDataGate gate = SeedDataGate.getInstance();
    gate.configure(new StartupConfiguration(), systemRepository);

    repository.createOrUpdateIndexTemplates(0);
    gate.stampIfClean();

    verify(searchClient)
        .createOrUpdateIndexTemplate("om_available_search_index", "available_search_index*", "{}");
    ArgumentCaptor<Settings> settingCaptor = ArgumentCaptor.forClass(Settings.class);
    verify(systemRepository).updateSetting(settingCaptor.capture());
    StartupChecksums checksums = (StartupChecksums) settingCaptor.getValue().getConfigValue();
    assertNotNull(checksums.getSearchTemplateFingerprint());
  }

  @Test
  void failedTemplateUpdateInvalidatesFingerprint() throws IOException {
    SearchClient searchClient = mock(SearchClient.class);
    IndexMapping mapping = indexMapping("failing_search_index");
    TestSearchRepository repository =
        newRepository(new LinkedHashMap<>(Map.of("failing", mapping)), searchClient);
    repository.setMappingContent(mapping, "{}");
    doThrow(new IOException("template update failed"))
        .when(searchClient)
        .createOrUpdateIndexTemplate("om_failing_search_index", "failing_search_index*", "{}");

    SystemRepository systemRepository = mock(SystemRepository.class);
    StartupChecksums storedChecksums =
        new StartupChecksums()
            .withSeedDataFingerprint("seed")
            .withSearchTemplateFingerprint("previous-template-fingerprint")
            .withServerVersion("version");
    when(systemRepository.getConfigWithKey(SettingsType.STARTUP_CHECKSUMS.toString()))
        .thenReturn(
            new Settings()
                .withConfigType(SettingsType.STARTUP_CHECKSUMS)
                .withConfigValue(storedChecksums));
    SeedDataGate gate = SeedDataGate.getInstance();
    gate.configure(new StartupConfiguration(), systemRepository);

    repository.createOrUpdateIndexTemplates(0);
    gate.stampIfClean();

    ArgumentCaptor<Settings> settingCaptor = ArgumentCaptor.forClass(Settings.class);
    verify(systemRepository).updateSetting(settingCaptor.capture());
    StartupChecksums checksums = (StartupChecksums) settingCaptor.getValue().getConfigValue();
    assertNull(checksums.getSearchTemplateFingerprint());
  }

  @Test
  void failedTemplateReadInvalidatesFingerprint() {
    SearchClient searchClient = mock(SearchClient.class);
    IndexMapping mapping = indexMapping("unreadable_search_index");
    TestSearchRepository repository =
        newRepository(new LinkedHashMap<>(Map.of("unreadable", mapping)), searchClient);
    repository.setMappingFailure(mapping);

    SystemRepository systemRepository = mock(SystemRepository.class);
    StartupChecksums storedChecksums =
        new StartupChecksums()
            .withSeedDataFingerprint("seed")
            .withSearchTemplateFingerprint(SeedDataGate.fingerprint(Map.of()))
            .withServerVersion("version");
    when(systemRepository.getConfigWithKey(SettingsType.STARTUP_CHECKSUMS.toString()))
        .thenReturn(
            new Settings()
                .withConfigType(SettingsType.STARTUP_CHECKSUMS)
                .withConfigValue(storedChecksums));
    SeedDataGate gate = SeedDataGate.getInstance();
    gate.configure(new StartupConfiguration(), systemRepository);

    repository.createOrUpdateIndexTemplates(0);
    gate.stampIfClean();

    ArgumentCaptor<Settings> settingCaptor = ArgumentCaptor.forClass(Settings.class);
    verify(systemRepository).updateSetting(settingCaptor.capture());
    StartupChecksums checksums = (StartupChecksums) settingCaptor.getValue().getConfigValue();
    assertNull(checksums.getSearchTemplateFingerprint());
  }

  private static IndexMapping indexMapping(String indexName) {
    return IndexMapping.builder().indexName(indexName).build();
  }

  private static void configureMatchingStoredFingerprint(
      String templateName, String mappingContent) {
    SystemRepository systemRepository = mock(SystemRepository.class);
    StartupChecksums storedChecksums =
        new StartupChecksums()
            .withSearchTemplateFingerprint(
                SeedDataGate.fingerprint(Map.of(templateName, mappingContent)));
    when(systemRepository.getConfigWithKey(SettingsType.STARTUP_CHECKSUMS.toString()))
        .thenReturn(
            new Settings()
                .withConfigType(SettingsType.STARTUP_CHECKSUMS)
                .withConfigValue(storedChecksums));
    SeedDataGate.getInstance().configure(new StartupConfiguration(), systemRepository);
  }

  private static TestSearchRepository newRepository(
      Map<String, IndexMapping> indexMappings, SearchClient searchClient) {
    when(searchClient.indexTemplateFingerprint(anyString(), anyString()))
        .thenAnswer(
            invocation ->
                GenericClient.calculateIndexTemplateFingerprint(
                    invocation.getArgument(0), invocation.getArgument(1)));
    ElasticSearchConfiguration configuration = new ElasticSearchConfiguration();
    configuration.setClusterAlias("");
    IndexMappingLoader mappingLoader = mock(IndexMappingLoader.class);
    when(mappingLoader.getIndexMapping()).thenReturn(indexMappings);
    EntityLifecycleEventDispatcher dispatcher = mock(EntityLifecycleEventDispatcher.class);
    TestSearchRepository.overrideSearchClient(searchClient);
    try (var loaderMock = mockStatic(IndexMappingLoader.class);
        var dispatcherMock = mockStatic(EntityLifecycleEventDispatcher.class)) {
      loaderMock.when(IndexMappingLoader::getInstance).thenReturn(mappingLoader);
      dispatcherMock.when(EntityLifecycleEventDispatcher::getInstance).thenReturn(dispatcher);
      return new TestSearchRepository(configuration, 4);
    } finally {
      TestSearchRepository.clearSearchClientOverride();
    }
  }

  private static final class TestSearchRepository extends SearchRepository {
    private static final ThreadLocal<SearchClient> SEARCH_CLIENT_OVERRIDE = new ThreadLocal<>();
    private final Map<IndexMapping, String> mappingContents = new HashMap<>();
    private final Set<IndexMapping> mappingFailures = new HashSet<>();

    private TestSearchRepository(ElasticSearchConfiguration configuration, int maxDBConnections) {
      super(configuration, maxDBConnections);
    }

    private static void overrideSearchClient(SearchClient searchClient) {
      SEARCH_CLIENT_OVERRIDE.set(searchClient);
    }

    private static void clearSearchClientOverride() {
      SEARCH_CLIENT_OVERRIDE.remove();
    }

    private void setMappingContent(IndexMapping mapping, String content) {
      mappingContents.put(mapping, content);
    }

    private void setMappingFailure(IndexMapping mapping) {
      mappingFailures.add(mapping);
    }

    @Override
    public SearchClient buildSearchClient(ElasticSearchConfiguration configuration) {
      return SEARCH_CLIENT_OVERRIDE.get();
    }

    @Override
    public String readIndexMapping(IndexMapping indexMapping) {
      if (mappingFailures.contains(indexMapping)) {
        throw new IllegalStateException("mapping read failed");
      }
      return mappingContents.get(indexMapping);
    }
  }
}
