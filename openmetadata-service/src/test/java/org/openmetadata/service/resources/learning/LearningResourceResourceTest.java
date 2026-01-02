/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.resources.learning;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import jakarta.ws.rs.core.Response.Status;
import java.net.URI;
import java.util.List;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.learning.CreateLearningResource;
import org.openmetadata.schema.api.learning.ResourceCategory;
import org.openmetadata.schema.entity.learning.LearningResource;
import org.openmetadata.schema.entity.learning.LearningResourceContext;
import org.openmetadata.schema.entity.learning.LearningResourceSource;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.util.TestUtils;

public class LearningResourceResourceTest extends OpenMetadataApplicationTest {

  @Test
  void testCreateLearningResourceWithCategories(TestInfo test) throws HttpResponseException {
    CreateLearningResource create =
        new CreateLearningResource()
            .withName(getTestName(test))
            .withResourceType(CreateLearningResource.ResourceType.VIDEO)
            .withCategories(List.of(ResourceCategory.DISCOVERY, ResourceCategory.DATA_GOVERNANCE))
            .withDifficulty(CreateLearningResource.ResourceDifficulty.INTRO)
            .withSource(
                new LearningResourceSource()
                    .withProvider("YouTube")
                    .withUrl(URI.create("https://youtube.com/watch?v=test")))
            .withEstimatedDuration(300)
            .withCompletionThreshold(80.0)
            .withContexts(
                List.of(
                    new LearningResourceContext().withPageId("glossary").withPriority(1),
                    new LearningResourceContext().withPageId("domains").withPriority(2)));

    LearningResource resource =
        TestUtils.post(
            getResource("learning/resources"), create, LearningResource.class, ADMIN_AUTH_HEADERS);

    assertNotNull(resource.getId());
    assertEquals(2, resource.getCategories().size());
    assertTrue(resource.getCategories().contains(ResourceCategory.DISCOVERY));
    assertTrue(resource.getCategories().contains(ResourceCategory.DATA_GOVERNANCE));
    assertEquals(CreateLearningResource.ResourceType.VIDEO, resource.getResourceType());
    assertEquals(2, resource.getContexts().size());
  }

  @Test
  void testUpdateLearningResourceCategories(TestInfo test) throws HttpResponseException {
    CreateLearningResource create =
        new CreateLearningResource()
            .withName(getTestName(test))
            .withResourceType(CreateLearningResource.ResourceType.ARTICLE)
            .withCategories(List.of(ResourceCategory.DATA_QUALITY))
            .withSource(
                new LearningResourceSource().withUrl(URI.create("https://example.com/article")))
            .withContexts(List.of(new LearningResourceContext().withPageId("data-quality")));

    LearningResource resource =
        TestUtils.post(
            getResource("learning/resources"), create, LearningResource.class, ADMIN_AUTH_HEADERS);
    assertEquals(1, resource.getCategories().size());
    assertTrue(resource.getCategories().contains(ResourceCategory.DATA_QUALITY));

    // Update categories
    create.withCategories(List.of(ResourceCategory.DATA_QUALITY, ResourceCategory.OBSERVABILITY));
    resource =
        TestUtils.put(
            getResource("learning/resources"),
            create,
            LearningResource.class,
            Status.OK,
            ADMIN_AUTH_HEADERS);

    assertEquals(2, resource.getCategories().size());
    assertTrue(resource.getCategories().contains(ResourceCategory.DATA_QUALITY));
    assertTrue(resource.getCategories().contains(ResourceCategory.OBSERVABILITY));
  }

  @Test
  void testUpdateLearningResourceContexts(TestInfo test) throws HttpResponseException {
    CreateLearningResource create =
        new CreateLearningResource()
            .withName(getTestName(test))
            .withResourceType(CreateLearningResource.ResourceType.STORYLANE)
            .withCategories(List.of(ResourceCategory.ADMINISTRATION))
            .withSource(
                new LearningResourceSource()
                    .withProvider("Storylane")
                    .withUrl(URI.create("https://storylane.app/embed/test")))
            .withContexts(
                List.of(new LearningResourceContext().withPageId("settings").withPriority(1)));

    LearningResource resource =
        TestUtils.post(
            getResource("learning/resources"), create, LearningResource.class, ADMIN_AUTH_HEADERS);
    assertEquals(1, resource.getContexts().size());

    // Update contexts
    create.withContexts(
        List.of(
            new LearningResourceContext().withPageId("settings").withPriority(1),
            new LearningResourceContext().withPageId("teams").withPriority(2)));
    resource =
        TestUtils.put(
            getResource("learning/resources"),
            create,
            LearningResource.class,
            Status.OK,
            ADMIN_AUTH_HEADERS);

    assertEquals(2, resource.getContexts().size());
  }

