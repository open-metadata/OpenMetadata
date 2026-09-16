/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.jdbi3;

import jakarta.ws.rs.core.UriInfo;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.ai.CopiedAIFrameworkControl;
import org.openmetadata.schema.api.ai.ForkAIGovernanceFrameworkRequest;
import org.openmetadata.schema.api.ai.ForkAIGovernanceFrameworkResponse;
import org.openmetadata.schema.api.ai.FrameworkCoverageResponse;
import org.openmetadata.schema.entity.ai.AIFrameworkControl;
import org.openmetadata.schema.entity.ai.AIGovernanceFramework;
import org.openmetadata.schema.entity.ai.FrameworkSource;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.ai.AIGovernanceFrameworkResource;
import org.openmetadata.service.resources.ai.FrameworkCoverageComputer;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

@Slf4j
@Repository
public class AIGovernanceFrameworkRepository extends EntityRepository<AIGovernanceFramework> {
  private static final String FIELDS = "stewards,autoApply";
  private static final int CONTROL_PAGE_SIZE = 1000;

  public AIGovernanceFrameworkRepository() {
    super(
        AIGovernanceFrameworkResource.COLLECTION_PATH,
        Entity.AI_GOVERNANCE_FRAMEWORK,
        AIGovernanceFramework.class,
        Entity.getCollectionDAO().aiGovernanceFrameworkDAO(),
        FIELDS,
        FIELDS);
    supportsSearch = true;
  }

  @Override
  public void setFields(
      AIGovernanceFramework framework, Fields fields, RelationIncludes relationIncludes) {
    // Nothing extra to hydrate
  }

  @Override
  public void clearFields(AIGovernanceFramework framework, Fields fields) {
    // Nothing extra to clear
  }

  @Override
  public void prepare(AIGovernanceFramework framework, boolean update) {
    // Validation hook
  }

  @Override
  public void storeEntity(AIGovernanceFramework framework, boolean update) {
    store(framework, update);
  }

  @Override
  public void storeRelationships(AIGovernanceFramework framework) {
    // Relationships stored as part of the JSON
  }

  public FrameworkCoverageResponse getCoverage(UriInfo uriInfo, AIGovernanceFramework framework) {
    AIFrameworkControlRepository controlRepo = controlRepository();
    ListFilter filter = new ListFilter(Include.NON_DELETED);
    List<AIFrameworkControl> allControls = listControls(uriInfo, controlRepo, "", filter);
    String frameworkName = framework.getName();
    List<AIFrameworkControl> controls = new ArrayList<>();
    for (AIFrameworkControl control : allControls) {
      if (control.getFramework() != null
          && frameworkName.equals(control.getFramework().getName())) {
        controls.add(control);
      }
    }

    return FrameworkCoverageComputer.compute(framework, controls);
  }

  public ForkAIGovernanceFrameworkResponse fork(
      UriInfo uriInfo,
      AIGovernanceFramework source,
      ForkAIGovernanceFrameworkRequest request,
      String user) {
    AIGovernanceFramework created =
        create(uriInfo, forkedFramework(source, request, user), user, null);
    AIFrameworkControlRepository controlRepo = controlRepository();
    ListFilter controlFilter = new ListFilter(Include.NON_DELETED);
    if (source.getFullyQualifiedName() != null) {
      controlFilter.addQueryParam("framework", source.getFullyQualifiedName());
    }

    List<CopiedAIFrameworkControl> copiedControls = new ArrayList<>();
    long now = System.currentTimeMillis();
    for (AIFrameworkControl control : listControls(uriInfo, controlRepo, FIELDS, controlFilter)) {
      control.setId(UUID.randomUUID());
      control.setFullyQualifiedName(null);
      control.setVersion(null);
      control.setFramework(created.getEntityReference());
      control.setUpdatedAt(now);
      control.setUpdatedBy(user);
      controlRepo.create(uriInfo, control, user, null);
      copiedControls.add(
          new CopiedAIFrameworkControl().withCode(control.getCode()).withName(control.getName()));
    }

    return new ForkAIGovernanceFrameworkResponse()
        .withFramework(created)
        .withCopiedControlsCount(copiedControls.size())
        .withCopiedControls(copiedControls);
  }

