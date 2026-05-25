package org.openmetadata.service.migration.utils.v1114;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.search.FieldValueBoost;
import org.openmetadata.schema.api.search.GlobalSettings;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.SearchSettingsMergeUtil;

class MigrationUtilTest {
  private static final String APPS_WITHOUT_BOT_POSTGRES =
      """
          SELECT a.id, a.json->>'name' as name
          FROM installed_apps a
          WHERE NOT EXISTS (
              SELECT 1 FROM entity_relationship er
              WHERE er.fromId = a.id
              AND er.toEntity = 'bot'
              AND er.relation = 0
          )
          """;

  private static final String FIND_BOT_BY_NAME_POSTGRES =
      """
          SELECT id FROM bot_entity
          WHERE json->>'name' = :botName
          """;

  private static final String INSERT_APP_BOT_RELATIONSHIP_POSTGRES =
      """
          INSERT INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation)
          VALUES (:appId, :botId, 'application', 'bot', :relation)
          ON CONFLICT DO NOTHING
          """;

  private static final String CHECK_POLICY_EXISTS_POSTGRES =
      """
          SELECT COUNT(*) FROM policy_entity
          WHERE json->>'name' = :name
          """;

  private static final String CHECK_ROLE_EXISTS_POSTGRES =
      """
          SELECT COUNT(*) FROM role_entity
          WHERE json->>'name' = :name
          """;

  private static final List<String> SYSTEM_POLICIES =
      List.of(
          "OrganizationPolicy",
          "DataConsumerPolicy",
          "DataStewardPolicy",
          "TeamOnlyPolicy",
          "ApplicationBotPolicy",
          "AutoClassificationBotPolicy",
          "DefaultBotPolicy",
          "DomainOnlyAccessPolicy",
          "IngestionBotPolicy",
          "LineageBotPolicy",
          "ProfilerBotPolicy",
          "QualityBotPolicy",
          "ScimBotPolicy",
          "UsageBotPolicy");

  private static final List<String> SYSTEM_ROLES =
      List.of(
          "DataConsumer",
          "DataSteward",
          "ApplicationBotRole",
          "AutoClassificationBotRole",
          "DataQualityBotRole",
          "DefaultBotRole",
          "DomainOnlyAccessRole",
          "GovernanceBotRole",
          "IngestionBotRole",
          "LineageBotRole",
          "ProfilerBotRole",
          "QualityBotRole",
          "ScimBotRole",
          "UsageBotRole");

  @Test
  void updateSearchSettingsBoostConfigurationSavesMergedDefaults() {
    Settings storedSettings = new Settings();
    SearchSettings currentSettings = searchSettings(0.05);
    SearchSettings defaultSettings = searchSettings(1.0);

    try (MockedStatic<SearchSettingsMergeUtil> mergeUtil =
        mockStatic(SearchSettingsMergeUtil.class, CALLS_REAL_METHODS)) {
      mergeUtil
          .when(SearchSettingsMergeUtil::getSearchSettingsFromDatabase)
          .thenReturn(storedSettings);
      mergeUtil
          .when(() -> SearchSettingsMergeUtil.loadSearchSettings(storedSettings))
          .thenReturn(currentSettings);
      mergeUtil
          .when(SearchSettingsMergeUtil::loadSearchSettingsFromFile)
          .thenReturn(defaultSettings);
      mergeUtil
          .when(() -> SearchSettingsMergeUtil.saveSearchSettings(storedSettings, currentSettings))
          .thenAnswer(invocation -> null);

      MigrationUtil.updateSearchSettingsBoostConfiguration();

      mergeUtil.verify(
          () -> SearchSettingsMergeUtil.saveSearchSettings(storedSettings, currentSettings));
    }
  }

