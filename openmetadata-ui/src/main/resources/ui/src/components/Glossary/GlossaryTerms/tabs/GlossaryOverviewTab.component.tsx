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
import React, { useMemo, useState } from 'react';
import RGL, { WidthProvider } from 'react-grid-layout';
import { useParams } from 'react-router-dom';
import { EntityTabs, EntityType } from '../../../../enums/entity.enum';
import { Glossary } from '../../../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../../../generated/entity/data/glossaryTerm';
import { PageType, Tab } from '../../../../generated/system/ui/page';
import { TagLabel } from '../../../../generated/type/tagLabel';
import { useCustomPages } from '../../../../hooks/useCustomPages';
import { useGridLayoutDirection } from '../../../../hooks/useGridLayoutDirection';
import { getWidgetFromKey } from '../../../../utils/CustomizableLandingPageUtils';
import customizeGlossaryTermPageClassBase from '../../../../utils/CustomizeGlossaryTerm/CustomizeGlossaryTermBaseClass';
import { useGenericContext } from '../../../Customization/GenericProvider/GenericProvider';
import { GlossaryUpdateConfirmationModal } from '../../GlossaryUpdateConfirmationModal/GlossaryUpdateConfirmationModal';

const ReactGridLayout = WidthProvider(RGL);

const GlossaryOverviewTab = () => {
  const [tagsUpdating, setTagsUpdating] = useState<TagLabel[]>();
  const {
    data: selectedData,
    onUpdate,
    type: entityType,
  } = useGenericContext<GlossaryTerm | Glossary>();
  const isGlossary = entityType === EntityType.GLOSSARY;
  const { customizedPage } = useCustomPages(
    isGlossary ? PageType.Glossary : PageType.GlossaryTerm
  );
  // Since we are rendering this component for all customized tabs we need tab ID to get layout form store
  const { tab = EntityTabs.OVERVIEW } = useParams<{ tab: EntityTabs }>();

  const layout = useMemo(() => {
    if (!customizedPage) {
      return customizeGlossaryTermPageClassBase.getDefaultWidgetForTab(tab);
    }

    if (customizedPage) {
      return customizedPage.tabs?.find((t: Tab) => t.id === tab)?.layout;
    } else {
      return customizeGlossaryTermPageClassBase.getDefaultWidgetForTab(tab);
    }
  }, [customizedPage, isGlossary, tab]);

  const handleGlossaryTagUpdateValidationConfirm = async () => {
    if (selectedData) {
      await onUpdate({
        ...selectedData,
        tags: tagsUpdating,
      });
    }
  };

  const widgets = useMemo(() => {
    return layout?.map(getWidgetFromKey);
  }, [layout]);

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
