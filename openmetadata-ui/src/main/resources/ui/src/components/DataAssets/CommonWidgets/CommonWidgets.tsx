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
import React, { useMemo } from 'react';
import {
  DetailPageWidgetKeys,
  GlossaryTermDetailPageWidgetKeys,
} from '../../../enums/CustomizeDetailPage.enum';
import { EntityType } from '../../../enums/entity.enum';
import { Chart } from '../../../generated/entity/data/chart';
import { Column } from '../../../generated/entity/data/container';
import { Table } from '../../../generated/entity/data/table';
import { EntityReference } from '../../../generated/entity/type';
import { TagLabel, TagSource } from '../../../generated/type/tagLabel';
import { WidgetConfig } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import { getEntityName } from '../../../utils/EntityUtils';
import { getWidgetFromKey } from '../../../utils/GlossaryTerm/GlossaryTermUtil';
import { getTagsWithoutTier, getTierTags } from '../../../utils/TableUtils';
import { createTagObject } from '../../../utils/TagsUtils';
import { CustomPropertyTable } from '../../common/CustomPropertyTable/CustomPropertyTable';
import DescriptionV1 from '../../common/EntityDescription/DescriptionV1';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import DataProductsContainer from '../../DataProducts/DataProductsContainer/DataProductsContainer.component';
import TagsContainerV2 from '../../Tag/TagsContainerV2/TagsContainerV2';
import { DisplayType } from '../../Tag/TagsViewer/TagsViewer.interface';
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
    > {}

interface CommonWidgetsProps {
  widgetConfig: WidgetConfig;
  entityType: EntityType;
}

export const CommonWidgets = ({
  widgetConfig,
  entityType,
}: CommonWidgetsProps) => {
  const { data, type, onUpdate, permissions } =
    useGenericContext<GenericEntity>();

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
    const { tags } = data;

    return {
      ...data,
      tier: getTierTags(tags ?? []),
      tags: getTagsWithoutTier(tags ?? []),
      entityName: getEntityName(data),
    };
  }, [data, data?.tags]);

  const { columns = [], charts = [] } = data as unknown as {
    columns: Array<Column>;
    charts: Array<Chart>;
  };

  const {
    editTagsPermission,
    editGlossaryTermsPermission,
    editDescriptionPermission,
    editCustomAttributePermission,
    viewAllPermission,
  } = useMemo(
    () => ({
      editTagsPermission:
        (permissions.EditTags || permissions.EditAll) && !deleted,
      editDescriptionPermission:
        (permissions.EditDescription || permissions.EditAll) && !deleted,
      editGlossaryTermsPermission:
        (permissions.EditGlossaryTerms || permissions.EditAll) && !deleted,
      editCustomAttributePermission:
        (permissions.EditAll || permissions.EditCustomFields) && !deleted,
      editAllPermission: permissions.EditAll && !deleted,
      editLineagePermission:
        (permissions.EditAll || permissions.EditLineage) && !deleted,
      viewSampleDataPermission:
        permissions.ViewAll || permissions.ViewSampleData,
      viewQueriesPermission: permissions.ViewAll || permissions.ViewQueries,
      viewProfilerPermission:
        permissions.ViewAll ||
        permissions.ViewDataProfile ||
        permissions.ViewTests,
      viewAllPermission: permissions.ViewAll,
      viewBasicPermission: permissions.ViewAll || permissions.ViewBasic,
    }),
    [permissions, deleted]
  );

  /**
   * Formulates updated tags and updates table entity data for API call
   * @param selectedTags
   */
  const handleTagsUpdate = async (selectedTags?: Array<TagLabel>) => {
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

  const tagsWidget = useMemo(() => {
    return (
      <TagsContainerV2
        showTaskHandler
        displayType={DisplayType.READ_MORE}
        entityFqn={fullyQualifiedName}
        entityType={type}
        permission={editTagsPermission}
        selectedTags={tags}
        tagType={TagSource.Classification}
        onSelectionChange={handleTagSelection}
      />
    );
  }, [editTagsPermission, tags, type, fullyQualifiedName]);

  const glossaryWidget = useMemo(() => {
    return (
      <TagsContainerV2
        showTaskHandler
        displayType={DisplayType.READ_MORE}
        entityFqn={fullyQualifiedName}
        entityType={type}
        permission={editGlossaryTermsPermission}
        selectedTags={tags}
        tagType={TagSource.Glossary}
        onSelectionChange={handleTagSelection}
      />
    );
  }, [editGlossaryTermsPermission, tags, type, fullyQualifiedName]);

  const descriptionWidget = useMemo(() => {
    return (
      <DescriptionV1
        showSuggestions
        description={description}
        entityName={entityName}
        entityType={type}
        hasEditAccess={editDescriptionPermission}
        isDescriptionExpanded={isEmpty(columns) && isEmpty(charts)}
        owner={owners}
        removeBlur={widgetConfig.h > 1}
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
    columns,
    owners,
    widgetConfig.h,
  ]);

  const widget = useMemo(() => {
    if (widgetConfig.i.startsWith(DetailPageWidgetKeys.DESCRIPTION)) {
      return descriptionWidget;
    } else if (widgetConfig.i.startsWith(DetailPageWidgetKeys.DATA_PRODUCTS)) {
      return (
        <DataProductsContainer
          activeDomain={domain}
          dataProducts={dataProducts ?? []}
          hasPermission={false}
        />
      );
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
    }

    return getWidgetFromKey({
      widgetConfig: widgetConfig,
      handleOpenAddWidgetModal: noop,
      handlePlaceholderWidgetKey: noop,
      handleRemoveWidget: noop,
      isEditView: false,
    });
  }, [widgetConfig, descriptionWidget, glossaryWidget, tagsWidget]);

  return (
    <div
      data-grid={widgetConfig}
      data-testid={widgetConfig.i}
      id={widgetConfig.i}
      key={widgetConfig.i}
      style={{ overflow: 'scroll' }}>
      {widget}
    </div>
  );
};
