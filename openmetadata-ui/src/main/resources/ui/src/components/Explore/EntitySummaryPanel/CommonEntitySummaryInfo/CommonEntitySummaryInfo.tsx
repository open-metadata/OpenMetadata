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

import Icon from '@ant-design/icons/lib/components/Icon';
import { getLayoutGutter } from '../../../../utils/common/layout.utils';

import classNames from 'classnames';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as IconExternalLink } from '../../../../assets/svg/external-links.svg';
import { ICON_DIMENSION } from '../../../../constants/constants';
import { getSafeHttpUrl } from '../../../../utils/StringUtils';
import { CommonEntitySummaryInfoProps } from './CommonEntitySummaryInfo.interface';

import { Grid, Typography } from '@openmetadata/ui-core-components';
import './common-entity-summary.less';

function CommonEntitySummaryInfo({
  entityInfo,
  componentType,
  isDomainVisible,
}: CommonEntitySummaryInfoProps) {
  const { t } = useTranslation();

  return (
    <Grid
      className="layout-row layout-grid text-sm common-entity-summary-info"
      style={getLayoutGutter(0, 4)}>
      {entityInfo.map((info) => {
        const isDomain =
          isDomainVisible && info.name === t('label.domain-plural');

        if (!(info.visible?.includes(componentType) || isDomain)) {
          return null;
        }

        let valueContent: ReactNode;
        if (info.isLink && info.isExternal) {
          valueContent = (
            <a
              className="summary-item-link"
              data-testid={`${info.name}-value`}
              href={getSafeHttpUrl(info.url)}
              rel="noopener noreferrer"
              target="_blank">
              {info.value}
              <Icon
                className="m-l-xs"
                component={IconExternalLink}
                data-testid="external-link-icon"
                style={ICON_DIMENSION}
              />
            </a>
          );
        } else if (info.isLink) {
          valueContent = (
            <Link
              className="summary-item-link"
              data-testid={`${info.name}-value`}
              to={info.linkProps ?? info.url ?? ''}>
              {info.value}
            </Link>
          );
        } else {
          valueContent = (
            <Typography
              className={classNames('summary-item-value text-grey-body')}
              data-testid={`${info.name}-value`}>
              {info.value}
            </Typography>
          );
        }

        return (
          <Grid.Item className="layout-column" key={info.name} span={24}>
            <Grid
              className="layout-row layout-grid"
              style={getLayoutGutter(16, 32)}>
              <Grid.Item className="layout-column" span={8}>
                <Typography
                  className="summary-item-key font-semibold"
                  data-testid={`${info.name}-label`}>
                  {info.name}
                </Typography>
              </Grid.Item>
              <Grid.Item className="layout-column" span={16}>
                {valueContent}
              </Grid.Item>
            </Grid>
          </Grid.Item>
        );
      })}
    </Grid>
  );
}

export default CommonEntitySummaryInfo;
