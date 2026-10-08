/*
 *  Copyright 2022 Collate.
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

import { DownOutlined, RightOutlined } from '@ant-design/icons';
import { Box, Typography } from '@openmetadata/ui-core-components';

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EntityType } from '../../../enums/entity.enum';
import { MlFeature } from '../../../generated/entity/data/mlmodel';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { handleKeyboardActivation } from '../../../utils/KeyboardUtil';
import './source-list.less';

const SourceList = ({ feature }: { feature: MlFeature }) => {
  const { t } = useTranslation();
  const [isActive, setIsActive] = useState(false);
  const showFeatureSources = useMemo(
    () => feature.featureSources && feature.featureSources.length && isActive,
    [feature, isActive]
  );

  return (
    <div className="m-t-sm">
      <Box
        inline
        align="center"
        className="layout-space layout-space-horizontal m-b-xs"
        gap={2}
        itemClassName="layout-space-item">
        <span
          aria-label={isActive ? t('label.collapse') : t('label.expand')}
          role="button"
          tabIndex={0}
          onClick={() => setIsActive((prev) => !prev)}
          onKeyDown={handleKeyboardActivation(() =>
            setIsActive((prev) => !prev)
          )}>
          {isActive ? (
            <DownOutlined className="text-xs text-primary cursor-pointer" />
          ) : (
            <RightOutlined className="text-xs text-primary cursor-pointer" />
          )}
        </span>
        <Typography className="font-medium m-y-0">
          {t('label.source-plural')}
        </Typography>
      </Box>
      {showFeatureSources &&
        feature.featureSources?.map((source, i) => (
          <Box
            className="layout-row feature-source-info"
            key={source.fullyQualifiedName}
            wrap="nowrap">
            <Box
              className="layout-column tw:block"
              style={{
                maxWidth: '4.166666666666666%',
                flex: `0 0 ${'4.166666666666666%'}`,
              }}>
              {String(i + 1).padStart(2, '0')}
            </Box>
            <Box
              className="layout-column tw:block"
              style={{ maxWidth: '25%', flex: `0 0 ${'25%'}` }}>
              <Typography color="secondary">{`${t('label.name')}:`}</Typography>
              <Typography className="m-l-xs">{source.name}</Typography>
            </Box>
            <Box
              className="layout-column tw:block"
              style={{ maxWidth: '25%', flex: `0 0 ${'25%'}` }}>
              <Typography color="secondary">{`${t('label.type')}:`}</Typography>
              <Typography className="m-l-xs">{source.dataType}</Typography>
            </Box>
            <Box
              className="layout-column tw:block"
              style={{
                maxWidth: '45.83333333333333%',
                flex: `0 0 ${'45.83333333333333%'}`,
              }}>
              <Box className="layout-row" wrap="wrap">
                <Box
                  className="layout-column tw:block"
                  style={{ flex: `0 0 ${'100px'}` }}>
                  <Typography color="secondary">
                    {`${t('label.data-entity', {
                      entity: t('label.source'),
                    })}:`}
                  </Typography>
                </Box>
                <Box
                  className="layout-column tw:block"
                  style={{ flex: 'auto' }}>
                  <Link
                    to={entityUtilClassBase.getEntityLink(
                      EntityType.TABLE,
                      source.dataSource?.fullyQualifiedName ||
                        source.dataSource?.name ||
                        ''
                    )}>
                    {source.dataSource?.fullyQualifiedName}
                  </Link>
                </Box>
              </Box>
            </Box>
          </Box>
        ))}
    </div>
  );
};

export default SourceList;
