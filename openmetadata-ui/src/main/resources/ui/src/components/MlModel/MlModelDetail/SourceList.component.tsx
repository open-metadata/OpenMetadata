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
import { Typography } from '@openmetadata/ui-core-components';
import { Col, Row, Space } from 'antd';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EntityType } from '../../../enums/entity.enum';
import { MlFeature } from '../../../generated/entity/data/mlmodel';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
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
      <Space className="m-b-xs">
        <span onClick={() => setIsActive((prev) => !prev)}>
          {isActive ? (
            <DownOutlined className="text-xs text-primary cursor-pointer" />
          ) : (
            <RightOutlined className="text-xs text-primary cursor-pointer" />
          )}
        </span>
        <Typography className="font-medium m-y-0">
          {t('label.source-plural')}
        </Typography>
      </Space>
      {showFeatureSources &&
        feature.featureSources?.map((source, i) => (
          <Row
            className="feature-source-info"
            key={`${source.fullyQualifiedName}${i}`}
            wrap={false}>
            <Col span={1}>{String(i + 1).padStart(2, '0')}</Col>
            <Col span={6}>
              <Typography className="text-grey-muted">
                {`${t('label.name')}:`}
              </Typography>
              <Typography className="m-l-xs">{source.name}</Typography>
            </Col>
            <Col span={6}>
              <Typography className="text-grey-muted">
                {`${t('label.type')}:`}
              </Typography>
              <Typography className="m-l-xs">{source.dataType}</Typography>
            </Col>
            <Col span={11}>
              <Row>
                <Col flex="100px">
                  <Typography className="text-grey-muted">
                    {`${t('label.data-entity', {
                      entity: t('label.source'),
                    })}:`}
                  </Typography>
                </Col>
                <Col flex="auto">
                  <Link
                    to={entityUtilClassBase.getEntityLink(
                      EntityType.TABLE,
                      source.dataSource?.fullyQualifiedName ||
                        source.dataSource?.name ||
                        ''
                    )}>
                    {source.dataSource?.fullyQualifiedName}
                  </Link>
                </Col>
              </Row>
            </Col>
          </Row>
        ))}
    </div>
  );
};

export default SourceList;
