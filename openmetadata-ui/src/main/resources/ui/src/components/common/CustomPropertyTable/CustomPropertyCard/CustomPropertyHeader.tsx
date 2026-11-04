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
import { Badge, Box, Typography } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { getTextFromHtmlString } from '../../../../utils/BlockEditorPureUtils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import {
  HEADER_BADGE_CLASS,
  TYPE_ICON_TILE_CLASS,
} from './CustomPropertyCard.constants';
import { PropertyViewProps } from './CustomPropertyCard.interface';
import {
  getPropertyItemCount,
  getPropertyTypeMeta,
  isPropertyValueEmpty,
} from './CustomPropertyCard.utils';
import { getPropertyRenderer } from './CustomPropertyRenderers';

interface CustomPropertyHeaderProps extends PropertyViewProps {
  className?: string;
}

/** Type tile, name, item count, type badge, type addon and description of one custom property. */
export const CustomPropertyHeader = ({
  className,
  isCompact = false,
  property,
  value,
}: CustomPropertyHeaderProps) => {
  const { t } = useTranslation();
  const typeName = property.propertyType.name;
  const meta = getPropertyTypeMeta(typeName);
  const { TitleAddon } = getPropertyRenderer(typeName);
  const TypeIcon = meta.icon;
  const itemCount = getPropertyItemCount(typeName, value);
  const description = property.description
    ? getTextFromHtmlString(property.description)
    : '';

  return (
    <Box align="start" className={className} gap={3}>
      <Box
        aria-hidden
        align="center"
        className={`tw:size-10 tw:shrink-0 tw:rounded-lg tw:border ${
          TYPE_ICON_TILE_CLASS[meta.color]
        }`}
        justify="center">
        <TypeIcon className="tw:size-5" />
      </Box>
      {/* Title (20px) + 2px + subtitle (18px) matches the 40px icon tile. */}
      <Box className="tw:min-w-0 tw:flex-1 tw:gap-0.5" direction="col">
        <Box
          align="center"
          className="tw:min-h-5"
          gap={2}
          wrap={isCompact ? 'nowrap' : 'wrap'}>
          {/* Plain heading: Typography's prose styles size h3 at 20px. */}
          <h3
            className={classNames(
              'tw:m-0 tw:text-sm tw:leading-5 tw:font-semibold tw:text-primary',
              { 'tw:min-w-0 tw:truncate': isCompact }
            )}
            data-testid="property-name">
            {getEntityName(property)}
          </h3>
          {itemCount !== undefined && (
            <Badge
              className={HEADER_BADGE_CLASS}
              color="gray"
              data-testid="property-item-count"
              size="sm"
              type="modern">
              {itemCount}
            </Badge>
          )}
          <Badge
            className={HEADER_BADGE_CLASS}
            color={meta.color}
            data-testid="property-type-badge"
            size="sm"
            type="color">
            {t(meta.labelKey)}
          </Badge>
          {TitleAddon && !isPropertyValueEmpty(typeName, value) && (
            <TitleAddon property={property} value={value} />
          )}
        </Box>
        {description && (
          <Typography
            className={classNames(
              'tw:text-left tw:leading-[18px]',
              isCompact ? 'tw:line-clamp-1' : 'tw:line-clamp-2'
            )}
            color="secondary"
            size="text-xs"
            title={description}>
            {description}
          </Typography>
        )}
      </Box>
    </Box>
  );
};