  @Test
  void updateSearchSettingsBoostConfigurationSkipsMissingOrUnchangedSettings() {
    SearchSettings currentSettings = searchSettings(0.05);
    SearchSettings defaultSettings = searchSettings(1.0);

    try (MockedStatic<SearchSettingsMergeUtil> mergeUtil =
        mockStatic(SearchSettingsMergeUtil.class, CALLS_REAL_METHODS)) {
      mergeUtil.when(SearchSettingsMergeUtil::getSearchSettingsFromDatabase).thenReturn(null);

      assertDoesNotThrow(MigrationUtil::updateSearchSettingsBoostConfiguration);
    }

    Settings storedSettings = new Settings();
    try (MockedStatic<SearchSettingsMergeUtil> mergeUtil =
        mockStatic(SearchSettingsMergeUtil.class, CALLS_REAL_METHODS)) {
      mergeUtil
          .when(SearchSettingsMergeUtil::getSearchSettingsFromDatabase)
          .thenReturn(storedSettings);
      mergeUtil
          .when(() -> SearchSettingsMergeUtil.loadSearchSettings(storedSettings))
          .thenReturn(currentSettings);
      mergeUtil
          .when(SearchSettingsMergeUtil::loadSearchSettingsFromFile)
          .thenReturn(defaultSettings);
      mergeUtil
          .when(() -> SearchSettingsMergeUtil.saveSearchSettings(storedSettings, currentSettings))
          .thenAnswer(invocation -> null);

      currentSettings.getGlobalSettings().getFieldValueBoosts().getFirst().setFactor(0.25);

      MigrationUtil.updateSearchSettingsBoostConfiguration();

      mergeUtil.verify(
          () -> SearchSettingsMergeUtil.saveSearchSettings(storedSettings, currentSettings),
          never());
    }
  }

  @Test
  void updateSearchSettingsBoostConfigurationPropagatesUnexpectedFailures() {
    try (MockedStatic<SearchSettingsMergeUtil> mergeUtil =
        mockStatic(SearchSettingsMergeUtil.class)) {
      mergeUtil
          .when(SearchSettingsMergeUtil::getSearchSettingsFromDatabase)
          .thenThrow(new IllegalStateException("settings repository unavailable"));

      RuntimeException exception =
          assertThrows(
              RuntimeException.class, MigrationUtil::updateSearchSettingsBoostConfiguration);
      assertEquals(
          "Failed to update search settings percentileRank factors", exception.getMessage());
    }
  }

  @Test
  void restoreBotRelationshipsIfMissingInsertsOnlyWhenMatchingBotsExist() {
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    when(handle.createQuery(APPS_WITHOUT_BOT_POSTGRES).mapToMap().list())
        .thenReturn(
            List.of(
                Map.of("id", "app-1", "name", "Profiler"),
                Map.of("id", "app-2", "name", "Missing")));
    when(handle
            .createQuery(FIND_BOT_BY_NAME_POSTGRES)
            .bind("botName", "ProfilerBot")
            .mapToMap()
            .list())
        .thenReturn(List.of(Map.of("id", "bot-1")));
    when(handle
            .createQuery(FIND_BOT_BY_NAME_POSTGRES)
            .bind("botName", "MissingBot")
            .mapToMap()
            .list())
        .thenReturn(List.of());

    MigrationUtil.restoreBotRelationshipsIfMissing(handle, ConnectionType.POSTGRES);

    verify(
            handle
                .createUpdate(INSERT_APP_BOT_RELATIONSHIP_POSTGRES)
                .bind("appId", "app-1")
                .bind("botId", "bot-1")
                .bind("relation", 0))
        .execute();
    verify(
            handle
                .createUpdate(INSERT_APP_BOT_RELATIONSHIP_POSTGRES)
                .bind("appId", "app-2")
                .bind("botId", "bot-1")
                .bind("relation", 0),
            never())
        .execute();
  }

  @Test
  void checkAndLogDataLossSymptomsHandlesCountsAndQueryFailuresGracefully() {
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    when(handle.createQuery("SELECT COUNT(*) FROM role_entity").mapTo(Integer.class).one())
        .thenReturn(0);
    when(handle.createQuery("SELECT COUNT(*) FROM policy_entity").mapTo(Integer.class).one())
        .thenReturn(0);
    when(handle.createQuery("SELECT COUNT(*) FROM installed_apps").mapTo(Integer.class).one())
        .thenReturn(2);
    when(handle.createQuery("SELECT COUNT(*) FROM bot_entity").mapTo(Integer.class).one())
        .thenReturn(0);

    assertDoesNotThrow(() -> MigrationUtil.checkAndLogDataLossSymptoms(handle));

    Handle brokenHandle = mock(Handle.class, RETURNS_DEEP_STUBS);
    when(brokenHandle.createQuery("SELECT COUNT(*) FROM role_entity").mapTo(Integer.class).one())
        .thenThrow(new IllegalStateException("count failed"));

    assertDoesNotThrow(() -> MigrationUtil.checkAndLogDataLossSymptoms(brokenHandle));
  }

