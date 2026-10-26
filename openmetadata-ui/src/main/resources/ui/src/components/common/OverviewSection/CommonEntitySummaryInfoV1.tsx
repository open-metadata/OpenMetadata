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
import { Button, Typography } from '@openmetadata/ui-core-components';
import { isNil } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createPath } from 'react-router-dom';
import { ReactComponent as IconExternalLink } from '../../../assets/svg/external-links.svg';
import { ICON_DIMENSION } from '../../../constants/constants';
import { NO_DATA_PLACEHOLDER_CLASS_NAME } from '../../../constants/EntitySummaryPanelUtils.constant';
import {
  CommonEntitySummaryInfoV1Props,
  EntityInfoItemV1,
} from './CommonEntitySummaryInfoV1.interface';
import './OverviewSection.less';

const CommonEntitySummaryInfoV1: React.FC<CommonEntitySummaryInfoV1Props> = ({
  entityInfo,
  componentType,
  isDomainVisible = false,
  excludedItems = [],
  onLinkClick,
}) => {
  const { t } = useTranslation();

  const visibleEntityInfo = useMemo(() => {
    return entityInfo.filter((info) => {
      if (excludedItems.includes(info.name)) {
        return false;
      }

      const isDomain =
        isDomainVisible && info.name === t('label.domain-plural');

      // If componentType is empty and item has no visible field, show it
      // Otherwise, check if componentType is included in visible array
      const hasVisibleField =
        info.visible !== undefined && info.visible.length > 0;
      const isVisibleInComponent =
        componentType === '' && !hasVisibleField
          ? true
          : (info.visible ?? []).includes(componentType);

      return isVisibleInComponent || isDomain;
    });
  }, [entityInfo, componentType, isDomainVisible, excludedItems]);

  const renderInfoValue = (info: EntityInfoItemV1) => {
    if (!info.isLink) {
      return (
        <Typography
          className="tw:flex-1"
          data-testid={`${info.name}-value`}
          size="text-xs"
          weight="medium">
          {isNil(info.value) ? '-' : info.value}
        </Typography>
      );
    }

    // Rendered outside Typography: the global `.prose-typography a` rule in
    // fonts.less would otherwise force the link to 14px.
    const isExternal = info.isExternal && info.value !== '-';
    const to = info.linkProps ?? info.url ?? '';

    return (
      <div className="tw:flex-1" data-testid={`${info.name}-value`}>
        {isExternal ? (
          <Button
            className="tw:whitespace-normal"
            color="link-color"
            href={info.url}
            iconTrailing={
              <IconExternalLink
                data-testid="external-link-icon"
                {...ICON_DIMENSION}
              />
            }
            rel="noopener noreferrer"
            size="xs"
            target="_blank">
            {info.value}
          </Button>
        ) : (
          <Button
            className="tw:whitespace-normal"
            color="link-color"
            href={typeof to === 'string' ? to : createPath(to)}
            size="xs"
            onPress={onLinkClick}>
            {info.value}
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="overview-section">
      {visibleEntityInfo.length === 0 ? (
        <div className="overview-row">
          <Typography
            className={NO_DATA_PLACEHOLDER_CLASS_NAME}
            data-testid="no-data-placeholder">
            {t('label.no-overview-available')}
          </Typography>
        </div>
      ) : (
        visibleEntityInfo.map((info) => (
          <div className="overview-row" key={info.name}>
            <Typography
              className="tw:w-30 tw:shrink-0 tw:text-secondary"
              data-testid={`${info.name}-label`}
              size="text-xs"
              weight="regular">
              {info.name}
            </Typography>
            {renderInfoValue(info)}
          </div>
        ))
      )}
    </div>
  );
};

export default CommonEntitySummaryInfoV1;
