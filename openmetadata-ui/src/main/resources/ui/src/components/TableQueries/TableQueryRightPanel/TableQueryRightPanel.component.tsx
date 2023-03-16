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

import { Button, Col, Row, Space, Typography } from 'antd';
import OwnerWidgetWrapper from 'components/common/OwnerWidget/OwnerWidgetWrapper.component';
import { Query } from 'generated/entity/data/query';
import { Table } from 'generated/entity/data/table';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '/assets/svg/ic-edit.svg';

interface TableQueryRightPanelProps {
  query: Query;
}

const TableQueryRightPanel = ({ query }: TableQueryRightPanelProps) => {
  const { t } = useTranslation();
  const [isEditOwner, setIsEditOwner] = useState(false);

  const handleRemoveOwner = () => {
    console.log('handleRemoveOwner');
  };
  const handleUpdatedOwner = (owner: Table['owner']) => {
    console.log(owner);
  };

  return (
    <Row className="m-t-md" gutter={[16, 16]}>
      <Col span={24}>
        <Space className="w-full justify-between">
          <Typography.Text className="text-grey-muted">
            {t('label.owner')}
          </Typography.Text>
          <div>
            <Button
              className="flex-center p-0"
              icon={<EditIcon height={16} width={16} />}
              size="small"
              type="text"
              onClick={() => setIsEditOwner(true)}
            />
            {isEditOwner && (
              <OwnerWidgetWrapper
                currentUser={query.owner}
                hideWidget={() => setIsEditOwner(false)}
                removeOwner={handleRemoveOwner}
                updateUser={handleUpdatedOwner}
                visible={isEditOwner}
              />
            )}
          </div>
        </Space>
        {query.owner?.name || 'No owner'}
      </Col>
    </Row>
  );
};

export default TableQueryRightPanel;
