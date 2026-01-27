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
import { Space, Typography } from 'antd';
import { ReactComponent as IconTerm } from '../../assets/svg/book.svg';
import { useGenericContext } from '../../components/Customization/GenericProvider/GenericProvider';
import { CommonWidgets } from '../../components/DataAssets/CommonWidgets/CommonWidgets';
import { DomainLabelV2 } from '../../components/DataAssets/DomainLabelV2/DomainLabelV2';
import { OwnerLabelV2 } from '../../components/DataAssets/OwnerLabelV2/OwnerLabelV2';
import { ReviewerLabelV2 } from '../../components/DataAssets/ReviewerLabelV2/ReviewerLabelV2';
import GlossaryTermReferences from '../../components/Glossary/GlossaryTerms/tabs/GlossaryTermReferences';
import GlossaryTermSynonyms from '../../components/Glossary/GlossaryTerms/tabs/GlossaryTermSynonyms';
import RelatedTerms from '../../components/Glossary/GlossaryTerms/tabs/RelatedTerms';
import WorkflowHistory from '../../components/Glossary/GlossaryTerms/tabs/WorkFlowTab/WorkflowHistory.component';
import { DE_ACTIVE_COLOR } from '../../constants/constants';
import { GlossaryTermDetailPageWidgetKeys } from '../../enums/CustomizeDetailPage.enum';
import { EntityType } from '../../enums/entity.enum';
import { EntityReference } from '../../generated/entity/data/table';
import { TagLabel, TagSource } from '../../generated/type/tagLabel';
import { WidgetConfig } from '../../pages/CustomizablePage/CustomizablePage.interface';
import {
  convertEntityReferencesToTagLabels,
  convertTagLabelsToEntityReferences,
} from '../EntityReferenceUtils';
import { ENTITY_LINK_SEPARATOR, getEntityName } from '../EntityUtils';

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
    return <GlossaryTermDomainWidget />;
  }

  return (
    <CommonWidgets
      entityType={EntityType.GLOSSARY_TERM}
      widgetConfig={widgetConfig}
    />
  );
};

const GlossaryTermDomainWidget = () => {
  const { entityRules } = useGenericContext();

  return (
    <DomainLabelV2
      showDomainHeading
      multiple={entityRules?.canAddMultipleDomains ?? true}
    />
  );
};

export const createGlossaryTermEntityLink = (
  fullyQualifiedName: string
): string => {
  return `<#E${ENTITY_LINK_SEPARATOR}glossaryTerm${ENTITY_LINK_SEPARATOR}${fullyQualifiedName}>`;
};

export const GlossaryTermListItemRenderer = (props: EntityReference) => {
  return (
    <Space>
      <IconTerm
        className="align-middle"
        color={DE_ACTIVE_COLOR}
        height={16}
        name="doc"
        width={16}
      />
      <Typography.Text>{getEntityName(props)}</Typography.Text>
    </Space>
  );
};

export const convertTermsToEntityReferences = (
  terms: TagLabel[]
): EntityReference[] => {
  return convertTagLabelsToEntityReferences(terms);
};

export const convertEntityReferencesToTerms = (
  refs: EntityReference[]
): TagLabel[] => {
  return convertEntityReferencesToTagLabels(refs, TagSource.Glossary);
};
