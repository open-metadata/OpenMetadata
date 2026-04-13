package org.openmetadata.service.security.policyevaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.NON_DELETED;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;

class FeedResourceContextTest {

  @Test
  void threadResourceContextResolvesDomainsFromLinkedEntity() {
    UUID domainId = UUID.randomUUID();
    EntityReference domainRef =
        new EntityReference()
            .withId(domainId)
            .withType(Entity.DOMAIN)
            .withFullyQualifiedName("finance");
    EntityLink about = new EntityLink(Entity.TABLE, "service.sales.orders");
    Thread thread =
        new Thread()
            .withId(UUID.randomUUID())
            .withCreatedBy("alice")
            .withAbout(about.getLinkString());
    Table table = new Table().withId(UUID.randomUUID()).withDomains(List.of(domainRef));

    try (MockedStatic<Entity> mockedEntity = Mockito.mockStatic(Entity.class)) {
      mockedEntity.when(() -> Entity.getEntity(about, Entity.FIELD_DOMAINS, ALL)).thenReturn(table);

      ThreadResourceContext resourceContext = new ThreadResourceContext(thread);

      assertSame(table, resourceContext.getEntity());
      assertEquals(List.of(domainRef), resourceContext.getDomains());
      mockedEntity.verify(() -> Entity.getEntity(about, Entity.FIELD_DOMAINS, ALL), times(1));
    }
  }

  @Test
  void threadResourceContextFallsBackToStoredDomainsWhenLinkedEntityIsMissing() {
    UUID domainId = UUID.randomUUID();
    EntityReference domainRef =
        new EntityReference()
            .withId(domainId)
            .withType(Entity.DOMAIN)
            .withFullyQualifiedName("finance");
    EntityLink about = new EntityLink(Entity.TABLE, "service.sales.orders");
    Thread thread =
        new Thread()
            .withId(UUID.randomUUID())
            .withCreatedBy("alice")
            .withAbout(about.getLinkString())
            .withDomains(List.of(domainId));

    try (MockedStatic<Entity> mockedEntity = Mockito.mockStatic(Entity.class)) {
      mockedEntity
          .when(() -> Entity.getEntity(about, Entity.FIELD_DOMAINS, ALL))
          .thenThrow(EntityNotFoundException.byMessage("missing"));
      mockedEntity
          .when(() -> Entity.getEntityReferenceById(Entity.DOMAIN, domainId, NON_DELETED))
          .thenReturn(domainRef);

      ThreadResourceContext resourceContext = new ThreadResourceContext(thread);

      assertNull(resourceContext.getEntity());
      assertEquals(List.of(domainRef), resourceContext.getDomains());
      mockedEntity.verify(() -> Entity.getEntity(about, Entity.FIELD_DOMAINS, ALL), times(1));
    }
  }

  @Test
  void threadAndPostContextsUseThreadDomainsInDomainRules() {
    UUID domainId = UUID.randomUUID();
    EntityReference resourceDomain =
        new EntityReference()
            .withId(domainId)
            .withType(Entity.DOMAIN)
            .withFullyQualifiedName("finance");
    EntityReference userDomain =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.DOMAIN)
            .withFullyQualifiedName("marketing");

    Thread thread =
        new Thread()
            .withId(UUID.randomUUID())
            .withCreatedBy("alice")
            .withDomains(List.of(domainId));

    SubjectContext subjectContext = mock(SubjectContext.class);
    User user = mock(User.class);
    when(subjectContext.user()).thenReturn(user);
    when(user.getName()).thenReturn("bob");
    when(user.getDomains()).thenReturn(List.of(userDomain));
    when(subjectContext.hasDomains(anyList())).thenReturn(false);

    try (MockedStatic<Entity> mockedEntity = Mockito.mockStatic(Entity.class)) {
      mockedEntity
          .when(() -> Entity.getEntityReferenceById(Entity.DOMAIN, domainId, NON_DELETED))
          .thenReturn(resourceDomain);

      ThreadResourceContext threadContext = new ThreadResourceContext(thread);
      PostResourceContext postContext = new PostResourceContext("alice", thread);

      assertFalse(new RuleEvaluator(null, subjectContext, threadContext).hasDomain());
      assertFalse(new RuleEvaluator(null, subjectContext, postContext).hasDomain());
    }
  }
}
