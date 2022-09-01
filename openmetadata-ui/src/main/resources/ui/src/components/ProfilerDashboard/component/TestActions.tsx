/*
 *  Copyright 2022 Collate
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

import { Button, Row, Tooltip } from 'antd';
import { AxiosError } from 'axios';
import React, { useEffect, useState } from 'react';
import { NO_PERMISSION_FOR_ACTION } from '../../../constants/HelperTextUtil';
import { TestCase } from '../../../generated/tests/testCase';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { usePermissionProvider } from '../../PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../PermissionProvider/PermissionProvider.interface';

interface Props {
  record: TestCase;
  onTestSelect: (value: TestCase) => void;
  onTestEdit: (value: TestCase) => void;
}

const TestActions = ({ record, onTestEdit, onTestSelect }: Props) => {
  const { getEntityPermission } = usePermissionProvider();
  const [permission, setPermission] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );

  const fetchTestCasePermission = async () => {
    try {
      const response = await getEntityPermission(
        ResourceEntity.TEST_CASE,
        record.id as string
      );
      setPermission(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  useEffect(() => {
    if (record.id) {
      fetchTestCasePermission();
    }
  }, [record]);

  return (
    <Row align="middle">
      <Tooltip
        placement="bottomLeft"
        title={permission.Delete ? 'Delete' : NO_PERMISSION_FOR_ACTION}>
        <Button
          className="flex-center"
          disabled={!permission.Delete}
          icon={
            <SVGIcons alt="Delete" className="tw-h-4" icon={Icons.DELETE} />
          }
          type="text"
          onClick={(e) => {
            // preventing expand/collapse on click of delete button
            e.stopPropagation();
            onTestSelect(record);
          }}
        />
      </Tooltip>
      <Tooltip
        placement="bottomRight"
        title={
          permission.EditAll || permission.EditTests
            ? 'Edit'
            : NO_PERMISSION_FOR_ACTION
        }>
        <Button
          className="flex-center"
          disabled={!permission.EditAll && !permission.EditTests}
          icon={
            <SVGIcons
              alt="edit"
              className="tw-h-4"
              icon={Icons.EDIT}
              title="Edit"
            />
          }
          type="text"
          onClick={(e) => {
            // preventing expand/collapse on click of edit button
            e.stopPropagation();
            onTestEdit(record);
          }}
        />
      </Tooltip>
    </Row>
  );
};

export default TestActions;