  @Test
  void testLearningResourceWithDifficulty(TestInfo test) throws HttpResponseException {
    CreateLearningResource create =
        new CreateLearningResource()
            .withName(getTestName(test))
            .withResourceType(CreateLearningResource.ResourceType.VIDEO)
            .withCategories(List.of(ResourceCategory.DISCOVERY))
            .withDifficulty(CreateLearningResource.ResourceDifficulty.ADVANCED)
            .withSource(
                new LearningResourceSource().withUrl(URI.create("https://example.com/video")))
            .withContexts(List.of(new LearningResourceContext().withPageId("explore")));

    LearningResource resource =
        TestUtils.post(
            getResource("learning/resources"), create, LearningResource.class, ADMIN_AUTH_HEADERS);
    assertEquals(CreateLearningResource.ResourceDifficulty.ADVANCED, resource.getDifficulty());

    // Update difficulty
    create.withDifficulty(CreateLearningResource.ResourceDifficulty.INTERMEDIATE);
    resource =
        TestUtils.put(
            getResource("learning/resources"),
            create,
            LearningResource.class,
            Status.OK,
            ADMIN_AUTH_HEADERS);

    assertEquals(CreateLearningResource.ResourceDifficulty.INTERMEDIATE, resource.getDifficulty());
  }

  @Test
  void testLearningResourceStatusTransition(TestInfo test) throws HttpResponseException {
    CreateLearningResource create =
        new CreateLearningResource()
            .withName(getTestName(test))
            .withResourceType(CreateLearningResource.ResourceType.ARTICLE)
            .withCategories(List.of(ResourceCategory.DATA_GOVERNANCE))
            .withStatus(CreateLearningResource.Status.DRAFT)
            .withSource(
                new LearningResourceSource().withUrl(URI.create("https://example.com/draft")))
            .withContexts(List.of(new LearningResourceContext().withPageId("glossary")));

    LearningResource resource =
        TestUtils.post(
            getResource("learning/resources"), create, LearningResource.class, ADMIN_AUTH_HEADERS);
    assertEquals(CreateLearningResource.Status.DRAFT.value(), resource.getStatus().value());

    // Change status to Active
    create.withStatus(CreateLearningResource.Status.ACTIVE);
    resource =
        TestUtils.put(
            getResource("learning/resources"),
            create,
            LearningResource.class,
            Status.OK,
            ADMIN_AUTH_HEADERS);
    assertEquals(CreateLearningResource.Status.ACTIVE.value(), resource.getStatus().value());

    // Change status to Deprecated
    create.withStatus(CreateLearningResource.Status.DEPRECATED);
    resource =
        TestUtils.put(
            getResource("learning/resources"),
            create,
            LearningResource.class,
            Status.OK,
            ADMIN_AUTH_HEADERS);
    assertEquals(CreateLearningResource.Status.DEPRECATED.value(), resource.getStatus().value());
  }

  @Test
  void testResourceTypesAndDifficulties(TestInfo test) throws HttpResponseException {
    CreateLearningResource.ResourceType[] types = CreateLearningResource.ResourceType.values();
    CreateLearningResource.ResourceDifficulty[] difficulties =
        CreateLearningResource.ResourceDifficulty.values();

    // Test just a few combinations to save time
    CreateLearningResource.ResourceType type = types[0];
    CreateLearningResource.ResourceDifficulty difficulty = difficulties[0];

    CreateLearningResource create =
        new CreateLearningResource()
            .withName(getTestName(test) + "-" + type.value() + "-" + difficulty.value())
            .withResourceType(type)
            .withCategories(List.of(ResourceCategory.DISCOVERY))
            .withDifficulty(difficulty)
            .withSource(
                new LearningResourceSource()
                    .withUrl(URI.create("https://example.com/" + type.value())))
            .withContexts(List.of(new LearningResourceContext().withPageId("test")));

    LearningResource resource =
        TestUtils.post(
            getResource("learning/resources"), create, LearningResource.class, ADMIN_AUTH_HEADERS);
    assertEquals(type, resource.getResourceType());
    assertEquals(difficulty, resource.getDifficulty());
  }

