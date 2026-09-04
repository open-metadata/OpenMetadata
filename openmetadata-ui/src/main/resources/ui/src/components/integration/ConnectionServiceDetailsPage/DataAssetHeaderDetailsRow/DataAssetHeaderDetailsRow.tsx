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

import {
  Button,
  ButtonUtility,
  Dot,
  Popover,
  PopoverTrigger,
  Tooltip,
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import { Database01, Globe01, User03 } from '@untitledui/icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../../assets/svg/edit-new.svg';
import { getTierTags } from '../../../../utils/TablePureUtils';
import DomainSelectableList from '../../../common/DomainSelectableList/DomainSelectableList.component';
import { OwnerLabel } from '../../../common/OwnerLabel/OwnerLabel.component';
import TierCard from '../../../common/TierCard/TierCard';
import { UserTeamSelectableList } from '../../../common/UserTeamSelectableList/UserTeamSelectableList.component';
import { DataAssetHeaderDetailsRowProps } from './DataAssetHeaderDetailsRow.interface';
import './DataAssetHeaderDetailsRow.less';

const DataAssetHeaderDetailsRow: React.FC<DataAssetHeaderDetailsRowProps> = ({
  owners,
  domains,
  tags,
  visibilitySlot,
  hasEditPermission,
  onUpdateDomain,
  onUpdateOwners,
  onUpdateTier,
  className,
}) => {
  const { t } = useTranslation();
  const [tierPopoverOpen, setTierPopoverOpen] = useState(false);
  const tier = getTierTags(tags ?? []);
  const firstDomain = domains?.[0];
  const extraDomains = domains && domains.length > 1 ? domains.slice(1) : [];

  return (
    <div
      className={`tw:flex tw:items-center tw:gap-3 tw:mt-1 ${className ?? ''}`}
      data-testid="entity-meta-strip">
      {/* Domain */}
      <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-2">
        <Tooltip arrow title={t('label.domain')}>
          <TooltipTrigger className="tw:flex tw:cursor-default tw:items-center">
            <Globe01 className="tw:h-4 tw:w-4 tw:shrink-0 tw:text-utility-gray-500" />
          </TooltipTrigger>
        </Tooltip>
        {firstDomain ? (
          <Tooltip arrow title={firstDomain.displayName ?? firstDomain.name}>
            <TooltipTrigger className="tw:flex tw:min-w-0 tw:cursor-default tw:items-center">
              <Typography
                className="tw:block tw:max-w-[200px] tw:truncate"
                weight="regular">
                {firstDomain.displayName ?? firstDomain.name}
              </Typography>
            </TooltipTrigger>
          </Tooltip>
        ) : (
          <Typography weight="regular">
            {t('label.add-entity', { entity: t('label.domain') })}
          </Typography>
        )}
        {extraDomains?.length > 0 && (
          <PopoverTrigger>
            <Button
              className="tw:h-auto tw:min-h-0 tw:rounded-full tw:border-0 tw:bg-gray-100 tw:px-1.5 tw:py-0.5 tw:text-xs tw:font-medium tw:text-tertiary tw:shadow-none"
              color="tertiary"
              data-testid="domain-count-button"
              size="sm"
              type="button">
              +{extraDomains.length}
            </Button>
            <Popover containerClassName="tw:p-2">
              <div className="tw:flex tw:flex-col tw:gap-1.5">
                {extraDomains.map((d) => (
                  <div
                    className="tw:flex tw:items-center tw:gap-1.5"
                    key={d.id}>
                    <Globe01 className="tw:h-3.5 tw:w-3.5 tw:shrink-0 tw:text-fg-disabled" />
                    <Tooltip arrow title={d.displayName ?? d.name}>
                      <TooltipTrigger className="tw:flex tw:min-w-0 tw:cursor-default tw:items-center">
                        <Typography
                          className="tw:block tw:max-w-[240px] tw:truncate tw:text-secondary"
                          weight="regular">
                          {d.displayName ?? d.name}
                        </Typography>
                      </TooltipTrigger>
                    </Tooltip>
                  </div>
                ))}
              </div>
            </Popover>
          </PopoverTrigger>
        )}
        {hasEditPermission && onUpdateDomain && (
          <DomainSelectableList
            hasPermission
            isClearable
            multiple
            selectedDomain={domains}
            onUpdate={onUpdateDomain}>
            <ButtonUtility
              className="tw:h-5.5 tw:w-5.5 tw:p-1"
              color="tertiary"
              data-testid="edit-domain-button"
              icon={<EditIcon className="tw:h-4.5 tw:w-4.5 tw:text-primary" />}
              size="sm"
              type="button"
            />
          </DomainSelectableList>
        )}
      </div>

      <Dot className="tw:text-fg-disabled" size="xs" />
      {/* Owners */}
      <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-2 dashboard-details-page-owner-label">
        <Tooltip arrow title={t('label.owner')}>
          <TooltipTrigger className="tw:flex tw:cursor-default tw:items-center">
            <User03 className="tw:h-4 tw:w-4 tw:shrink-0 tw:text-utility-gray-500" />
          </TooltipTrigger>
        </Tooltip>
        {owners && owners.length > 0 ? (
          <OwnerLabel
            hasPermission={false}
            isCompactView={false}
            multiple={{ user: true, team: true }}
            owners={owners}
            showLabel={false}
            onUpdate={onUpdateOwners}
          />
        ) : (
          <Typography
            className="tw:block tw:max-w-[200px] tw:truncate"
            weight="regular">
            {t('label.add-entity', { entity: t('label.owner') })}
          </Typography>
        )}
        {hasEditPermission && onUpdateOwners && (
          <UserTeamSelectableList
            hasPermission
            multiple={{ user: true, team: true }}
            owner={owners}
            onUpdate={onUpdateOwners}>
            <ButtonUtility
              className="tw:h-5.5 tw:w-5.5 tw:p-1"
              color="tertiary"
              data-testid="edit-owner-button"
              icon={<EditIcon className="tw:h-4.5 tw:w-4.5 tw:text-primary" />}
              size="sm"
              type="button"
            />
          </UserTeamSelectableList>
        )}
      </div>
      <Dot className="tw:text-fg-disabled" size="xs" />
      {/* Tier */}
      <TierCard
        currentTier={tier?.tagFQN}
        popoverProps={{
          open: tierPopoverOpen,
          onOpenChange: setTierPopoverOpen,
        }}
        updateTier={onUpdateTier}>
        <div
          className="tw:flex tw:cursor-pointer tw:items-center tw:gap-2"
          data-testid="tier-container">
          <Tooltip arrow title={t('label.tier')}>
            <TooltipTrigger className="tw:flex tw:cursor-default tw:items-center">
              <Database01 className="tw:h-4 tw:w-4 tw:shrink-0 tw:text-utility-gray-500" />
            </TooltipTrigger>
          </Tooltip>
          <Typography
            className={tier ? 'tw:truncate' : 'tw:whitespace-nowrap'}
            weight="regular">
            {tier
              ? tier.displayName ?? tier.name ?? tier.tagFQN
              : t('label.add-entity', { entity: t('label.tier') })}
          </Typography>
          {hasEditPermission && onUpdateTier && (
            <ButtonUtility
              className="tw:h-5.5 tw:w-5.5 tw:p-1"
              color="tertiary"
              data-testid="edit-tier-button"
              icon={<EditIcon className=" tw:h-4.5 tw:w-4.5 tw:text-primary" />}
              size="sm"
              type="button"
              onClick={() => setTierPopoverOpen(true)}
            />
          )}
        </div>
      </TierCard>
      {visibilitySlot && (
        <>
          <Dot className="tw:text-fg-disabled" size="xs" />
          {visibilitySlot}
        </>
      )}
    </div>
  );
};

export default DataAssetHeaderDetailsRow;
