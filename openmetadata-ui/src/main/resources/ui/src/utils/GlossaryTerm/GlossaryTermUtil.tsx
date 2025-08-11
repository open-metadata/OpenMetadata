/*
 *  Copyright 2024 Collate.
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
import { isUndefined } from 'lodash';
import { CommonWidgets } from '../../components/DataAssets/CommonWidgets/CommonWidgets';
import { DomainLabelV2 } from '../../components/DataAssets/DomainLabelV2/DomainLabelV2';
import { OwnerLabelV2 } from '../../components/DataAssets/OwnerLabelV2/OwnerLabelV2';
import { ReviewerLabelV2 } from '../../components/DataAssets/ReviewerLabelV2/ReviewerLabelV2';
import GlossaryTermReferences from '../../components/Glossary/GlossaryTerms/tabs/GlossaryTermReferences';
import GlossaryTermSynonyms from '../../components/Glossary/GlossaryTerms/tabs/GlossaryTermSynonyms';
import RelatedTerms from '../../components/Glossary/GlossaryTerms/tabs/RelatedTerms';
import WorkflowHistory from '../../components/Glossary/GlossaryTerms/tabs/WorkFlowTab/WorkflowHistory.component';
import EmptyWidgetPlaceholder from '../../components/MyData/CustomizableComponents/EmptyWidgetPlaceholder/EmptyWidgetPlaceholder';
import { SIZE } from '../../enums/common.enum';
import { GlossaryTermDetailPageWidgetKeys } from '../../enums/CustomizeDetailPage.enum';
import { EntityType } from '../../enums/entity.enum';
import { WidgetConfig } from '../../pages/CustomizablePage/CustomizablePage.interface';
import customizeGlossaryTermPageClassBase from '../CustomizeGlossaryTerm/CustomizeGlossaryTermBaseClass';
import { ENTITY_LINK_SEPARATOR } from '../EntityUtils';

export const getWidgetFromKey = ({
  widgetConfig,
  handleOpenAddWidgetModal,
  handlePlaceholderWidgetKey,
  handleRemoveWidget,
  isEditView,
  iconHeight,
  iconWidth,
}: {
  widgetConfig: WidgetConfig;
  handleOpenAddWidgetModal?: () => void;
  handlePlaceholderWidgetKey?: (key: string) => void;
  handleRemoveWidget?: (key: string) => void;
  iconHeight?: SIZE;
  iconWidth?: SIZE;
  isEditView?: boolean;
}) => {
  if (
    widgetConfig.i.endsWith('.EmptyWidgetPlaceholder') &&
    !isUndefined(handleOpenAddWidgetModal) &&
    !isUndefined(handlePlaceholderWidgetKey) &&
    !isUndefined(handleRemoveWidget)
  ) {
    return (
      <EmptyWidgetPlaceholder
        handleOpenAddWidgetModal={handleOpenAddWidgetModal}
        handlePlaceholderWidgetKey={handlePlaceholderWidgetKey}
        handleRemoveWidget={handleRemoveWidget}
        iconHeight={iconHeight}
        iconWidth={iconWidth}
        isEditable={widgetConfig.isDraggable}
        widgetKey={widgetConfig.i}
      />
    );
  }

  const Widget = customizeGlossaryTermPageClassBase.getWidgetFromKey(
    widgetConfig.i
  );

  return (
    <Widget
      handleRemoveWidget={handleRemoveWidget}
      isEditView={isEditView}
      selectedGridSize={widgetConfig.w}
      widgetKey={widgetConfig.i}
    />
  );
};

export const getGlossaryTermWidgetFromKey = (widgetConfig: WidgetConfig) => {
  if (
    widgetConfig.i.startsWith(GlossaryTermDetailPageWidgetKeys.WORKFLOW_HISTORY)
  ) {
    return <WorkflowHistory />;
  } else if (
    widgetConfig.i.startsWith(GlossaryTermDetailPageWidgetKeys.RELATED_TERMS)
  ) {
    return <RelatedTerms />;
  } else if (
    widgetConfig.i.startsWith(GlossaryTermDetailPageWidgetKeys.SYNONYMS)
  ) {
    return <GlossaryTermSynonyms />;
  } else if (
    widgetConfig.i.startsWith(GlossaryTermDetailPageWidgetKeys.REFERENCES)
  ) {
    return <GlossaryTermReferences />;
  } else if (
    widgetConfig.i.startsWith(GlossaryTermDetailPageWidgetKeys.OWNER)
  ) {
    return <OwnerLabelV2 />;
  } else if (
    widgetConfig.i.startsWith(GlossaryTermDetailPageWidgetKeys.REVIEWER)
  ) {
    return <ReviewerLabelV2 />;
  } else if (
    widgetConfig.i.startsWith(GlossaryTermDetailPageWidgetKeys.DOMAIN)
  ) {
    return <DomainLabelV2 multiple showDomainHeading />;
  }

  return (
    <CommonWidgets
      entityType={EntityType.GLOSSARY_TERM}
      widgetConfig={widgetConfig}
    />
  );
};

export const createGlossaryTermEntityLink = (
  fullyQualifiedName: string
): string => {
  return `<#E${ENTITY_LINK_SEPARATOR}glossaryTerm${ENTITY_LINK_SEPARATOR}${fullyQualifiedName}>`;
};