  @Test
  void reseedRolesAndPoliciesIfMissingSeedsDefaultsOnceThresholdIsReached() throws Exception {
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    stubSystemCounts(handle, SYSTEM_POLICIES, CHECK_POLICY_EXISTS_POSTGRES, 0);
    stubSystemCounts(handle, SYSTEM_ROLES, CHECK_ROLE_EXISTS_POSTGRES, 0);

    @SuppressWarnings("unchecked")
    EntityRepository<org.openmetadata.schema.entity.policies.Policy> policyRepository =
        mock(EntityRepository.class);
    @SuppressWarnings("unchecked")
    EntityRepository<Role> roleRepository = mock(EntityRepository.class);

    var policyA = new org.openmetadata.schema.entity.policies.Policy().withName("PolicyA");
    var policyB = new org.openmetadata.schema.entity.policies.Policy().withName("PolicyB");
    var roleA = new Role().withName("RoleA");
    var roleB = new Role().withName("RoleB");
    when(policyRepository.getEntitiesFromSeedData()).thenReturn(List.of(policyA, policyB));
    when(roleRepository.getEntitiesFromSeedData()).thenReturn(List.of(roleA, roleB));

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.POLICY)).thenReturn(policyRepository);
      entity.when(() -> Entity.getEntityRepository(Entity.ROLE)).thenReturn(roleRepository);

      MigrationUtil.reseedRolesAndPoliciesIfMissing(handle, ConnectionType.POSTGRES);

      verify(policyRepository).initializeEntity(policyA);
      verify(policyRepository).initializeEntity(policyB);
      verify(roleRepository).initializeEntity(roleA);
      verify(roleRepository).initializeEntity(roleB);
    }
  }

  @Test
  void reseedRolesAndPoliciesIfMissingSkipsWhenBelowThreshold() {
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    stubSystemCounts(handle, SYSTEM_POLICIES, CHECK_POLICY_EXISTS_POSTGRES, 1);
    stubSystemCounts(handle, SYSTEM_ROLES, CHECK_ROLE_EXISTS_POSTGRES, 1);
    when(handle
            .createQuery(CHECK_POLICY_EXISTS_POSTGRES)
            .bind("name", SYSTEM_POLICIES.getFirst())
            .mapTo(Integer.class)
            .one())
        .thenReturn(0);
    when(handle
            .createQuery(CHECK_ROLE_EXISTS_POSTGRES)
            .bind("name", SYSTEM_ROLES.getFirst())
            .mapTo(Integer.class)
            .one())
        .thenReturn(0);

    @SuppressWarnings("unchecked")
    EntityRepository<org.openmetadata.schema.entity.policies.Policy> policyRepository =
        mock(EntityRepository.class);
    @SuppressWarnings("unchecked")
    EntityRepository<Role> roleRepository = mock(EntityRepository.class);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(Entity.POLICY)).thenReturn(policyRepository);
      entity.when(() -> Entity.getEntityRepository(Entity.ROLE)).thenReturn(roleRepository);

      MigrationUtil.reseedRolesAndPoliciesIfMissing(handle, ConnectionType.POSTGRES);

      verify(policyRepository, never()).initializeEntity(any());
      verify(roleRepository, never()).initializeEntity(any());
    }
  }

  private SearchSettings searchSettings(double factor) {
    FieldValueBoost boost =
        new FieldValueBoost()
            .withField("usageSummary.weeklyStats.percentileRank")
            .withFactor(factor);
    return new SearchSettings()
        .withGlobalSettings(new GlobalSettings().withFieldValueBoosts(List.of(boost)));
  }

  private void stubSystemCounts(Handle handle, List<String> names, String query, int count) {
    for (String name : names) {
      when(handle.createQuery(query).bind("name", name).mapTo(Integer.class).one())
          .thenReturn(count);
    }
  }
}