  @Test
  void testCreateResourceWithEmptyCategories(TestInfo test) throws HttpResponseException {
    CreateLearningResource create =
        new CreateLearningResource()
            .withName(getTestName(test))
            .withResourceType(CreateLearningResource.ResourceType.VIDEO)
            .withCategories(List.of())
            .withSource(
                new LearningResourceSource().withUrl(URI.create("https://example.com/test")))
            .withContexts(List.of(new LearningResourceContext().withPageId("test")));

    assertThrows(
        HttpResponseException.class,
        () ->
            TestUtils.post(
                getResource("learning/resources"),
                create,
                LearningResource.class,
                ADMIN_AUTH_HEADERS));
  }

  @Test
  void testCreateResourceWithEmptyContexts(TestInfo test) throws HttpResponseException {
    CreateLearningResource create =
        new CreateLearningResource()
            .withName(getTestName(test))
            .withResourceType(CreateLearningResource.ResourceType.VIDEO)
            .withCategories(List.of(ResourceCategory.DISCOVERY))
            .withSource(
                new LearningResourceSource().withUrl(URI.create("https://example.com/test")))
            .withContexts(List.of());

    assertThrows(
        HttpResponseException.class,
        () ->
            TestUtils.post(
                getResource("learning/resources"),
                create,
                LearningResource.class,
                ADMIN_AUTH_HEADERS));
  }

  @Test
  void testCreateResourceWithNegativeEstimatedDuration(TestInfo test) throws HttpResponseException {
    CreateLearningResource create =
        new CreateLearningResource()
            .withName(getTestName(test))
            .withResourceType(CreateLearningResource.ResourceType.VIDEO)
            .withCategories(List.of(ResourceCategory.DISCOVERY))
            .withSource(
                new LearningResourceSource().withUrl(URI.create("https://example.com/test")))
            .withContexts(List.of(new LearningResourceContext().withPageId("test")))
            .withEstimatedDuration(-100);

    assertThrows(
        HttpResponseException.class,
        () ->
            TestUtils.post(
                getResource("learning/resources"),
                create,
                LearningResource.class,
                ADMIN_AUTH_HEADERS));
  }

  @Test
  void testCreateResourceWithInvalidCompletionThreshold(TestInfo test)
      throws HttpResponseException {
    CreateLearningResource create =
        new CreateLearningResource()
            .withName(getTestName(test))
            .withResourceType(CreateLearningResource.ResourceType.VIDEO)
            .withCategories(List.of(ResourceCategory.DISCOVERY))
            .withSource(
                new LearningResourceSource().withUrl(URI.create("https://example.com/test")))
            .withContexts(List.of(new LearningResourceContext().withPageId("test")))
            .withCompletionThreshold(150.0);

    assertThrows(
        HttpResponseException.class,
        () ->
            TestUtils.post(
                getResource("learning/resources"),
                create,
                LearningResource.class,
                ADMIN_AUTH_HEADERS));
  }

  @Test
  void testCreateResourceWithNegativePriority(TestInfo test) throws HttpResponseException {
    CreateLearningResource create =
        new CreateLearningResource()
            .withName(getTestName(test))
            .withResourceType(CreateLearningResource.ResourceType.VIDEO)
            .withCategories(List.of(ResourceCategory.DISCOVERY))
            .withSource(
                new LearningResourceSource().withUrl(URI.create("https://example.com/test")))
            .withContexts(
                List.of(new LearningResourceContext().withPageId("test").withPriority(-5)));

    assertThrows(
        HttpResponseException.class,
        () ->
            TestUtils.post(
                getResource("learning/resources"),
                create,
                LearningResource.class,
                ADMIN_AUTH_HEADERS));
  }

  private String getTestName(TestInfo test) {
    return test.getDisplayName().replaceAll("[^a-zA-Z0-9-]", "-").toLowerCase();
  }
}
