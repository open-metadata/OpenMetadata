/*
 *  Copyright 2023 Collate.
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
import { noop } from 'lodash';
import React, { useMemo, useState } from 'react';
import RGL, { WidthProvider } from 'react-grid-layout';
import { useParams } from 'react-router-dom';
import { EntityField } from '../../../../constants/Feeds.constants';
import { GlossaryTermDetailPageWidgetKeys } from '../../../../enums/CustomizeDetailPage.enum';
import { EntityTabs, EntityType } from '../../../../enums/entity.enum';
import { Glossary } from '../../../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../../../generated/entity/data/glossaryTerm';
import { ChangeDescription } from '../../../../generated/entity/type';
import { Page, PageType, Tab } from '../../../../generated/system/ui/page';
import { TagLabel, TagSource } from '../../../../generated/type/tagLabel';
import { useGridLayoutDirection } from '../../../../hooks/useGridLayoutDirection';
import { WidgetConfig } from '../../../../pages/CustomizablePage/CustomizablePage.interface';
import { useCustomizeStore } from '../../../../pages/CustomizablePage/CustomizeStore';
import customizeGlossaryTermPageClassBase from '../../../../utils/CustomizeGlossaryTerm/CustomizeGlossaryTermBaseClass';
import { getEntityName } from '../../../../utils/EntityUtils';
import {
  getEntityVersionByField,
  getEntityVersionTags,
} from '../../../../utils/EntityVersionUtils';
import { getWidgetFromKey } from '../../../../utils/GlossaryTerm/GlossaryTermUtil';
import { CustomPropertyTable } from '../../../common/CustomPropertyTable/CustomPropertyTable';
import DescriptionV1 from '../../../common/EntityDescription/DescriptionV1';
import { useGenericContext } from '../../../Customization/GenericProvider/GenericProvider';
import { DomainLabelV2 } from '../../../DataAssets/DomainLabelV2/DomainLabelV2';
import { OwnerLabelV2 } from '../../../DataAssets/OwnerLabelV2/OwnerLabelV2';
import { ReviewerLabelV2 } from '../../../DataAssets/ReviewerLabelV2/ReviewerLabelV2';
import TagsContainerV2 from '../../../Tag/TagsContainerV2/TagsContainerV2';
import { DisplayType } from '../../../Tag/TagsViewer/TagsViewer.interface';
import { GlossaryUpdateConfirmationModal } from '../../GlossaryUpdateConfirmationModal/GlossaryUpdateConfirmationModal';
import GlossaryTermReferences from './GlossaryTermReferences';
import GlossaryTermSynonyms from './GlossaryTermSynonyms';
import RelatedTerms from './RelatedTerms';

const ReactGridLayout = WidthProvider(RGL);

type Props = {
  editCustomAttributePermission: boolean;
  onExtensionUpdate: (updatedTable: GlossaryTerm) => Promise<void>;
};

const GlossaryOverviewTab = ({
  editCustomAttributePermission,
  onExtensionUpdate,
}: Props) => {
  const [tagsUpdating, setTagsUpdating] = useState<TagLabel[]>();
  const { currentPersonaDocStore } = useCustomizeStore();
  // Since we are rendering this component for all customized tabs we need tab ID to get layout form store
  const { tab = EntityTabs.OVERVIEW } = useParams<{ tab: EntityTabs }>();
  const {
    data: selectedData,
    permissions,
    onUpdate,
    isVersionView,
    type: entityType,
  } = useGenericContext<GlossaryTerm | Glossary>();

  const isGlossary = entityType === EntityType.GLOSSARY;

  const layout = useMemo(() => {
    if (!currentPersonaDocStore) {
      return customizeGlossaryTermPageClassBase.getDefaultWidgetForTab(tab);
    }
    const pageType = isGlossary ? PageType.Glossary : PageType.GlossaryTerm;
    const page = currentPersonaDocStore?.data?.pages?.find(
      (p: Page) => p.pageType === pageType
    );

    if (page) {
      return page.tabs.find((t: Tab) => t.id === tab)?.layout;
    } else {
      return customizeGlossaryTermPageClassBase.getDefaultWidgetForTab(tab);
    }
  }, [currentPersonaDocStore, isGlossary, tab]);

  const onDescriptionUpdate = async (updatedHTML: string) => {
    if (selectedData.description !== updatedHTML) {
      const updatedTableDetails = {
        ...selectedData,
        description: updatedHTML,
      };
      onUpdate(updatedTableDetails);
    }
  };

  const hasEditTagsPermissions = useMemo(() => {
    return permissions.EditAll || permissions.EditTags;
  }, [permissions]);

  const hasViewAllPermission = useMemo(() => {
    return permissions.ViewAll;
  }, [permissions]);

  const glossaryDescription = useMemo(() => {
    if (isVersionView) {
      return getEntityVersionByField(
        selectedData.changeDescription as ChangeDescription,
        EntityField.DESCRIPTION,
        selectedData.description
      );
    } else {
      return selectedData.description;
    }
  }, [selectedData, isVersionView]);

  const tags = useMemo(
    () =>
      isVersionView
        ? getEntityVersionTags(
            selectedData,
            selectedData.changeDescription as ChangeDescription
          )
        : selectedData.tags,
    [isVersionView, selectedData]
  );

  const handleTagsUpdate = async (updatedTags: TagLabel[]) => {
    setTagsUpdating(updatedTags);
  };

  const handleGlossaryTagUpdateValidationConfirm = async () => {
    if (selectedData) {
      await onUpdate({
        ...selectedData,
        tags: tagsUpdating,
      });
    }
  };

  const descriptionWidget = useMemo(() => {
    return (
      <DescriptionV1
        description={glossaryDescription}
        entityName={getEntityName(selectedData)}
        entityType={EntityType.GLOSSARY_TERM}
        hasEditAccess={permissions.EditDescription || permissions.EditAll}
        owner={selectedData?.owners}
        showActions={!selectedData.deleted}
        onDescriptionUpdate={onDescriptionUpdate}
      />
    );
  }, [glossaryDescription, selectedData, onDescriptionUpdate, permissions]);

  const tagsWidget = useMemo(() => {
    return (
      <TagsContainerV2
        displayType={DisplayType.READ_MORE}
        entityFqn={selectedData.fullyQualifiedName}
        entityType={EntityType.GLOSSARY_TERM}
        permission={hasEditTagsPermissions}
        selectedTags={tags ?? []}
        tagType={TagSource.Classification}
        onSelectionChange={handleTagsUpdate}
      />
    );
  }, [tags, selectedData.fullyQualifiedName, hasEditTagsPermissions]);

  const domainWidget = useMemo(() => {
    return (
      <DomainLabelV2
        showDomainHeading
        // Only allow domain selection at glossary level. Glossary Term will inherit
        hasPermission={permissions.EditAll}
      />
    );
  }, [
    selectedData.domain,
    selectedData.fullyQualifiedName,
    selectedData.id,
    permissions.EditAll,
    isGlossary,
  ]);

  const customPropertyWidget = useMemo(() => {
    return (
      <CustomPropertyTable
        isRenderedInRightPanel
        entityType={EntityType.GLOSSARY_TERM}
        handleExtensionUpdate={async (updatedTable) => {
          await onExtensionUpdate?.(updatedTable);
        }}
        hasEditAccess={Boolean(editCustomAttributePermission)}
        hasPermission={hasViewAllPermission}
        maxDataCap={5}
      />
    );
  }, [selectedData, editCustomAttributePermission, hasViewAllPermission]);

  const widgets = useMemo(() => {
    const getWidgetFromKeyInternal = (widgetConfig: WidgetConfig) => {
      if (
        widgetConfig.i.startsWith(
          GlossaryTermDetailPageWidgetKeys.RELATED_TERMS
        )
      ) {
        return <RelatedTerms />;
      } else if (
        widgetConfig.i.startsWith(GlossaryTermDetailPageWidgetKeys.SYNONYMS)
      ) {
        return <GlossaryTermSynonyms />;
      } else if (
        widgetConfig.i.startsWith(GlossaryTermDetailPageWidgetKeys.TAGS)
      ) {
        return tagsWidget;
      } else if (
        widgetConfig.i.startsWith(GlossaryTermDetailPageWidgetKeys.REFERENCES)
      ) {
        return <GlossaryTermReferences />;
      } else if (
        widgetConfig.i.startsWith(GlossaryTermDetailPageWidgetKeys.DESCRIPTION)
      ) {
        return descriptionWidget;
      } else if (
        widgetConfig.i.startsWith(GlossaryTermDetailPageWidgetKeys.OWNER)
      ) {
        return <OwnerLabelV2 />;
      } else if (
        widgetConfig.i.startsWith(GlossaryTermDetailPageWidgetKeys.DOMAIN)
      ) {
        return domainWidget;
      } else if (
        widgetConfig.i.startsWith(GlossaryTermDetailPageWidgetKeys.REVIEWER)
      ) {
        return <ReviewerLabelV2 />;
      } else if (
        widgetConfig.i.startsWith(
          GlossaryTermDetailPageWidgetKeys.CUSTOM_PROPERTIES
        ) &&
        !isGlossary
      ) {
        return customPropertyWidget;
      }

      return getWidgetFromKey({
        widgetConfig: widgetConfig,
        handleOpenAddWidgetModal: noop,
        handlePlaceholderWidgetKey: noop,
        handleRemoveWidget: noop,
        isEditView: false,
      });
    };

    return layout.map((widget: WidgetConfig) => (
      <div
        data-grid={widget}
        id={widget.i}
        key={widget.i}
        style={{ overflow: 'scroll' }}>
        {getWidgetFromKeyInternal(widget)}
      </div>
    ));
  }, [
    layout,
    descriptionWidget,
    tagsWidget,
    domainWidget,
    customPropertyWidget,
    isGlossary,
  ]);

  // call the hook to set the direction of the grid layout
  useGridLayoutDirection();

  return (
    <>
      <ReactGridLayout
        className="grid-container"
        cols={8}
        isDraggable={false}
        isResizable={false}
        margin={[
          customizeGlossaryTermPageClassBase.detailPageWidgetMargin,
          customizeGlossaryTermPageClassBase.detailPageWidgetMargin,
        ]}
        rowHeight={customizeGlossaryTermPageClassBase.detailPageRowHeight}>
        {widgets}
      </ReactGridLayout>
      {tagsUpdating && (
        <GlossaryUpdateConfirmationModal
          glossaryTerm={selectedData as GlossaryTerm}
          updatedTags={tagsUpdating}
          onCancel={() => setTagsUpdating(undefined)}
          onValidationSuccess={handleGlossaryTagUpdateValidationConfirm}
        />
      )}
    </>
  );
};

export default GlossaryOverviewTab;
