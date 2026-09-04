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
  Badge,
  Card,
  FeaturedIcon,
  Tooltip,
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import { isEmpty } from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ServiceCategory } from '../../../enums/service.enum';
import { ServiceSummary } from '../../../generated/api/services/servicesOverview';
import { TagSource } from '../../../generated/type/tagLabel';
import connectionsRouterClassBase from '../../../utils/ConnectionsRouterClassBase';
import { formatDate } from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { stopPropagationIfInteractive } from '../../../utils/InteractiveTargetUtils';
import serviceUtilClassBase from '../../../utils/ServiceUtilClassBase';
import { OwnerLabel } from '../../common/OwnerLabel/OwnerLabel.component';
import TagsContainerV2 from '../../Tag/TagsContainerV2/TagsContainerV2';
import {
  CATEGORY_CONFIGS,
  ConnectionsServiceCategory,
} from './ConnectionsPage.constants';

interface ServiceConnectionCardProps {
  categoryKey: ServiceCategory;
  // The overview endpoint's slim projection: every field this card renders, and deliberately no
  // connection config.
  service: ServiceSummary;
  // On a specific category tab the category is fixed for every card, so the badge
  // is redundant and hidden; shown on the All tab where categories are mixed.
  showCategory?: boolean;
}

const ServiceConnectionCard: React.FC<ServiceConnectionCardProps> = ({
  categoryKey,
  service,
  showCategory = true,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const serviceLogo = serviceUtilClassBase.getServiceLogo(
    service.serviceType as string
  );
  const categoryConfig = CATEGORY_CONFIGS.find(
    (config) => config.key === (categoryKey as ConnectionsServiceCategory)
  );
  const serviceName = getEntityName(service);

  const handleClick = () => {
    const fqn = service.fullyQualifiedName || service.name;
    navigate(
      connectionsRouterClassBase.getServiceDetailsPath(categoryKey, fqn ?? '')
    );
  };

  return (
    <Card
      isClickable
      className="tw:flex tw:flex-col tw:gap-2.5 tw:p-4"
      data-testid={`service-card-${service.name}`}
      variant="elevated"
      onClick={handleClick}>
      <span className="tw:flex tw:w-full tw:min-w-0 tw:items-start tw:gap-2.5">
        {/* Neutral rather than brand: the connector logos carry their own colours, and a
            brand-tinted tile behind them reads as a selected state. */}
        <FeaturedIcon
          color="gray"
          icon={
            serviceLogo ? (
              <img
                alt={service.serviceType as string}
                className="tw:size-[22px] tw:object-contain"
                src={serviceLogo}
              />
            ) : undefined
          }
          radius="lg"
          shape="square"
          size="md"
        />
        <span className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col">
          {/* The card title truncates hard at this width, so the full name has to be
              reachable. Cards are few and large enough for a real Tooltip to be worth it; the
              list rows use a native `title` instead. */}
          {/* TooltipTrigger is a react-aria button, and usePress consumes the click rather than
              letting it bubble — so the name was a dead spot on an otherwise clickable card. It
              navigates itself instead, which also makes the name keyboard-reachable. */}
          <Tooltip title={serviceName}>
            <TooltipTrigger
              className="tw:w-full tw:text-left"
              onPress={handleClick}>
              <Typography
                ellipsis
                className="tw:cursor-pointer tw:text-primary"
                weight="semibold">
                {serviceName}
              </Typography>
            </TooltipTrigger>
          </Tooltip>
          <Typography className="tw:text-tertiary" size="text-xs">
            {service.serviceType as string}
          </Typography>
        </span>
      </span>

      {showCategory && categoryConfig && (
        <Badge
          bordered={false}
          className="tw:self-start tw:font-medium"
          color="success"
          size="sm">
          {t(categoryConfig.titleKey)}
        </Badge>
      )}

      {/* Owner avatars are links with their own popovers, and the card navigates on click — so
          those clicks have to stay with the avatar. Only those: an unconditional stopPropagation
          here also swallowed clicks on the surrounding padding and on the "no owners" dash, which
          made a large strip of the card look unclickable. `showLabel` is dropped because it only
          applies to the non-compact layout. */}
      <div role="presentation" onClick={stopPropagationIfInteractive}>
        <OwnerLabel
          isCompactView
          showDashPlaceholder
          avatarSize={20}
          maxVisibleOwners={1}
          owners={service.owners}
        />
      </div>

      <span className="tw:text-xs tw:font-normal tw:leading-5 tw:text-tertiary">
        {t('label.last-updated')} ·{' '}
        {service.updatedAt ? formatDate(service.updatedAt) : '—'}
      </span>

      {!isEmpty(service.tags) && (
        <TagsContainerV2
          permission={false}
          selectedTags={service.tags ?? []}
          sizeCap={2}
          tagType={TagSource.Classification}
        />
      )}
    </Card>
  );
};

export default ServiceConnectionCard;
