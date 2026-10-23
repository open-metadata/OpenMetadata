package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.search.GlobalSettings;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.policyevaluator.CompiledRule;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

class VectorSearchAccessTest {

  @AfterEach
  void tearDown() {
    Entity.setSearchRepository(null);
  }

  private static SubjectContext subject(boolean admin) {
    CompiledRule rule = mock(CompiledRule.class);
    when(rule.getOperations()).thenReturn(List.of(MetadataOperation.VIEW_ALL));
    when(rule.getEffect()).thenReturn(CompiledRule.Effect.DENY);
    when(rule.getResources()).thenReturn(List.of("table"));
    SubjectContext.PolicyContext policy = mock(SubjectContext.PolicyContext.class);
    when(policy.getRules()).thenReturn(List.of(rule));
    SubjectContext subject = mock(SubjectContext.class);
    when(subject.user()).thenReturn(new User().withId(UUID.randomUUID()).withName("reader"));
    when(subject.isAdmin()).thenReturn(admin);
    when(subject.getPolicies(any())).thenAnswer(invocation -> List.of(policy).iterator());
    return subject;
  }

  /**
   * Admins and anonymous callers are exempt, and deciding that must not need the settings store:
   * pure query rendering runs where settings were never loaded.
   */
  @Test
  void exemptCallersGetNoAccessFilterWithoutReadingSettings() {
    assertNull(VectorSearchAccess.openSearchFilterJson(subject(true)));
    assertNull(VectorSearchAccess.openSearchFilterJson((SubjectContext) null));
    assertNull(VectorSearchAccess.elasticSearchFilterJson(subject(true)));
  }

  @Test
  void restrictedCallerGetsTheSharedClauseOnBothEngines() {
    SearchRepository searchRepository = mock(SearchRepository.class);
    when(searchRepository.getIndexOrAliasName(anyString()))
        .thenAnswer(invocation -> invocation.getArgument(0).toString().toLowerCase());
    when(searchRepository.getChildIndexAliases(anyString())).thenReturn(Collections.emptyList());
    Entity.setSearchRepository(searchRepository);
    SearchSettings enabled =
        new SearchSettings().withGlobalSettings(new GlobalSettings().withEnableAccessControl(true));
    try (MockedStatic<SettingsCache> settings = mockStatic(SettingsCache.class)) {
      settings
          .when(() -> SettingsCache.getSetting(SettingsType.SEARCH_SETTINGS, SearchSettings.class))
          .thenReturn(enabled);

      for (String json :
          List.of(
              VectorSearchAccess.openSearchFilterJson(subject(false)),
              VectorSearchAccess.elasticSearchFilterJson(subject(false)))) {
        assertTrue(json.contains(VectorDocBuilder.FIELD_ACCESS_STAMP), json);
        assertTrue(json.contains("\"entityType\":[\"table\"]"), json);
        assertTrue(json.contains("\"_index\":[\"table\"]"), json);
      }
    }
  }
}
