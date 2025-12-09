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
import Icon from '@ant-design/icons/lib/components/Icon';
import { Typography } from '@mui/material';
import classNames from 'classnames';
import { isNil } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as IconExternalLink } from '../../../assets/svg/external-links.svg';
import { ICON_DIMENSION } from '../../../constants/constants';
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
      return isNil(info.value) ? '-' : info.value;
    }

    if (info.isExternal && info.value !== '-') {
      return (
        <a className="summary-item-link" href={info.url} target="_blank">
          {info.value}
          <Icon
            className="m-l-xs"
            component={IconExternalLink}
            data-testid="external-link-icon"
            style={ICON_DIMENSION}
          />
        </a>
      );
    }

    return (
      <Link
        className="summary-item-link"
        to={info.linkProps ?? info.url ?? ''}
        onClick={onLinkClick}>
        {info.value}
      </Link>
    );
  };

  return (
    <div className="overview-section">
      {visibleEntityInfo.length === 0 ? (
        <div className="overview-row">
          <Typography
            className="no-data-placeholder"
            data-testid="no-data-placeholder">
            {t('label.no-overview-available')}
          </Typography>
        </div>
      ) : (
        visibleEntityInfo.map((info) => (
          <div className="overview-row" key={info.name}>
            <span
              className={classNames('overview-label')}
              data-testid={`${info.name}-label`}>
              {info.name}
            </span>
            <span
              className={classNames('overview-value text-grey-body')}
              data-testid={`${info.name}-value`}>
              {renderInfoValue(info)}
            </span>
          </div>
        ))
      )}
    </div>
  );
};

export default CommonEntitySummaryInfoV1;
