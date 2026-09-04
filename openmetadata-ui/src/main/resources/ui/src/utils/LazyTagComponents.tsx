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
import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { DomainLabelProps } from '../components/common/DomainLabel/DomainLabel.interface';
import { EntityDetailWidgetSkeleton } from '../components/common/Skeleton/EntityDetailWidgetSkeleton/EntityDetailWidgetSkeleton.component';
import {
    WidgetEditButton,
    WidgetPlusButton
} from '../components/common/WidgetActionButton/WidgetActionButton';
import WidgetCard from '../components/common/WidgetCard/WidgetCard';
import { useGenericContext } from '../components/Customization/GenericProvider/GenericContext';
import { EntityType } from '../enums/entity.enum';
import { EntityReference } from '../generated/entity/type';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import { useOwnerDisplayProps } from '../hooks/useOwnerDisplayProps';

const CommonWidgets = lazy(() =>
  import('../components/DataAssets/CommonWidgets/CommonWidgets').then((m) => ({
    default: m.CommonWidgets,
  }))
);

const DomainLabelV2 = lazy(() =>
  import('../components/DataAssets/DomainLabelV2/DomainLabelV2').then((m) => ({
    default: m.DomainLabelV2,
  }))
);

const UserTeamSelectableList = lazy(() =>
  import(
    '../components/common/UserTeamSelectableList/UserTeamSelectableList.component'
  ).then((m) => ({ default: m.UserTeamSelectableList }))
);

interface LazyCommonWidgetsProps {
  widgetConfig: WidgetConfig;
  entityType: EntityType;
  showTaskHandler?: boolean;
}

interface OwnerWidgetFromContextProps {
  dataTestId?: string;
  hasPermission?: boolean;
}

const OwnerWidgetFromContext = ({
  dataTestId = 'glossary-right-panel-owner-link',
  hasPermission: permissionProp,
}: OwnerWidgetFromContextProps) => {
  const { data, onUpdate, permissions, isVersionView, entityRules } =
    useGenericContext<{ owners?: EntityReference[]; id: string }>();
  const { t } = useTranslation();
  const { toOwnersWithHref, renderOwnerContent } = useOwnerDisplayProps();

  const hasPermission =
    permissionProp ?? (permissions?.EditOwners || permissions?.EditAll);

  const handleUpdatedOwner = async (updatedOwners?: EntityReference[]) => {
    await onUpdate({ ...data, owners: updatedOwners });
  };

  return (
    <WidgetCard
      dataTestId={dataTestId}
      headerExtra={
        !isVersionView && hasPermission ? (
          <Suspense fallback={null}>
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
          </Suspense>
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

export const LazyCommonWidgets = (props: LazyCommonWidgetsProps) => (
  <Suspense fallback={<EntityDetailWidgetSkeleton />}>
    <CommonWidgets {...props} />
  </Suspense>
);

export const LazyDomainLabelV2 = (props: Partial<DomainLabelProps>) => (
  <Suspense fallback={null}>
    <DomainLabelV2 {...props} />
  </Suspense>
);

export const LazyOwnerLabelV2 = (props: OwnerWidgetFromContextProps) => (
  <OwnerWidgetFromContext {...props} />
);
