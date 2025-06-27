/*
 *  Copyright 2021 Collate
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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.DASHBOARD;
import static org.openmetadata.service.Entity.MLMODEL;
import static org.openmetadata.service.Entity.getEntityReference;
import static org.openmetadata.service.resources.tags.TagLabelUtil.checkMutuallyExclusive;
import static org.openmetadata.service.util.EntityUtil.entityReferenceMatch;
import static org.openmetadata.service.util.EntityUtil.mlFeatureMatch;
import static org.openmetadata.service.util.EntityUtil.mlHyperParameterMatch;

import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.feed.ResolveTask;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MlFeature;
import org.openmetadata.schema.type.MlFeatureSource;
import org.openmetadata.schema.type.MlHyperParameter;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.FeedRepository.TaskWorkflow;
import org.openmetadata.service.jdbi3.FeedRepository.ThreadContext;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.resources.mlmodels.MlModelResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class MlModelRepository extends EntityRepository<MlModel> {
  private static final String MODEL_UPDATE_FIELDS = "dashboard";
  private static final String MODEL_PATCH_FIELDS = "dashboard";

  public MlModelRepository() {
    super(
        MlModelResource.COLLECTION_PATH,
        Entity.MLMODEL,
        MlModel.class,
        Entity.getCollectionDAO().mlModelDAO(),
        MODEL_PATCH_FIELDS,
        MODEL_UPDATE_FIELDS);
    supportsSearch = true;
  }

  public static MlFeature findMlFeature(List<MlFeature> features, String featureName) {
    return features.stream()
        .filter(c -> c.getName().equals(featureName))
        .findFirst()
        .orElseThrow(
            () ->
                new IllegalArgumentException(
                    CatalogExceptionMessage.invalidFieldName("mlFeature", featureName)));
  }

  @Override
  public void setFullyQualifiedName(MlModel mlModel) {
    mlModel.setFullyQualifiedName(
        FullyQualifiedName.add(mlModel.getService().getFullyQualifiedName(), mlModel.getName()));
    if (!nullOrEmpty(mlModel.getMlFeatures())) {
      setMlFeatureFQN(mlModel.getFullyQualifiedName(), mlModel.getMlFeatures());
    }
  }

  @Override
  public void setFields(MlModel mlModel, Fields fields) {
    mlModel.setService(getContainer(mlModel.getId()));
    mlModel.setDashboard(
        fields.contains("dashboard") ? getDashboard(mlModel) : mlModel.getDashboard());
    if (mlModel.getUsageSummary() == null) {
      mlModel.withUsageSummary(
          fields.contains("usageSummary")
              ? EntityUtil.getLatestUsage(daoCollection.usageDAO(), mlModel.getId())
              : mlModel.getUsageSummary());
    }
  }

  @Override
  public void clearFields(MlModel mlModel, Fields fields) {
    mlModel.setDashboard(fields.contains("dashboard") ? mlModel.getDashboard() : null);
    mlModel.withUsageSummary(fields.contains("usageSummary") ? mlModel.getUsageSummary() : null);
  }

  @Override
  public void restorePatchAttributes(MlModel original, MlModel updated) {
    // Patch can't make changes to following fields. Ignore the changes
    super.restorePatchAttributes(original, updated);
    updated.withService(original.getService());
  }

  private void setMlFeatureSourcesFQN(List<MlFeatureSource> mlSources) {
    mlSources.forEach(
        s -> {
          if (s.getDataSource() != null) {
            s.setFullyQualifiedName(
                FullyQualifiedName.add(s.getDataSource().getFullyQualifiedName(), s.getName()));
          } else {
            s.setFullyQualifiedName(s.getName());
          }
        });
  }

  private void setMlFeatureFQN(String parentFQN, List<MlFeature> mlFeatures) {
    mlFeatures.forEach(
        f -> {
          String featureFqn = FullyQualifiedName.add(parentFQN, f.getName());
          f.setFullyQualifiedName(featureFqn);
          if (f.getFeatureSources() != null) {
            setMlFeatureSourcesFQN(f.getFeatureSources());
          }
        });
  }

  /**
   * Make sure that all the MlFeatureSources are pointing to correct EntityReferences in tha Table
   * DAO.
   */
  private void validateReferences(List<MlFeature> mlFeatures) {
    for (MlFeature feature : mlFeatures) {
      if (!nullOrEmpty(feature.getFeatureSources())) {
        for (MlFeatureSource source : feature.getFeatureSources()) {
          validateMlDataSource(source);
        }
      }
    }
  }

  private void validateMlDataSource(MlFeatureSource source) {
    if (source.getDataSource() != null) {
      Entity.getEntityReference(source.getDataSource(), Include.NON_DELETED);
    }
  }

  @Override
  public void prepare(MlModel mlModel, boolean update) {
    populateService(mlModel);
    if (!nullOrEmpty(mlModel.getMlFeatures())) {
      validateReferences(mlModel.getMlFeatures());
      mlModel.getMlFeatures().forEach(feature -> checkMutuallyExclusive(feature.getTags()));
    }

    // Check that the dashboard exists
    if (mlModel.getDashboard() != null) {
      mlModel.setDashboard(Entity.getEntityReference(mlModel.getDashboard(), Include.NON_DELETED));
    }
  }

  @Override
  public void storeEntity(MlModel mlModel, boolean update) {
    // Relationships and fields such as service are derived and not stored as part of json
    EntityReference dashboard = mlModel.getDashboard();
    EntityReference service = mlModel.getService();
    mlModel.withService(null).withDashboard(null);
    store(mlModel, update);
    mlModel.withService(service).withDashboard(dashboard);
  }

  @Override
  public void storeRelationships(MlModel mlModel) {
    addServiceRelationship(mlModel, mlModel.getService());

    if (mlModel.getDashboard() != null) {
      // Add relationship from MlModel --- uses ---> Dashboard
      addRelationship(
          mlModel.getId(),
          mlModel.getDashboard().getId(),
          Entity.MLMODEL,
          Entity.DASHBOARD,
          Relationship.USES);
    }

    setMlFeatureSourcesLineage(mlModel);
  }

  /**
   * If we have the properties MLFeatures -> MlFeatureSources and the feature sources have properly
   * informed the Data Source EntityRef, then we will automatically build the lineage between tables
   * and ML Model.
   */
  private void setMlFeatureSourcesLineage(MlModel mlModel) {
    if (mlModel.getMlFeatures() != null) {
      mlModel
          .getMlFeatures()
          .forEach(
              mlFeature -> {
                if (mlFeature.getFeatureSources() != null) {
                  mlFeature
                      .getFeatureSources()
                      .forEach(
                          mlFeatureSource -> {
                            EntityReference targetEntity =
                                getEntityReference(mlFeatureSource.getDataSource(), Include.ALL);
                            if (targetEntity != null) {
                              addRelationship(
                                  targetEntity.getId(),
                                  mlModel.getId(),
                                  targetEntity.getType(),
                                  MLMODEL,
                                  Relationship.UPSTREAM);
                            }
                          });
                }
              });
    }
  }

  @Override
  public EntityRepository<MlModel>.EntityUpdater getUpdater(
      MlModel original, MlModel updated, Operation operation, ChangeSource changeSource) {
    return new MlModelUpdater(original, updated, operation);
  }

  @Override
  public EntityInterface getParentEntity(MlModel entity, String fields) {
    return Entity.getEntity(entity.getService(), fields, Include.ALL);
  }

  @Override
  public List<TagLabel> getAllTags(EntityInterface entity) {
    List<TagLabel> allTags = new ArrayList<>();
    MlModel mlModel = (MlModel) entity;
    EntityUtil.mergeTags(allTags, mlModel.getTags());
    for (MlFeature feature : listOrEmpty(mlModel.getMlFeatures())) {
      EntityUtil.mergeTags(allTags, feature.getTags());
      for (MlFeatureSource source : listOrEmpty(feature.getFeatureSources())) {
        EntityUtil.mergeTags(allTags, source.getTags());
      }
    }
    return allTags;
  }

  @Override
  public TaskWorkflow getTaskWorkflow(ThreadContext threadContext) {
    validateTaskThread(threadContext);
    EntityLink entityLink = threadContext.getAbout();
    if (entityLink.getFieldName().equals("mlFeatures")) {
      TaskType taskType = threadContext.getThread().getTask().getType();
      if (EntityUtil.isDescriptionTask(taskType)) {
        return new MlFeatureDescriptionTaskWorkflow(threadContext);
      } else if (EntityUtil.isTagTask(taskType)) {
        return new MlFeatureTagTaskWorkflow(threadContext);
      } else {
        throw new IllegalArgumentException(String.format("Invalid task type %s", taskType));
      }
    }
    return super.getTaskWorkflow(threadContext);
  }

  static class MlFeatureDescriptionTaskWorkflow extends DescriptionTaskWorkflow {
    private final MlFeature mlFeature;

    MlFeatureDescriptionTaskWorkflow(ThreadContext threadContext) {
      super(threadContext);
      MlModel mlModel = (MlModel) threadContext.getAboutEntity();
      mlFeature =
          findMlFeature(mlModel.getMlFeatures(), threadContext.getAbout().getArrayFieldName());
    }

    @Override
    public EntityInterface performTask(String user, ResolveTask resolveTask) {
      mlFeature.setDescription(resolveTask.getNewValue());
      return threadContext.getAboutEntity();
    }
  }

  static class MlFeatureTagTaskWorkflow extends TagTaskWorkflow {
    private final MlFeature mlFeature;

    MlFeatureTagTaskWorkflow(ThreadContext threadContext) {
      super(threadContext);
      MlModel mlModel = (MlModel) threadContext.getAboutEntity();
      mlFeature =
          findMlFeature(mlModel.getMlFeatures(), threadContext.getAbout().getArrayFieldName());
    }

    @Override
    public EntityInterface performTask(String user, ResolveTask resolveTask) {
      List<TagLabel> tags = JsonUtils.readObjects(resolveTask.getNewValue(), TagLabel.class);
      mlFeature.setTags(tags);
      return threadContext.getAboutEntity();
    }
  }

  private void populateService(MlModel mlModel) {
    MlModelService service = Entity.getEntity(mlModel.getService(), "", Include.NON_DELETED);
    mlModel.setService(service.getEntityReference());
    mlModel.setServiceType(service.getServiceType());
  }

  private EntityReference getDashboard(MlModel mlModel) {
    return mlModel == null
        ? null
        : getToEntityRef(mlModel.getId(), Relationship.USES, DASHBOARD, false);
  }

  /** Handles entity updated from PUT and POST operation. */
  public class MlModelUpdater extends EntityUpdater {
    public MlModelUpdater(MlModel original, MlModel updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      updateAlgorithm(original, updated);
      updateDashboard(original, updated);
      updateMlFeatures(original, updated);
      updateMlHyperParameters(original, updated);
      updateMlStore(original, updated);
      updateServer(original, updated);
      updateTarget(original, updated);
      recordChange("sourceUrl", original.getSourceUrl(), updated.getSourceUrl());
      recordChange("sourceHash", original.getSourceHash(), updated.getSourceHash());
    }

    private void updateAlgorithm(MlModel origModel, MlModel updatedModel) {
      // Updating an algorithm should be flagged for an ML Model
      // Algorithm is a required field. Cannot be null.
      if (updated.getAlgorithm() != null
          && (recordChange("algorithm", origModel.getAlgorithm(), updatedModel.getAlgorithm()))) {
        // Mark the EntityUpdater version change to major
        majorVersionChange = true;
      }
    }

    private void updateMlFeatures(MlModel origModel, MlModel updatedModel) {
      List<MlFeature> addedList = new ArrayList<>();
      List<MlFeature> deletedList = new ArrayList<>();
      recordListChange(
          "mlFeatures",
          origModel.getMlFeatures(),
          updatedModel.getMlFeatures(),
          addedList,
          deletedList,
          mlFeatureMatch);
    }

    private void updateMlHyperParameters(MlModel origModel, MlModel updatedModel) {
      List<MlHyperParameter> addedList = new ArrayList<>();
      List<MlHyperParameter> deletedList = new ArrayList<>();
      recordListChange(
          "mlHyperParameters",
          origModel.getMlHyperParameters(),
          updatedModel.getMlHyperParameters(),
          addedList,
          deletedList,
          mlHyperParameterMatch);
    }

    private void updateMlStore(MlModel origModel, MlModel updatedModel) {
      recordChange("mlStore", origModel.getMlStore(), updatedModel.getMlStore(), true);
    }

    private void updateServer(MlModel origModel, MlModel updatedModel) {
      // Updating the server can break current integrations to the ML services or enable new
      // integrations
      if (recordChange("server", origModel.getServer(), updatedModel.getServer())) {
        // Mark the EntityUpdater version change to major
        majorVersionChange = true;
      }
    }

    private void updateTarget(MlModel origModel, MlModel updatedModel) {
      // Updating the target changes the model response
      if (recordChange("target", origModel.getTarget(), updatedModel.getTarget())) {
        majorVersionChange = true;
      }
    }

    private void updateDashboard(MlModel origModel, MlModel updatedModel) {
      EntityReference origDashboard = origModel.getDashboard();
      EntityReference updatedDashboard = updatedModel.getDashboard();
      if (recordChange("dashboard", origDashboard, updatedDashboard, true, entityReferenceMatch)) {

        // Remove the dashboard associated with the model, if any
        if (origModel.getDashboard() != null) {
          deleteTo(updatedModel.getId(), Entity.MLMODEL, Relationship.USES, Entity.DASHBOARD);
        }

        // Add relationship from model -- uses --> dashboard
        if (updatedDashboard != null) {
          addRelationship(
              updatedModel.getId(),
              updatedDashboard.getId(),
              Entity.MLMODEL,
              Entity.DASHBOARD,
              Relationship.USES);
        }
      }
    }
  }
}
