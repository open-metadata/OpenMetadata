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
import { Col, Row, Space, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getTableDetailsPath } from '../../../constants/constants';
import { JoinedWith } from '../../../generated/entity/data/table';
import { getCountBadge } from '../../../utils/CommonUtils';
import './frequently-joined-tables.style.less';

type Joined = JoinedWith & {
  name: string;
};

interface FrequentlyJoinedTablesProps {
  joinedTables: Joined[];
}

export const FrequentlyJoinedTables = ({
  joinedTables,
}: FrequentlyJoinedTablesProps) => {
  const { t } = useTranslation();

  return (
    <Row className="m-b-lg" gutter={[0, 8]}>
      <Col className="m-b" span={24}>
        <Typography.Text className="right-panel-label">
          {t('label.frequently-joined-table-plural')}
        </Typography.Text>
      </Col>
      <Col className="frequently-joint-data-container" span={24}>
        {joinedTables.map((table) => (
          <Space
            className="w-full frequently-joint-data"
            data-testid="related-tables-data"
            key={table.name}
            size={4}>
            <Link to={getTableDetailsPath(table.fullyQualifiedName)}>
              <Typography.Text className="frequently-joint-name">
                {table.name}
              </Typography.Text>
            </Link>
            {getCountBadge(table.joinCount, '', false)}
          </Space>
        ))}
      </Col>
    </Row>
  );
};
