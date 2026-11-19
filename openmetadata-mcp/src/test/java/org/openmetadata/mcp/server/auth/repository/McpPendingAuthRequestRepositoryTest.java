package org.openmetadata.mcp.server.auth.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;

/** The consent token as the repository hands it to the DAO; the SQL is McpPendingConsentSqlTest. */
class McpPendingAuthRequestRepositoryTest {
  private static final String AUTH_REQUEST_ID = "auth-req-1";
  private static final String TOKEN = "consent-token";

  @Test
  void takeConsent_claimsWithTheHashThatStoreConsentStored() {
    CollectionDAO.McpPendingAuthRequestDAO dao = mock(CollectionDAO.McpPendingAuthRequestDAO.class);
    when(dao.storeConsent(eq(AUTH_REQUEST_ID), anyString(), eq("alice"), anyLong(), anyLong()))
        .thenReturn(1);
    McpPendingAuthRequestRepository repository = repositoryOver(dao);

    assertThat(repository.storeConsent(AUTH_REQUEST_ID, TOKEN, "alice")).isTrue();
    ArgumentCaptor<String> storedHash = ArgumentCaptor.forClass(String.class);
    verify(dao)
        .storeConsent(eq(AUTH_REQUEST_ID), storedHash.capture(), eq("alice"), anyLong(), anyLong());
    when(dao.claimConsent(eq(AUTH_REQUEST_ID), eq(storedHash.getValue()), anyLong())).thenReturn(1);
    when(dao.findConsentUserName(AUTH_REQUEST_ID)).thenReturn("alice");

    // The row holds a hash, never the token the page carries.
    assertThat(storedHash.getValue()).isNotEqualTo(TOKEN);
    assertThat(repository.takeConsent(AUTH_REQUEST_ID, TOKEN)).isEqualTo("alice");
    assertThat(repository.takeConsent(AUTH_REQUEST_ID, "another-token")).isNull();
    assertThat(repository.takeConsent(AUTH_REQUEST_ID, null)).isNull();
  }

  private static McpPendingAuthRequestRepository repositoryOver(
      CollectionDAO.McpPendingAuthRequestDAO dao) {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    when(collectionDAO.mcpPendingAuthRequestDAO()).thenReturn(dao);
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      return new McpPendingAuthRequestRepository();
    }
  }
}
