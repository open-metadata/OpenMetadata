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

import { Owner } from '@openmetadata/ui-core-components';
import { isEmpty } from 'lodash';
import { lazy } from 'react';
import { useTranslation } from 'react-i18next';
import withSuspenseFallback from '../../components/AppRouter/withSuspenseFallback';
import {
    WidgetEditButton,
    WidgetPlusButton
} from '../../components/common/WidgetActionButton/WidgetActionButton';
import WidgetCard from '../../components/common/WidgetCard/WidgetCard';
import { useGenericContext } from '../../components/Customization/GenericProvider/GenericContext';
import { GlossaryTermDetailPageWidgetKeys } from '../../enums/CustomizeDetailPage.enum';
import { EntityType } from '../../enums/entity.enum';
import { EntityReference } from '../../generated/entity/type';
import type { WidgetConfig } from '../../pages/CustomizablePage/CustomizablePage.interface';
import { useOwnerDisplayProps } from '../../hooks/useOwnerDisplayProps';

const CommonWidgets = withSuspenseFallback(
  lazy(() =>
    import('../../components/DataAssets/CommonWidgets/CommonWidgets').then(
      (module) => ({ default: module.CommonWidgets })
    )
  )
);

const DomainLabelV2 = withSuspenseFallback(
  lazy(() =>
    import('../../components/DataAssets/DomainLabelV2/DomainLabelV2').then(
      (module) => ({ default: module.DomainLabelV2 })
    )
  )
);

const UserTeamSelectableList = withSuspenseFallback(
  lazy(() =>
    import(
      '../../components/common/UserTeamSelectableList/UserTeamSelectableList.component'
    ).then((m) => ({ default: m.UserTeamSelectableList }))
  ),
  null
);

const ReviewerLabelV2 = withSuspenseFallback(
  lazy(() =>
    import('../../components/DataAssets/ReviewerLabelV2/ReviewerLabelV2').then(
      (module) => ({ default: module.ReviewerLabelV2 })
    )
  )
);

const GlossaryTermReferences = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../../components/Glossary/GlossaryTerms/tabs/GlossaryTermReferences'
      )
  )
);

const GlossaryTermSynonyms = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../../components/Glossary/GlossaryTerms/tabs/GlossaryTermSynonyms'
      )
  )
);

const RelatedTerms = withSuspenseFallback(
  lazy(
    () => import('../../components/Glossary/GlossaryTerms/tabs/RelatedTerms')
  )
);

const WorkflowHistory = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../../components/Glossary/GlossaryTerms/tabs/WorkFlowTab/WorkflowHistory.component'
      )
  )
);

const GlossaryTermOwnerWidget = () => {
  const { data, onUpdate, permissions, isVersionView, entityRules } =
    useGenericContext<{ owners?: EntityReference[]; id: string }>();
  const { t } = useTranslation();
  const { toOwnersWithHref, renderOwnerContent } = useOwnerDisplayProps();

  const hasPermission = permissions?.EditOwners || permissions?.EditAll;

  const handleUpdatedOwner = async (updatedOwners?: EntityReference[]) => {
    await onUpdate({ ...data, owners: updatedOwners });
  };

  return (
    <WidgetCard
      dataTestId="glossary-right-panel-owner-link"
      headerExtra={
        !isVersionView && hasPermission ? (
          <UserTeamSelectableList
            hasPermission={Boolean(hasPermission)}
            listHeight={200}
            multiple={{
              user: entityRules.canAddMultipleUserOwners,
              team: entityRules.canAddMultipleTeamOwner,
            }}
            owner={data.owners}
            onUpdate={handleUpdatedOwner}>
            {isEmpty(data.owners) ? (
              <WidgetPlusButton
                data-testid="add-owner"
                title={t('label.add-entity', {
                  entity: t('label.owner-plural'),
                })}
              />
            ) : (
              <WidgetEditButton
                data-testid="edit-owner"
                title={t('label.edit-entity', {
                  entity: t('label.owner-plural'),
                })}
              />
            )}
          </UserTeamSelectableList>
        ) : null
      }
      isExpandDisabled={isEmpty(data.owners)}
      title={t('label.owner-plural')}>
      <Owner
        isCompactView={false}
        owners={toOwnersWithHref(data.owners ?? [])}
        renderOwnerContent={renderOwnerContent}
        showLabel={false}
      />
    </WidgetCard>
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
    return <GlossaryTermOwnerWidget />;
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
