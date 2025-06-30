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
import { Col, Row, Typography } from 'antd';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as IconExternalLink } from '../../../../assets/svg/external-links.svg';
import { ICON_DIMENSION } from '../../../../constants/constants';
import { CommonEntitySummaryInfoProps } from './CommonEntitySummaryInfo.interface';

function CommonEntitySummaryInfo({
  entityInfo,
  componentType,
  isDomainVisible,
}: CommonEntitySummaryInfoProps) {
  const { t } = useTranslation();

  return (
    <Row className="text-sm" gutter={[0, 4]}>
      {entityInfo.map((info) => {
        const isDomain = isDomainVisible && info.name === t('label.domain');

        return info.visible?.includes(componentType) || isDomain ? (
          <Col key={info.name} span={24}>
            <Row gutter={[16, 32]}>
              <Col span={8}>
                <Typography.Text
                  className="summary-item-key font-semibold"
                  data-testid={`${info.name}-label`}>
                  {info.name}
                </Typography.Text>
              </Col>
              <Col span={16}>
                {info.isLink ? (
                  info.isExternal ? (
                    <a
                      data-testid={`${info.name}-value`}
                      href={info.url}
                      target="_blank">
                      {info.value}
                      <Icon
                        className="m-l-xs"
                        component={IconExternalLink}
                        data-testid="external-link-icon"
                        style={ICON_DIMENSION}
                      />
                    </a>
                  ) : (
                    <Link
                      data-testid={`${info.name}-value`}
                      to={info.linkProps ?? info.url ?? ''}>
                      {info.value}
                    </Link>
                  )
                ) : (
                  <Typography.Text
                    className={classNames('summary-item-value text-grey-body')}
                    data-testid={`${info.name}-value`}>
                    {info.value}
                  </Typography.Text>
                )}
              </Col>
            </Row>
          </Col>
        ) : null;
      })}
    </Row>
  );
}

export default CommonEntitySummaryInfo;
