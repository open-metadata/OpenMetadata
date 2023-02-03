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
import { Col, Row, Space, Typography } from 'antd';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EntityType } from '../../enums/entity.enum';
import { MlFeature } from '../../generated/entity/data/mlmodel';
import { getEntityLink } from '../../utils/TableUtils';
import './SourceList.style.less';

const SourceList = ({ feature }: { feature: MlFeature }) => {
  const { t } = useTranslation();
  const [isActive, setIsActive] = useState(false);
  const showFeatureSources = useMemo(
    () => feature.featureSources && feature.featureSources.length && isActive,
    [feature, isActive]
  );

  return (
    <div className="m-t-sm">
      <Space className="m-b-xs">
        <span onClick={() => setIsActive((prev) => !prev)}>
          {isActive ? (
            <DownOutlined className="text-xs text-primary cursor-pointer" />
          ) : (
            <RightOutlined className="text-xs text-primary cursor-pointer" />
          )}
        </span>
        <Typography.Text className="font-medium m-y-0">
          {t('label.source-plural')}
        </Typography.Text>
      </Space>
      {showFeatureSources &&
        feature.featureSources?.map((source, i) => (
          <Row
            className="feature-source-info"
            key={`${source.fullyQualifiedName}${i}`}
            wrap={false}>
            <Col span={2}>{String(i + 1).padStart(2, '0')}</Col>
            <Col span={6}>
              <Typography.Text className="text-grey-muted">
                {t('label.name')}:
              </Typography.Text>
              <Typography.Text className="m-l-xs">
                {source.name}
              </Typography.Text>
            </Col>
            <Col span={6}>
              <Typography.Text className="text-grey-muted">
                {t('label.type')}:
              </Typography.Text>
              <Typography.Text className="m-l-xs">
                {source.dataType}
              </Typography.Text>
            </Col>
            <Col span={10}>
              <Typography.Text className="text-grey-muted">
                {t('label.data-entity', {
                  entity: t('label.source'),
                })}
                :
              </Typography.Text>
              <Link
                className="m-l-xs"
                to={getEntityLink(
                  EntityType.TABLE,
                  source.dataSource?.fullyQualifiedName ||
                    source.dataSource?.name ||
                    ''
                )}>
                {source.dataSource?.fullyQualifiedName}
              </Link>
            </Col>
          </Row>
        ))}
    </div>
  );
};

export default SourceList;
