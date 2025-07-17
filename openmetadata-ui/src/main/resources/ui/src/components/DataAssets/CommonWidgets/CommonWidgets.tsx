/*
 *  Copyright 2025 Collate.
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
import { isEmpty, noop } from 'lodash';
import { EntityTags } from 'Models';
import { useCallback, useMemo, useState } from 'react';
import { ENTITY_PAGE_TYPE_MAP } from '../../../constants/Customize.constants';
import { EntityField } from '../../../constants/Feeds.constants';
import {
  DetailPageWidgetKeys,
  GlossaryTermDetailPageWidgetKeys,
} from '../../../enums/CustomizeDetailPage.enum';
import { EntityType } from '../../../enums/entity.enum';
import { Dashboard } from '../../../generated/entity/data/dashboard';
import { DashboardDataModel } from '../../../generated/entity/data/dashboardDataModel';
import { Glossary } from '../../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { Mlmodel } from '../../../generated/entity/data/mlmodel';
import { Pipeline } from '../../../generated/entity/data/pipeline';
import { SearchIndex } from '../../../generated/entity/data/searchIndex';
import { StoredProcedure } from '../../../generated/entity/data/storedProcedure';
import { Table } from '../../../generated/entity/data/table';
import { Topic } from '../../../generated/entity/data/topic';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { Operation } from '../../../generated/entity/policies/policy';
import {
  ChangeDescription,
  EntityReference,
} from '../../../generated/entity/type';
import { TagLabel, TagSource } from '../../../generated/type/tagLabel';
import { WidgetConfig } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import commonWidgetClassBase from '../../../utils/CommonWidget/CommonWidgetClassBase';
import {
  getEntityName,
  getEntityReferenceFromEntity,
} from '../../../utils/EntityUtils';
import {
  getEntityVersionByField,
  getEntityVersionTags,
} from '../../../utils/EntityVersionUtils';
import { VersionEntityTypes } from '../../../utils/EntityVersionUtils.interface';
import {
  getPrioritizedEditPermission,
  getPrioritizedViewPermission,
} from '../../../utils/PermissionsUtils';
import { getTagsWithoutTier, getTierTags } from '../../../utils/TableUtils';
import { createTagObject } from '../../../utils/TagsUtils';
import { CustomPropertyTable } from '../../common/CustomPropertyTable/CustomPropertyTable';
import DescriptionV1 from '../../common/EntityDescription/DescriptionV1';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import { LeftPanelContainer } from '../../Customization/GenericTab/LeftPanelContainer';
import DataProductsContainer from '../../DataProducts/DataProductsContainer/DataProductsContainer.component';
import { GlossaryUpdateConfirmationModal } from '../../Glossary/GlossaryUpdateConfirmationModal/GlossaryUpdateConfirmationModal';
import TagsContainerV2 from '../../Tag/TagsContainerV2/TagsContainerV2';
import { DisplayType } from '../../Tag/TagsViewer/TagsViewer.interface';
import { DomainLabelV2 } from '../DomainLabelV2/DomainLabelV2';
import { OwnerLabelV2 } from '../OwnerLabelV2/OwnerLabelV2';
import { ReviewerLabelV2 } from '../ReviewerLabelV2/ReviewerLabelV2';

interface GenericEntity
  extends Exclude<EntityReference, 'type'>,
    Pick<
      Table,
      | 'deleted'
      | 'description'
      | 'owners'
      | 'domain'
      | 'dataProducts'
      | 'extension'
      | 'tags'
    > {
  changeDescription: ChangeDescription;
}

interface CommonWidgetsProps {
  widgetConfig: WidgetConfig;
  entityType: EntityType;
  showTaskHandler?: boolean;
}

export const CommonWidgets = ({
  widgetConfig,
  entityType,
  showTaskHandler = true,
}: CommonWidgetsProps) => {
  const { data, type, onUpdate, permissions, isVersionView } =
    useGenericContext<GenericEntity>();
  const [tagsUpdating, setTagsUpdating] = useState<TagLabel[]>();

  const updatedData = useMemo(() => {
    const updatedDescription = isVersionView
      ? getEntityVersionByField(
          data.changeDescription,
          EntityField.DESCRIPTION,
          data.description
        )
      : data.description;

    const updatedName = isVersionView
      ? getEntityVersionByField(
          data.changeDescription,
          EntityField.NAME,
          data.name
        )
      : data.name;
    const updatedDisplayName = isVersionView
      ? getEntityVersionByField(
          data.changeDescription,
          EntityField.DISPLAYNAME,
          data.displayName
        )
      : data.displayName;

    const updatedTags = isVersionView
      ? getEntityVersionTags(data as VersionEntityTypes, data.changeDescription)
      : data.tags;

    return {
      ...data,
      description: updatedDescription,
      name: updatedName,
      displayName: updatedDisplayName,
      tags: updatedTags,
    };
  }, [data, isVersionView]);

  const {
    tier,
    tags,
    deleted,
    owners,
    domain,
    dataProducts,
    description,
    entityName,
    fullyQualifiedName,
  } = useMemo(() => {
    const { tags } = updatedData;

    return {
      ...updatedData,
      tier: getTierTags(tags ?? []),
      tags: getTagsWithoutTier(tags ?? []),
      entityName: getEntityName(data),
    };
  }, [updatedData, updatedData?.tags]);

  // To determine if Description is expanded or not
  // Typically needed when description schema, charts or any other table is empty will expand description by default
  const isDescriptionExpanded = useMemo(() => {
    switch (entityType) {
      case EntityType.TABLE:
        return isEmpty((data as unknown as Table).columns);
      case EntityType.DASHBOARD:
        return isEmpty((data as unknown as Dashboard).charts);
      case EntityType.DASHBOARD_DATA_MODEL:
        return isEmpty((data as unknown as DashboardDataModel).columns);
      case EntityType.MLMODEL:
        return isEmpty((data as unknown as Mlmodel).mlFeatures);
      case EntityType.PIPELINE:
        return isEmpty((data as unknown as Pipeline).tasks);
      case EntityType.TOPIC:
        return isEmpty((data as unknown as Topic).messageSchema?.schemaFields);
      case EntityType.SEARCH_INDEX:
        return isEmpty((data as unknown as SearchIndex).fields);
      case EntityType.STORED_PROCEDURE:
        return isEmpty(
          (data as unknown as StoredProcedure).code ??
            (data as unknown as StoredProcedure).storedProcedureCode
        );
      case EntityType.GLOSSARY:
        return (data as unknown as Glossary).termCount === 0;
      case EntityType.DOMAIN:
      case EntityType.METRIC:
        return true;
      default:
        return false;
    }
  }, [data, entityType]);

  const {
    editDataProductPermission,
    editTagsPermission,
    editGlossaryTermsPermission,
    editDescriptionPermission,
    editCustomAttributePermission,
    viewAllPermission,
  } = useMemo(
    () => ({
      editDataProductPermission: permissions.EditAll && !deleted,
      editTagsPermission:
        getPrioritizedEditPermission(permissions, Operation.EditTags) &&
        !deleted,
      editDescriptionPermission:
        getPrioritizedEditPermission(permissions, Operation.EditDescription) &&
        !deleted,
      editGlossaryTermsPermission:
        getPrioritizedEditPermission(
          permissions,
          Operation.EditGlossaryTerms
        ) && !deleted,
      editCustomAttributePermission:
        getPrioritizedEditPermission(permissions, Operation.EditCustomFields) &&
        !deleted,
      editAllPermission: permissions.EditAll && !deleted,
      editLineagePermission:
        getPrioritizedEditPermission(permissions, Operation.EditLineage) &&
        !deleted,
      viewSampleDataPermission: getPrioritizedViewPermission(
        permissions,
        Operation.ViewSampleData
      ),
      viewQueriesPermission: getPrioritizedViewPermission(
        permissions,
        Operation.ViewQueries
      ),
      viewProfilerPermission:
        getPrioritizedViewPermission(permissions, Operation.ViewDataProfile) ||
        getPrioritizedViewPermission(permissions, Operation.ViewTests),
      viewAllPermission: permissions.ViewAll,
      viewBasicPermission: getPrioritizedViewPermission(
        permissions,
        Operation.ViewBasic
      ),
    }),
    [permissions, deleted]
  );

  const handleDataProductsSave = useCallback(
    async (dataProducts: DataProduct[]) => {
      // Create a clean updated list of entity references
      const updatedDataProducts = dataProducts.map((dataProduct) =>
        getEntityReferenceFromEntity(dataProduct, EntityType.DATA_PRODUCT)
      );

      await onUpdate({ ...data, dataProducts: updatedDataProducts });
    },
    [data, onUpdate]
  );

  const handleTagUpdateForGlossaryTerm = async (updatedTags?: TagLabel[]) => {
    setTagsUpdating(updatedTags);
  };

  const handleGlossaryTagUpdateValidationConfirm = async () => {
    if (tagsUpdating && data) {
      const updatedTags = [...(tier ? [tier] : []), ...tagsUpdating];
      const updatedTable = { ...data, tags: updatedTags };
      await onUpdate(updatedTable);
    }
  };

  /**
   * Formulates updated tags and updates table entity data for API call
   * @param selectedTags
   */
  const handleTagsUpdate = async (selectedTags?: Array<TagLabel>) => {
    if (type === EntityType.GLOSSARY_TERM) {
      handleTagUpdateForGlossaryTerm(selectedTags);

      return;
    }

    if (selectedTags && data) {
      const updatedTags = [...(tier ? [tier] : []), ...selectedTags];
      const updatedTable = { ...data, tags: updatedTags };
      await onUpdate(updatedTable);
    }
  };

  const handleTagSelection = async (selectedTags: EntityTags[]) => {
    const updatedTags: TagLabel[] | undefined = createTagObject(selectedTags);
    await handleTagsUpdate(updatedTags);
  };

  const dataProductsWidget = useMemo(() => {
    return (
      <DataProductsContainer
        newLook
        activeDomain={domain as EntityReference}
        dataProducts={dataProducts ?? []}
        hasPermission={editDataProductPermission}
        onSave={handleDataProductsSave}
      />
    );
  }, [dataProducts, domain, editDataProductPermission, handleDataProductsSave]);

  const tagsWidget = useMemo(() => {
    return (
      <TagsContainerV2
        newLook
        useGenericControls
        displayType={DisplayType.READ_MORE}
        entityFqn={fullyQualifiedName}
        entityType={type}
        permission={editTagsPermission && !isVersionView}
        selectedTags={tags}
        showTaskHandler={showTaskHandler && !isVersionView}
        tagType={TagSource.Classification}
        onSelectionChange={handleTagSelection}
      />
    );
  }, [
    editTagsPermission,
    tags,
    type,
    fullyQualifiedName,
    showTaskHandler,
    isVersionView,
  ]);

  const glossaryWidget = useMemo(() => {
    return (
      <TagsContainerV2
        newLook
        useGenericControls
        displayType={DisplayType.READ_MORE}
        entityFqn={fullyQualifiedName}
        entityType={type}
        permission={editGlossaryTermsPermission && !isVersionView}
        selectedTags={tags}
        showTaskHandler={showTaskHandler && !isVersionView}
        tagType={TagSource.Glossary}
        onSelectionChange={handleTagSelection}
      />
    );
  }, [
    editGlossaryTermsPermission,
    tags,
    type,
    fullyQualifiedName,
    showTaskHandler,
    isVersionView,
  ]);

  const descriptionWidget = useMemo(() => {
    return (
      <DescriptionV1
        showSuggestions
        wrapInCard
        description={description}
        entityName={entityName}
        entityType={type}
        hasEditAccess={editDescriptionPermission}
        isDescriptionExpanded={isDescriptionExpanded}
        owner={owners}
        removeBlur={type === EntityType.DOMAIN}
        showActions={!deleted}
        onDescriptionUpdate={async (value: string) => {
          if (value !== description) {
            await onUpdate({ ...data, description: value });
          }
        }}
      />
    );
  }, [
    description,
    entityName,
    type,
    editDescriptionPermission,
    deleted,
    owners,
    isDescriptionExpanded,
  ]);

  const widget = useMemo(() => {
    if (widgetConfig.i.startsWith(DetailPageWidgetKeys.DESCRIPTION)) {
      return descriptionWidget;
    } else if (widgetConfig.i.startsWith(DetailPageWidgetKeys.DATA_PRODUCTS)) {
      return dataProductsWidget;
    } else if (widgetConfig.i.startsWith(DetailPageWidgetKeys.TAGS)) {
      return tagsWidget;
    } else if (widgetConfig.i.startsWith(DetailPageWidgetKeys.GLOSSARY_TERMS)) {
      return glossaryWidget;
    } else if (
      widgetConfig.i.startsWith(DetailPageWidgetKeys.CUSTOM_PROPERTIES)
    ) {
      return (
        <CustomPropertyTable<EntityType.TABLE>
          isRenderedInRightPanel
          entityType={entityType as EntityType.TABLE}
          hasEditAccess={Boolean(editCustomAttributePermission)}
          hasPermission={Boolean(viewAllPermission)}
          maxDataCap={5}
        />
      );
    } else if (widgetConfig.i.startsWith(DetailPageWidgetKeys.OWNERS)) {
      return <OwnerLabelV2<GenericEntity> />;
    } else if (
      widgetConfig.i.startsWith(GlossaryTermDetailPageWidgetKeys.REVIEWER)
    ) {
      return <ReviewerLabelV2<GenericEntity> />;
    } else if (widgetConfig.i.startsWith(DetailPageWidgetKeys.EXPERTS)) {
      return <OwnerLabelV2<GenericEntity> />;
    } else if (widgetConfig.i.startsWith(DetailPageWidgetKeys.DOMAIN)) {
      return <DomainLabelV2 showDomainHeading />;
    } else if (widgetConfig.i.startsWith(DetailPageWidgetKeys.LEFT_PANEL)) {
      return (
        <LeftPanelContainer
          isEditView={false}
          layout={widgetConfig.children ?? []}
          type={ENTITY_PAGE_TYPE_MAP[type]}
          onUpdate={noop}
        />
      );
    }
    const Widget =
      commonWidgetClassBase.getCommonWidgetsFromConfig(widgetConfig);

    return Widget ? <Widget /> : null;
  }, [
    widgetConfig,
    descriptionWidget,
    glossaryWidget,
    tagsWidget,
    dataProductsWidget,
  ]);

  return (
    <>
      {widget}
      {tagsUpdating && (
        <GlossaryUpdateConfirmationModal
          glossaryTerm={updatedData as unknown as GlossaryTerm}
          updatedTags={tagsUpdating}
          onCancel={() => setTagsUpdating(undefined)}
          onValidationSuccess={handleGlossaryTagUpdateValidationConfirm}
        />
      )}
    </>
  );
};
