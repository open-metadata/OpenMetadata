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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.StorageServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.data.CreateContainer;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.domains.CreateDomain.DomainType;
import org.openmetadata.schema.api.tasks.CreateTask;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.DescriptionUpdatePayload;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.service.Entity;

/**
 * A task finds its entity through {@code task_entity.aboutFqnHash}. Every rename or move that
 * changes an FQN must carry that hash along for the entity and everything nested under it, or the
 * task drops out of the entity's task list; and it must leave tasks of other entity types that
 * happen to share the FQN untouched.
 */
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.CONCURRENT)
public class TaskAboutFqnChangeIT {

  private static OpenMetadataClient client() {
    return SdkClients.adminClient();
  }

  @Test
  void domainRename_repointsTasksOfDomainAndSubDomain(TestNamespace ns) throws Exception {
    Domain domain = createDomain(ns.prefix("taskDomain"), null);
    Domain subDomain = createDomain("sub", domain);
    Task domainTask = createTask(ns, Entity.DOMAIN, domain.getFullyQualifiedName());
    Task subDomainTask = createTask(ns, Entity.DOMAIN, subDomain.getFullyQualifiedName());

    String newName = ns.prefix("renamedDomain");
    client().domains().patch(domain.getId().toString(), replace("/name", newName));

    assertTasksMoved(domain.getFullyQualifiedName(), newName, domainTask);
    assertTasksMoved(subDomain.getFullyQualifiedName(), newName + ".sub", subDomainTask);
  }

  @Test
  void domainRename_leavesTasksOfSameNamedGlossaryAlone(TestNamespace ns) throws Exception {
    String sharedName = ns.prefix("sharedFqn");
    Domain domain = createDomain(sharedName, null);
    Glossary glossary = createGlossary(sharedName);
    GlossaryTerm term = createTerm(glossary, "term");
    Task domainTask = createTask(ns, Entity.DOMAIN, domain.getFullyQualifiedName());
    Task glossaryTask = createTask(ns, Entity.GLOSSARY, glossary.getFullyQualifiedName());
    Task termTask = createTask(ns, Entity.GLOSSARY_TERM, term.getFullyQualifiedName());

    String newName = ns.prefix("renamedShared");
    client().domains().patch(domain.getId().toString(), replace("/name", newName));

    assertEquals(List.of(domainTask.getId()), taskIdsAbout(newName));
    assertTrue(taskIdsAbout(glossary.getFullyQualifiedName()).contains(glossaryTask.getId()));
    assertEquals(List.of(termTask.getId()), taskIdsAbout(term.getFullyQualifiedName()));
  }

  @Test
  void tagRename_repointsTasksOfTagAndChildTag(TestNamespace ns) throws Exception {
    Classification classification = createClassification(ns.prefix("taskCls"));
    Tag tag = createTag(classification, null, "tag");
    Tag childTag = createTag(classification, tag, "child");
    Task tagTask = createTask(ns, Entity.TAG, tag.getFullyQualifiedName());
    Task childTask = createTask(ns, Entity.TAG, childTag.getFullyQualifiedName());

    Tag renamed = client().tags().patch(tag.getId().toString(), replace("/name", "renamedTag"));

    assertTasksMoved(tag.getFullyQualifiedName(), renamed.getFullyQualifiedName(), tagTask);
    assertTasksMoved(
        childTag.getFullyQualifiedName(), renamed.getFullyQualifiedName() + ".child", childTask);
  }

  @Test
  void tagMove_repointsTask(TestNamespace ns) throws Exception {
    Classification classification = createClassification(ns.prefix("taskMoveCls"));
    Tag newParent = createTag(classification, null, "newParent");
    Tag tag = createTag(classification, null, "moved");
    Task task = createTask(ns, Entity.TAG, tag.getFullyQualifiedName());

    Tag moved = client().tags().patch(tag.getId().toString(), add("/parent", reference(newParent)));

    assertTasksMoved(tag.getFullyQualifiedName(), moved.getFullyQualifiedName(), task);
  }

  @Test
  void classificationRename_repointsTasksOfClassificationAndTag(TestNamespace ns) throws Exception {
    Classification classification = createClassification(ns.prefix("taskRenameCls"));
    Tag tag = createTag(classification, null, "tag");
    Task classificationTask =
        createTask(ns, Entity.CLASSIFICATION, classification.getFullyQualifiedName());
    Task tagTask = createTask(ns, Entity.TAG, tag.getFullyQualifiedName());

    String newName = ns.prefix("renamedCls");
    client().classifications().patch(classification.getId().toString(), replace("/name", newName));

    assertTasksMoved(classification.getFullyQualifiedName(), newName, classificationTask);
    assertTasksMoved(tag.getFullyQualifiedName(), newName + ".tag", tagTask);
  }

  @Test
  void dataProductRename_repointsTask(TestNamespace ns) throws Exception {
    Domain domain = createDomain(ns.prefix("dpDomain"), null);
    DataProduct dataProduct =
        client()
            .dataProducts()
            .create(
                new CreateDataProduct()
                    .withName(ns.prefix("taskDataProduct"))
                    .withDescription("Data product with a task")
                    .withDomains(List.of(domain.getFullyQualifiedName())));
    Task task = createTask(ns, Entity.DATA_PRODUCT, dataProduct.getFullyQualifiedName());

    DataProduct renamed =
        client()
            .dataProducts()
            .patch(dataProduct.getId().toString(), replace("/name", ns.prefix("renamedDp")));

    assertTasksMoved(dataProduct.getFullyQualifiedName(), renamed.getFullyQualifiedName(), task);
  }

