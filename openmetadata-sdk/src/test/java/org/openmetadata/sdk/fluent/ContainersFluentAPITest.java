/*
 *  Copyright 2025 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 *  except in compliance with the License. You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software distributed under the
 *  License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
 *  either express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */
package org.openmetadata.sdk.fluent;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.openmetadata.schema.api.data.CreateContainer;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.services.storages.ContainerService;

/**
 * Tests the fluent SDK surface for re-parenting containers (issue #24294).
 *
 * <p>Covers:
 * <ul>
 *   <li>{@code Containers.create().under(...)} sets the parent on the create request.
 *   <li>{@code Containers.find(...).fetch().withParent(...).save()} routes the parent change
 *       through {@code ContainerService.update}, which generates a PATCH on the wire.
 *   <li>{@code withoutParent()} clears the parent.
 * </ul>
 */
public class ContainersFluentAPITest {

  @Mock private OpenMetadataClient mockClient;
  @Mock private ContainerService mockContainerService;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
    when(mockClient.containers()).thenReturn(mockContainerService);
    Containers.setDefaultClient(mockClient);
  }

  @Test
  void testCreateContainerUnderParent_setsParentOnRequest() {
    UUID parentId = UUID.randomUUID();
    Container parent = new Container();
    parent.setId(parentId);
    parent.setFullyQualifiedName("s3.parentBucket");

    Container created = new Container();
    created.setId(UUID.randomUUID());
    created.setName("child");
    created.setFullyQualifiedName("s3.parentBucket.child");

    when(mockContainerService.create(any(CreateContainer.class))).thenReturn(created);

    Container result = Containers.create().name("child").in("s3").under(parent).execute();

    assertNotNull(result);
    verify(mockContainerService)
        .create(
            argThat(
                (CreateContainer req) ->
                    req.getParent() != null
                        && parentId.equals(req.getParent().getId())
                        && "container".equals(req.getParent().getType())));
  }

  @Test
  void testCreateContainerUnderFqn_setsParentOnRequest() {
    Container created = new Container();
    created.setId(UUID.randomUUID());
    when(mockContainerService.create(any(CreateContainer.class))).thenReturn(created);

    Containers.create().name("child").in("s3").underFqn("s3.parentBucket").execute();

    verify(mockContainerService)
        .create(
            argThat(
                (CreateContainer req) ->
                    req.getParent() != null
                        && "s3.parentBucket".equals(req.getParent().getFullyQualifiedName())));
  }

  @Test
  void testFluentContainerWithParent_callsUpdateWithNewParent() {
    String containerId = UUID.randomUUID().toString();
    UUID newParentId = UUID.randomUUID();
    Container existing = new Container();
    existing.setId(UUID.fromString(containerId));
    existing.setName("child");
    existing.setFullyQualifiedName("s3.oldParent.child");

    when(mockContainerService.get(containerId)).thenReturn(existing);

    Container updated = new Container();
    updated.setId(existing.getId());
    updated.setFullyQualifiedName("s3.newParent.child");
    when(mockContainerService.update(eq(containerId), any(Container.class))).thenReturn(updated);

    EntityReference newParent = new EntityReference().withId(newParentId).withType("container");

    Containers.find(containerId).fetch().withParent(newParent).save();

    verify(mockContainerService)
        .update(
            eq(containerId),
            argThat(c -> c.getParent() != null && newParentId.equals(c.getParent().getId())));
  }

  @Test
  void testFluentContainerWithoutParent_callsUpdateWithNullParent() {
    String containerId = UUID.randomUUID().toString();
    Container existing = new Container();
    existing.setId(UUID.fromString(containerId));
    existing.setName("child");
    existing.setParent(new EntityReference().withId(UUID.randomUUID()).withType("container"));

    when(mockContainerService.get(containerId)).thenReturn(existing);

    Container updated = new Container();
    updated.setId(existing.getId());
    when(mockContainerService.update(eq(containerId), any(Container.class))).thenReturn(updated);

    Containers.find(containerId).fetch().withoutParent().save();

    verify(mockContainerService).update(eq(containerId), argThat(c -> c.getParent() == null));
  }

  @Test
  void testFluentContainerWithParentFqn_setsParentRefWithFqn() {
    String containerId = UUID.randomUUID().toString();
    Container existing = new Container();
    existing.setId(UUID.fromString(containerId));
    existing.setName("child");

    when(mockContainerService.get(containerId)).thenReturn(existing);

    Container updated = new Container();
    updated.setId(existing.getId());
    when(mockContainerService.update(eq(containerId), any(Container.class))).thenReturn(updated);

    Containers.find(containerId).fetch().withParentFqn("s3.targetBucket").save();

    verify(mockContainerService)
        .update(
            eq(containerId),
            argThat(
                c ->
                    c.getParent() != null
                        && "s3.targetBucket".equals(c.getParent().getFullyQualifiedName())));
  }

  @Test
  void testCreateContainerUnderNullParent_clearsParent() {
    Container created = new Container();
    created.setId(UUID.randomUUID());
    when(mockContainerService.create(any(CreateContainer.class))).thenReturn(created);

    Containers.create().name("topLevel").in("s3").under((Container) null).execute();

    verify(mockContainerService).create(argThat((CreateContainer req) -> req.getParent() == null));
  }

  @Test
  void testFluentContainerUnmodified_saveIsNoop() {
    String containerId = UUID.randomUUID().toString();
    Container existing = new Container();
    existing.setId(UUID.fromString(containerId));
    existing.setName("noChange");
    when(mockContainerService.get(containerId)).thenReturn(existing);

    Containers.find(containerId).fetch().save();

    // FluentContainer.save short-circuits when not modified.
    verify(mockContainerService, org.mockito.Mockito.never())
        .update(eq(containerId), any(Container.class));
  }

  @Test
  void testFluentContainerWithParentClearsLater() {
    String containerId = UUID.randomUUID().toString();
    Container existing = new Container();
    existing.setId(UUID.fromString(containerId));
    when(mockContainerService.get(containerId)).thenReturn(existing);

    Container updated = new Container();
    updated.setId(existing.getId());
    when(mockContainerService.update(eq(containerId), any(Container.class))).thenReturn(updated);

    Containers.find(containerId)
        .fetch()
        .withParent(new EntityReference().withId(UUID.randomUUID()).withType("container"))
        .withoutParent()
        .save();

    // Last call wins; parent should be null when save fires.
    verify(mockContainerService).update(eq(containerId), argThat(c -> c.getParent() == null));
  }

  @Test
  void testNullParentRetrievedAfterMove() {
    String containerId = UUID.randomUUID().toString();
    Container moved = new Container();
    moved.setId(UUID.fromString(containerId));
    moved.setParent(null);

    when(mockContainerService.get(containerId)).thenReturn(moved);

    Container result = Containers.find(containerId).fetch().get();
    assertNull(result.getParent());
    assertEquals(containerId, result.getId().toString());
  }
}
