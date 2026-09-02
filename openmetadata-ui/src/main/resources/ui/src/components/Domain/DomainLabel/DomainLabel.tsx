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

import {
  Button,
  Popover,
  PopoverTrigger,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { compare } from 'fast-json-patch';
import { get, isEmpty, isUndefined } from 'lodash';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { EntityReference } from '../../../generated/entity/type';
import {
  getAPIfromSource,
  getEntityAPIfromSource,
} from '../../../utils/Assets/AssetsUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getDomainPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { AssetsUnion } from '../../DataAssets/AssetsSelectionModal/AssetSelectionModal.interface';
import { DataAssetWithDomains } from '../../DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import Tag from '../../common/atoms/Tag/Tag';
import DomainSelectableList from '../../common/DomainSelectableList/DomainSelectableList.component';
import { NewDomainLabelProps } from './DomainLabel.interface';

const DEFAULT_SIZE_CAP = 5;

const DomainLabel: FC<NewDomainLabelProps> = ({
  domains,
  mode = 'display',
  entityType,
  entityFqn,
  entityId,
  hasPermission = false,
  multiple = false,
  onUpdate,
  afterDomainUpdateAction,
  showDashPlaceholder = false,
  isClearable = false,
  sizeCap = DEFAULT_SIZE_CAP,
  className,
}) => {
  const { t } = useTranslation();
  const [activeDomains, setActiveDomains] = useState<EntityReference[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  useEffect(() => {
    if (domains) {
      setActiveDomains(Array.isArray(domains) ? domains : [domains]);
    } else {
      setActiveDomains([]);
    }
  }, [domains]);

  const handleSave = useCallback(
    async (selected: EntityReference | EntityReference[]) => {
      if (onUpdate) {
        await onUpdate(selected);
        const updated = Array.isArray(selected)
          ? selected
          : isEmpty(selected)
          ? []
          : [selected];
        setActiveDomains(updated);

        return;
      }

      try {
        const entityDetails = await getEntityAPIfromSource(
          entityType as AssetsUnion
        )(entityFqn, { fields: 'domains' });

        if (entityDetails) {
          const patch = compare(entityDetails, {
            ...entityDetails,
            domains: Array.isArray(selected)
              ? selected
              : isEmpty(selected)
              ? []
              : [selected],
          });
          const api = getAPIfromSource(entityType as AssetsUnion);
          const result = await api(entityId, patch);
          const updatedDomains = get(result, 'domains', []);
          setActiveDomains(Array.isArray(updatedDomains) ? updatedDomains : []);

          if (!isUndefined(afterDomainUpdateAction)) {
            afterDomainUpdateAction(result as DataAssetWithDomains);
          }
        }
      } catch (err) {
        showErrorToast(err as AxiosError);
      }
    },
    [entityType, entityId, entityFqn, onUpdate, afterDomainUpdateAction]
  );

  const visibleDomains = useMemo(
    () =>
      showAll || sizeCap < 0
        ? activeDomains
        : activeDomains.slice(0, sizeCap),
    [activeDomains, sizeCap, showAll]
  );

  const overflowCount = useMemo(
    () => (sizeCap >= 0 ? Math.max(0, activeDomains.length - sizeCap) : 0),
    [activeDomains, sizeCap]
  );

  const renderChip = useCallback((domain: EntityReference) => {
    const label = getEntityName(domain);
    const href = getDomainPath(domain.fullyQualifiedName);
    const color = (
      domain as EntityReference & { style?: { color?: string } }
    )?.style?.color;

    return (
      <Tooltip key={domain.id} placement="top" title={label}>
        <Link
          className="tw:no-underline"
          data-testid="domain-tag-redirect-link"
          to={href}>
          <Tag
            color={color}
            data-testid="domain-tag"
            label={label}
            size="sm"
            variant="domain"
          />
        </Link>
      </Tooltip>
    );
  }, []);

  const emptyState = useMemo(
    () => (
      <Typography className="tw:text-tertiary" size="text-sm">
        {showDashPlaceholder
          ? NO_DATA_PLACEHOLDER
          : t('label.no-entity', { entity: t('label.domain-plural') })}
      </Typography>
    ),
    [showDashPlaceholder, t]
  );

  if (mode === 'selector') {
    return (
      <div
        className={classNames('w-full', className)}
        data-testid="domain-label-selector">
        <div className="d-flex flex-wrap gap-2 align-center">
          {visibleDomains.map(renderChip)}
          {overflowCount > 0 && (
            <PopoverTrigger
              isOpen={popoverOpen}
              onOpenChange={setPopoverOpen}>
              <button
                className="tw:text-xs tw:text-primary tw:bg-transparent tw:border-0 tw:cursor-pointer"
                data-testid="domain-more-count">
                {`+${overflowCount} ${t('label.more-lowercase')}`}
              </button>
              <Popover containerClassName="tw:flex tw:flex-wrap tw:gap-2 tw:p-2">
                {activeDomains.slice(sizeCap).map(renderChip)}
              </Popover>
            </PopoverTrigger>
          )}
          {hasPermission && (
            <DomainSelectableList
              hasPermission={hasPermission}
              isClearable={isClearable}
              multiple={multiple}
              selectedDomain={activeDomains}
              onUpdate={handleSave}
            />
          )}
          {isEmpty(activeDomains) && !hasPermission && emptyState}
        </div>
      </div>
    );
  }

  if (isEmpty(activeDomains)) {
    return emptyState;
  }

  return (
    <div
      className={classNames('d-flex flex-wrap gap-2', className)}
      data-testid="domain-label">
      {visibleDomains.map(renderChip)}
      {overflowCount > 0 && (
        <Button
          color="link-color"
          data-testid="domain-read-more"
          size="sm"
          onClick={() => setShowAll((prev) => !prev)}>
          {showAll
            ? t('label.less')
            : t('label.plus-count-more', { count: overflowCount })}
        </Button>
      )}
    </div>
  );
};

export default DomainLabel;