  @Test
  void containerMove_repointsTasksOfContainerAndChild(TestNamespace ns) throws Exception {
    StorageService service = StorageServiceTestFactory.createS3(ns);
    Container newParent = createContainer(service, null, ns.prefix("newParent"));
    Container container = createContainer(service, null, ns.prefix("moved"));
    Container child = createContainer(service, container, "child");
    Task containerTask = createTask(ns, Entity.CONTAINER, container.getFullyQualifiedName());
    Task childTask = createTask(ns, Entity.CONTAINER, child.getFullyQualifiedName());

    Container moved =
        client()
            .containers()
            .patch(container.getId().toString(), add("/parent", reference(newParent)));

    assertTasksMoved(
        container.getFullyQualifiedName(), moved.getFullyQualifiedName(), containerTask);
    assertTasksMoved(
        child.getFullyQualifiedName(), moved.getFullyQualifiedName() + ".child", childTask);
  }

  @Test
  void glossaryRename_repointsTasksOfGlossaryAndTerm(TestNamespace ns) throws Exception {
    Glossary glossary = createGlossary(ns.prefix("taskGlossary"));
    GlossaryTerm term = createTerm(glossary, "term");
    Task glossaryTask = createTask(ns, Entity.GLOSSARY, glossary.getFullyQualifiedName());
    Task termTask = createTask(ns, Entity.GLOSSARY_TERM, term.getFullyQualifiedName());

    String newName = ns.prefix("renamedGlossary");
    client().glossaries().patch(glossary.getId().toString(), replace("/name", newName));

    assertTasksMoved(glossary.getFullyQualifiedName(), newName, glossaryTask);
    assertTasksMoved(term.getFullyQualifiedName(), newName + ".term", termTask);
  }

  // aboutEntity also lists the tasks of entities nested under the FQN, so a parent's listing holds
  // its children's tasks as well.
  private void assertTasksMoved(String oldFqn, String newFqn, Task task) {
    assertTrue(taskIdsAbout(newFqn).contains(task.getId()), "task must follow to " + newFqn);
    assertTrue(taskIdsAbout(oldFqn).isEmpty(), "no task may stay behind at " + oldFqn);
  }

  private static List<UUID> taskIdsAbout(String entityFqn) {
    return client()
        .tasks()
        .listWithFilters(Map.of("aboutEntity", entityFqn, "limit", "100"))
        .getData()
        .stream()
        .map(Task::getId)
        .toList();
  }

  private static Task createTask(TestNamespace ns, String entityType, String entityFqn) {
    return client()
        .tasks()
        .create(
            new CreateTask()
                .withName(ns.prefix("fqn-change-task"))
                .withCategory(TaskCategory.MetadataUpdate)
                .withType(TaskEntityType.DescriptionUpdate)
                .withAbout("<#E::%s::%s>".formatted(entityType, entityFqn))
                .withPayload(
                    new DescriptionUpdatePayload()
                        .withFieldPath("description")
                        .withNewDescription("Updated description")));
  }

  private static Domain createDomain(String name, Domain parent) {
    CreateDomain create =
        new CreateDomain()
            .withName(name)
            .withDomainType(DomainType.AGGREGATE)
            .withDescription("Domain with tasks");
    if (parent != null) {
      create.withParent(parent.getFullyQualifiedName());
    }
    return client().domains().create(create);
  }

  private static Glossary createGlossary(String name) {
    return client()
        .glossaries()
        .create(new CreateGlossary().withName(name).withDescription("Glossary with tasks"));
  }

  private static GlossaryTerm createTerm(Glossary glossary, String name) {
    return client()
        .glossaryTerms()
        .create(
            new CreateGlossaryTerm()
                .withName(name)
                .withGlossary(glossary.getFullyQualifiedName())
                .withDescription("Term with tasks"));
  }

  private static Classification createClassification(String name) {
    return client()
        .classifications()
        .create(
            new CreateClassification().withName(name).withDescription("Classification with tasks"));
  }

  private static Tag createTag(Classification classification, Tag parent, String name) {
    CreateTag create =
        new CreateTag()
            .withName(name)
            .withClassification(classification.getFullyQualifiedName())
            .withDescription("Tag with tasks");
    if (parent != null) {
      create.withParent(parent.getFullyQualifiedName());
    }
    return client().tags().create(create);
  }

  private static Container createContainer(StorageService service, Container parent, String name) {
    CreateContainer create = new CreateContainer();
    create.setName(name);
    create.setService(service.getFullyQualifiedName());
    if (parent != null) {
      create.setParent(parent.getEntityReference());
    }
    return client().containers().create(create);
  }

  private static JsonNode reference(EntityInterface entity) {
    return JsonNodeFactory.instance
        .objectNode()
        .put("id", entity.getId().toString())
        .put("type", entity.getEntityReference().getType())
        .put("fullyQualifiedName", entity.getFullyQualifiedName());
  }

  private static JsonNode replace(String path, String value) {
    return operation("replace", path, JsonNodeFactory.instance.textNode(value));
  }

  private static JsonNode add(String path, JsonNode value) {
    return operation("add", path, value);
  }

  private static JsonNode operation(String op, String path, JsonNode value) {
    ArrayNode patch = JsonNodeFactory.instance.arrayNode();
    patch.addObject().put("op", op).put("path", path).set("value", value);
    return patch;
  }
}
