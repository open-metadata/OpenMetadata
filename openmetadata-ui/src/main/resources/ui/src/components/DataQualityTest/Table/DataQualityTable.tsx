/*
 *  Copyright 2021 Collate
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

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { isEmpty, isUndefined } from 'lodash';
import React, { useState } from 'react';
import { TITLE_FOR_NON_ADMIN_ACTION } from '../../../constants/constants';
import { ColumnTestType } from '../../../enums/columnTest.enum';
import {
  TableTestType,
  TestCaseStatus,
} from '../../../generated/tests/tableTest';
import {
  DatasetTestModeType,
  TableTestDataType,
  TestCaseConfigType,
} from '../../../interface/dataQuality.interface';
import { isEven } from '../../../utils/CommonUtils';
import NonAdminAction from '../../common/non-admin-action/NonAdminAction';
import RichTextEditorPreviewer from '../../common/rich-text-editor/RichTextEditorPreviewer';
import Loader from '../../Loader/Loader';
import ConfirmationModal from '../../Modals/ConfirmationModal/ConfirmationModal';

type Props = {
  testCase: TableTestDataType[];
  isTableTest: boolean;
  isTableDeleted?: boolean;
  handleEditTest: (mode: DatasetTestModeType, obj: TableTestDataType) => void;
  handleRemoveTableTest?: (testType: TableTestType) => void;
  handleRemoveColumnTest?: (
    columnName: string,
    testType: ColumnTestType
  ) => void;
};

const DataQualityTable = ({
  testCase,
  isTableTest,
  isTableDeleted,
  handleEditTest,
  handleRemoveTableTest,
  handleRemoveColumnTest,
}: Props) => {
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [deleteSelection, setDeleteSelection] = useState<{
    data?: TableTestDataType;
    state: string;
  }>({
    data: undefined,
    state: '',
  });

  const handleCancelConfirmationModal = () => {
    setIsConfirmationModalOpen(false);
    setDeleteSelection({ data: undefined, state: '' });
  };

  const confirmDelete = (data: TableTestDataType) => {
    setDeleteSelection({ data, state: '' });
    setIsConfirmationModalOpen(true);
  };

  const handleDelete = (data: TableTestDataType) => {
    if (isTableTest) {
      handleRemoveTableTest &&
        handleRemoveTableTest(data.testCase.tableTestType as TableTestType);
    } else {
      handleRemoveColumnTest &&
        handleRemoveColumnTest(
          data?.columnName || '',
          data.testCase?.columnTestType as ColumnTestType
        );
    }
    handleCancelConfirmationModal();
  };

  const getConfigInfo = (config: TestCaseConfigType) => {
    return !isEmpty(config) && config
      ? Object.entries(config).map((d, i) => (
          <p key={i}>{`${d[0]}: ${!isUndefined(d[1]) ? d[1] : '--'}`}</p>
        ))
      : '--';
  };

  return (
    <div className="tw-table-responsive" data-testid="table-container">
      <table className="tw-w-full">
        <thead>
          <tr className="tableHead-row" data-testid="table-header">
            <th className="tableHead-cell">Test Case</th>
            <th className="tableHead-cell">Description</th>
            <th className="tableHead-cell">Config</th>
            <th className="tableHead-cell">Last Run</th>
            <th className="tableHead-cell">Value</th>
            <th className="tableHead-cell">Action</th>
          </tr>
        </thead>
        <tbody className="tableBody">
          {testCase.map((column, index) => {
            return (
              <tr
                className={classNames(
                  'tableBody-row',
                  !isEven(index + 1) ? 'odd-row' : null
                )}
                data-testid="column"
                id={column.name}
                key={index}>
                <td className="tableBody-cell tw-w-3/12">
                  <span>
                    {isTableTest
                      ? column.testCase.tableTestType
                      : column.testCase.columnTestType}
                  </span>
                </td>
                <td className="tableBody-cell tw-w-3/12">
                  {column.description?.trim() ? (
                    <RichTextEditorPreviewer markdown={column.description} />
                  ) : (
                    <span className="tw-no-description">No description</span>
                  )}
                </td>
                <td className="tableBody-cell tw-w-2/12">
                  {getConfigInfo(column.testCase?.config || {})}
                </td>
                <td className="tableBody-cell tw-w-1/12">
                  {column.results && column.results.length > 0 ? (
                    <span
                      className={classNames(
                        'tw-block tw-w-full tw-h-full tw-text-white tw-text-center tw-py-1',
                        {
                          'tw-bg-success':
                            column.results[0].testCaseStatus ===
                            TestCaseStatus.Success,
                          'tw-bg-failed':
                            column.results[0].testCaseStatus ===
                            TestCaseStatus.Failed,
                          'tw-bg-status-queued':
                            column.results[0].testCaseStatus ===
                            TestCaseStatus.Aborted,
                        }
                      )}>
                      {column.results[0].testCaseStatus}
                    </span>
                  ) : (
                    '--'
                  )}
                </td>
                <td className="tableBody-cell tw-w-2/12">
                  <span>
                    {column.results && column.results.length > 0
                      ? column.results[0].result || '--'
                      : '--'}
                  </span>
                </td>
                <td className="tableBody-cell tw-w-1/12">
                  <div className="tw-flex tw-items-center">
                    <NonAdminAction
                      position="left"
                      title={TITLE_FOR_NON_ADMIN_ACTION}>
                      <button
                        className={classNames('link-text tw-mr-2', {
                          'tw-opacity-50 tw-cursor-not-allowed': isTableDeleted,
                        })}
                        data-testid="edit"
                        disabled={isTableDeleted}
                        onClick={() =>
                          handleEditTest(
                            isTableTest ? 'table' : 'column',
                            column
                          )
                        }>
                        Edit
                      </button>
                    </NonAdminAction>
                    <NonAdminAction
                      position="left"
                      title={TITLE_FOR_NON_ADMIN_ACTION}>
                      <button
                        className={classNames('link-text tw-mr-2', {
                          'tw-opacity-50 tw-cursor-not-allowed': isTableDeleted,
                        })}
                        data-testid="delete"
                        disabled={isTableDeleted}
                        onClick={() => confirmDelete(column)}>
                        {deleteSelection.data?.id === column.id ? (
                          deleteSelection.state === 'success' ? (
                            <FontAwesomeIcon icon="check" />
                          ) : (
                            <Loader size="small" type="default" />
                          )
                        ) : (
                          'Delete'
                        )}
                      </button>
                    </NonAdminAction>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {isConfirmationModalOpen && (
        <ConfirmationModal
          bodyText={`You want to delete test ${
            deleteSelection.data?.testCase?.columnTestType ||
            deleteSelection.data?.testCase?.tableTestType
          } permanently? This action cannot be reverted.`}
          cancelText="Discard"
          confirmButtonCss="tw-bg-error hover:tw-bg-error focus:tw-bg-error"
          confirmText={
            deleteSelection.state === 'waiting' ? (
              <Loader size="small" type="white" />
            ) : deleteSelection.state === 'success' ? (
              <FontAwesomeIcon icon="check" />
            ) : (
              'Delete'
            )
          }
          header="Are you sure?"
          onCancel={handleCancelConfirmationModal}
          onConfirm={() =>
            handleDelete(deleteSelection.data as TableTestDataType)
          }
        />
      )}
    </div>
  );
};

export default DataQualityTable;
