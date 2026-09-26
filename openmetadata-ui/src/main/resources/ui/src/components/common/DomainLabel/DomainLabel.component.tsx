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
import { Card, Divider, Typography } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { EntityReference } from '../../../generated/entity/type';
import {
  getDomainsContentKey,
  saveDomainViaApi,
  saveDomainViaOnUpdate,
} from '../../../utils/DomainSyncUtils';
import { AssetsUnion } from '../../DataAssets/AssetsSelectionModal/AssetSelectionModal.interface';
import {
  WidgetEditButton,
  WidgetPlusButton,
} from '../WidgetActionButton/WidgetActionButton';
import WidgetCard from '../WidgetCard/WidgetCard';
import DomainSelect from '../DomainSelect/DomainSelect';
import { DomainSelectTrigger } from '../DomainSelect/DomainSelectTrigger';
import DomainSelectableList from '../DomainSelectableList/DomainSelectableList.component';
import DomainTags from '../DomainTags/DomainTags';
import './domain-label.less';
import { ReactComponent as DomainIcon } from '../../../assets/svg/ic-domain.svg';
import { DomainLabelProps } from './DomainLabel.interface';

export const DomainLabel = ({
  showDashPlaceholder,
  afterDomainUpdateAction,
  hasPermission,
  domains,
  domainDisplayName,
  entityType,
  entityFqn,
  entityId,
  textClassName,
  labelClassName,
  showDomainHeading = false,
  multiple = false,
  headerLayout = false,
  isClearable,
  variant = 'default',
  onUpdate,
}: DomainLabelProps) => {
  const { t } = useTranslation();
  const [activeDomain, setActiveDomain] = useState<EntityReference[]>([]);

  const defaultDomainText = useMemo(() => {
    return showDashPlaceholder
      ? NO_DATA_PLACEHOLDER
      : t('label.no-entity', { entity: t('label.domain-plural') });
  }, [showDashPlaceholder]);

  const widgetTitle = useMemo(
    () => (multiple ? t('label.domain-plural') : t('label.domain')),
    [multiple, t]
  );

  const handleDomainSave = useCallback(
    async (selectedDomain: EntityReference | EntityReference[]) => {
      if (onUpdate) {
        await saveDomainViaOnUpdate(selectedDomain, onUpdate, setActiveDomain);

        return;
      }

      await saveDomainViaApi(
        selectedDomain,
        entityType as AssetsUnion,
        entityFqn,
        entityId,
        setActiveDomain,
        afterDomainUpdateAction
      );
    },
    [entityType, entityId, entityFqn, onUpdate, afterDomainUpdateAction]
  );

  useEffect(() => {
    let nextDomains: EntityReference[] = [];
    if (Array.isArray(domains)) {
      nextDomains = domains;
    } else if (domains) {
      nextDomains = [domains];
    }

    // `domains` arrives as a fresh array reference on every context re-render.
    // Setting state unconditionally churns `activeDomain`'s identity, remounting
    // the DomainSelectableList subtree and collapsing an open picker
    // mid-interaction. Only commit when the referenced domains actually changed;
    // return the previous reference otherwise so React bails out of the update.
    setActiveDomain((prev) =>
      getDomainsContentKey(prev) === getDomainsContentKey(nextDomains)
        ? prev
        : nextDomains
    );
  }, [domains]);

  const domainLink = useMemo(() => {
    if (!isEmpty(activeDomain)) {
      return (
        <DomainTags
          domains={activeDomain}
          labels={
            Array.isArray(domainDisplayName) ? domainDisplayName : undefined
          }
          maxVisible={headerLayout && multiple ? 1 : activeDomain.length}
        />
      );
    }

    return (
      <Typography
        className={classNames(
          'domain-link-text',
          { 'font-medium text-sm': !showDomainHeading },
          textClassName
        )}
        data-testid="no-domain-text">
        {defaultDomainText}
      </Typography>
    );
  }, [
    activeDomain,
    domainDisplayName,
    showDomainHeading,
    textClassName,
    multiple,
    headerLayout,
    defaultDomainText,
  ]);

  const selectableList = useMemo(() => {
    return (
      hasPermission && (
        <DomainSelectableList
          hasPermission={Boolean(hasPermission)}
          multiple={multiple}
          selectedDomain={activeDomain}
          onUpdate={handleDomainSave}
        />
      )
    );
  }, [hasPermission, activeDomain, handleDomainSave, multiple]);

  // The widget chrome drives the picker from its own plus/edit button, so it
  // uses DomainSelect directly rather than DomainSelectableList's wrapper.
  const widgetEditor = useMemo(() => {
    if (!hasPermission) {
      return null;
    }

    const renderTrigger = ({ toggle }: { toggle: () => void }) => (
      <DomainSelectTrigger toggle={toggle}>
        {isEmpty(activeDomain) ? (
          <WidgetPlusButton
            data-testid="add-domain"
            title={t('label.add-entity', { entity: widgetTitle })}
          />
        ) : (
          <WidgetEditButton
            data-testid="edit-domain"
            title={t('label.edit-entity', { entity: widgetTitle })}
          />
        )}
      </DomainSelectTrigger>
    );

    return (
      <DomainSelect
        hasPermission
        data-testid="domain-selectable-tree"
        isClearable={isClearable}
        multiple={multiple}
        renderTrigger={renderTrigger}
        selectedDomain={activeDomain}
        triggerVariant="button"
        onUpdate={
          handleDomainSave as (
            domain: EntityReference | EntityReference[] | undefined
          ) => Promise<void>
        }
      />
    );
  }, [
    hasPermission,
    activeDomain,
    handleDomainSave,
    isClearable,
    multiple,
    widgetTitle,
    t,
  ]);

  const label = useMemo(() => {
    if (variant === 'widget') {
      const chips = <DomainTags domains={activeDomain} />;

      if (showDomainHeading) {
        return (
          <WidgetCard
            headerExtra={widgetEditor}
            isExpandDisabled={isEmpty(activeDomain)}
            title={widgetTitle}>
            {!isEmpty(activeDomain) && chips}
          </WidgetCard>
        );
      }

      return (
        <Card
          className="d-flex items-center gap-1 flex-wrap"
          data-testid="header-domain-container">
          {chips}
          {widgetEditor}
        </Card>
      );
    }

    if (variant === 'profile-card') {
      return (
        <div className="d-flex flex-col mb-4 w-full p-[20px] user-profile-card">
          <div className="user-profile-card-header d-flex items-center justify-start gap-2 w-full">
            <div style={{ width: '16px' }}>
              <DomainIcon height={16} style={{ marginLeft: '2px' }} />
            </div>

            <div className="d-flex justify-between w-full">
              <Typography className="text-sm font-medium p-l-xss">
                {t('label.domain-plural')}
              </Typography>
              {selectableList}
            </div>
          </div>
          <div className="user-profile-card-body d-flex justify-start gap-2">
            <div className="user-page-icon d-flex-center">
              <Divider className="tw:h-full" orientation="vertical" />
            </div>
            <div
              className="d-flex flex-col items-start gap-1 flex-wrap justify-center"
              data-testid="header-domain-container">
              {domainLink}
            </div>
          </div>
        </div>
      );
    }

    if (showDomainHeading) {
      return (
        <>
          <div
            className="d-flex text-sm  font-medium items-center m-b-xs"
            data-testid="header-domain-container">
            {!headerLayout ? (
              <Typography className="right-panel-label m-r-xss">
                {t('label.domain-plural')}
              </Typography>
            ) : (
              <Typography
                as="span"
                className={classNames(
                  'domain-link right-panel-label m-r-xss',
                  labelClassName
                )}>
                {activeDomain.length > 0
                  ? t('label.domain-plural')
                  : defaultDomainText}
              </Typography>
            )}
            {selectableList}
          </div>

          <div className="d-flex  text-sm font-medium items-center gap-2 flex-wrap">
            {domainLink}
          </div>
        </>
      );
    }

    return (
      <div className="d-flex flex-col gap-2 justify-start">
        {headerLayout && (
          <div
            className="d-flex text-sm gap-1 font-medium items-center "
            data-testid="header-domain-container">
            <Typography
              as="span"
              className={classNames(
                'domain-link right-panel-label m-r-xss',
                labelClassName
              )}>
              {t('label.domain-plural')}
            </Typography>
            {selectableList}
          </div>
        )}

        <div
          className="d-flex no-underline items-center gap-2 flex-wrap"
          data-testid="header-domain-container">
          {domainLink}
          {!headerLayout && selectableList}
        </div>
      </div>
    );
  }, [
    activeDomain,
    hasPermission,
    selectableList,
    labelClassName,
    variant,
    domainLink,
    widgetEditor,
    widgetTitle,
    showDomainHeading,
    t,
  ]);

  return label;
};