  private AIGovernanceFramework forkedFramework(
      AIGovernanceFramework source, ForkAIGovernanceFrameworkRequest request, String user) {
    String newName =
        request != null && request.getName() != null && !request.getName().isBlank()
            ? request.getName()
            : source.getName() + "_fork";
    AIGovernanceFramework copy = new AIGovernanceFramework();
    copy.setId(UUID.randomUUID());
    copy.setName(newName);
    copy.setDisplayName(
        request != null && request.getDisplayName() != null
            ? request.getDisplayName()
            : "Fork of "
                + (source.getDisplayName() == null ? source.getName() : source.getDisplayName()));
    copy.setDescription(source.getDescription());
    copy.setReference(source.getReference());
    copy.setRegion(source.getRegion());
    copy.setSource(FrameworkSource.ForkedFrom);
    copy.setForkedFrom(source.getEntityReference());
    copy.setEnabled(false);
    copy.setAssessmentCadence(source.getAssessmentCadence());
    copy.setAutoApply(source.getAutoApply());
    copy.setUpdatedAt(System.currentTimeMillis());
    copy.setUpdatedBy(user);
    return copy;
  }

  private List<AIFrameworkControl> listControls(
      UriInfo uriInfo, AIFrameworkControlRepository controlRepo, String fields, ListFilter filter) {
    List<AIFrameworkControl> result = new ArrayList<>();
    String after = null;
    do {
      ResultList<AIFrameworkControl> page =
          controlRepo.listAfter(
              uriInfo, controlRepo.getFields(fields), filter, CONTROL_PAGE_SIZE, after);
      result.addAll(page.getData());
      after = page.getPaging() == null ? null : page.getPaging().getAfter();
    } while (after != null);

    return result;
  }

  private static AIFrameworkControlRepository controlRepository() {
    return (AIFrameworkControlRepository) Entity.getEntityRepository(Entity.AI_FRAMEWORK_CONTROL);
  }

  @Override
  public EntityRepository<AIGovernanceFramework>.EntityUpdater getUpdater(
      AIGovernanceFramework original,
      AIGovernanceFramework updated,
      Operation operation,
      ChangeSource changeSource) {
    return new AIGovernanceFrameworkUpdater(original, updated, operation);
  }

  public class AIGovernanceFrameworkUpdater extends EntityUpdater {
    public AIGovernanceFrameworkUpdater(
        AIGovernanceFramework original, AIGovernanceFramework updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      compareAndUpdate(
          "enabled", () -> recordChange("enabled", original.getEnabled(), updated.getEnabled()));
      compareAndUpdate(
          "reference",
          () -> recordChange("reference", original.getReference(), updated.getReference()));
      compareAndUpdate(
          "region", () -> recordChange("region", original.getRegion(), updated.getRegion()));
      compareAndUpdate(
          "source", () -> recordChange("source", original.getSource(), updated.getSource()));
      compareAndUpdate(
          "assessmentCadence",
          () ->
              recordChange(
                  "assessmentCadence",
                  original.getAssessmentCadence(),
                  updated.getAssessmentCadence()));
      compareAndUpdate(
          "autoApply",
          () -> recordChange("autoApply", original.getAutoApply(), updated.getAutoApply(), true));
      compareAndUpdate(
          "stewards",
          () -> recordChange("stewards", original.getStewards(), updated.getStewards(), true));
      compareAndUpdate(
          "nextDeadline",
          () ->
              recordChange("nextDeadline", original.getNextDeadline(), updated.getNextDeadline()));
    }
  }
}
