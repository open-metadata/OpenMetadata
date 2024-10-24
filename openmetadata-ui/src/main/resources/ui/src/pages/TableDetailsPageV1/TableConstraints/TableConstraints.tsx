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
import { Space, Typography } from 'antd';
import { isEmpty } from 'lodash';
import React, { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Table } from '../../../generated/entity/data/table';
import {
  getSupportedConstraints,
  renderTableConstraints,
} from '../../../utils/TableUtils';
import './table-constraints.less';

interface TableConstraintsProps {
  constraints: Table['tableConstraints'];
}

const TableConstraints: FC<TableConstraintsProps> = ({ constraints }) => {
  const { t } = useTranslation();

  const supportedConstraints = useMemo(
    () => getSupportedConstraints(constraints),
    [constraints]
  );

  if (isEmpty(supportedConstraints)) {
    return null;
  }

  return (
    <Space className="p-b-sm" direction="vertical">
      <Typography.Text className="right-panel-label">
        {t('label.table-constraints')}
      </Typography.Text>
      {renderTableConstraints(supportedConstraints)}
    </Space>
  );
};

export default TableConstraints;
