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
import React, { FC, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { useAuthContext } from '../../auth-provider/AuthProvider';
import { TITLE_FOR_NON_ADMIN_ACTION } from '../../constants/constants';
import { excludedMetrics } from '../../constants/profiler.constant';
import { Table, TableProfile } from '../../generated/entity/data/table';
import { useAuth } from '../../hooks/authHooks';
import {
  ColumnTest,
  DatasetTestModeType,
} from '../../interface/dataQuality.interface';
import { isColumnTestSupported } from '../../utils/EntityUtils';
import { getRoundedValue } from '../../utils/ProfilerUtils';
import { getConstraintIcon } from '../../utils/TableUtils';
import { Button } from '../buttons/Button/Button';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import PopOver from '../common/popover/PopOver';
import RichTextEditorPreviewer from '../common/rich-text-editor/RichTextEditorPreviewer';

type Props = {
  tableProfiles: Table['tableProfile'];
  columns: Array<{
    constraint: string;
    colName: string;
    colType: string;
    dataType: string;
    colTests?: ColumnTest[];
  }>;
  qualityTestFormHandler: (
    tabValue: number,
    testMode?: DatasetTestModeType,
    columnName?: string
  ) => void;
};

const PercentageGraph = ({
  percentage,
}: {
  percentage: number;
  title: string;
}) => {
  return (
    <div className="tw-border tw-inline-block tw-border-primary tw-h-5 tw-w-20 ">
      <div
        className="tw-bg-primary-hover-lite tw-h-full"
        style={{ width: `${percentage}%` }}>
        <div className="tw-w-20 tw-text-grey-body tw-font-medium tw-text-xs tw-leading-5 tw-text-center">
          {getRoundedValue(percentage)}%
        </div>
      </div>
    </div>
  );
};

const TableProfiler: FC<Props> = ({
  tableProfiles,
  columns,
  qualityTestFormHandler,
}) => {
  const { isAdminUser } = useAuth();
  const { isAuthDisabled } = useAuthContext();
  const modifiedData = tableProfiles?.map((tableProfile: TableProfile) => ({
    rows: tableProfile.rowCount,
    profileDate: tableProfile.profileDate,
    columnProfile: tableProfile.columnProfile,
  }));

  const columnSpecificData = columns.map((column) => {
    const data = modifiedData?.map((md) => {
      const currentColumn = md.columnProfile?.find(
        (colProfile) => colProfile.name === column.colName
      );

      return {
        profilDate: md.profileDate,
        ...currentColumn,
        rows: md.rows,
      };
    });

    return {
      name: column,
      columnMetrics: Object.entries(data?.[0] ?? {})
        .map((d) => ({
          key: d[0],
          value: d[1],
        }))
        .filter((m) => !excludedMetrics.includes(m.key)),
      columnTests: column.colTests,
      data,
      type: column.colType,
    };
  });

  return (
    <div className="tw-table-responsive tw-overflow-x-auto">
      {tableProfiles?.length ? (
        <table
          className="tw-w-full"
          data-testid="schema-table"
          id="profilerDetails">
          <thead>
            <tr className="tableHead-row">
              <th className="tableHead-cell">Column Name</th>
              <th className="tableHead-cell">Type</th>
              <th className="tableHead-cell">Null %</th>
              <th className="tableHead-cell">Unique %</th>
              <th className="tableHead-cell">Distinct %</th>
              <th className="tableHead-cell">Metrics</th>
              <th className="tableHead-cell">Tests</th>
              <th className="tableHead-cell" />
            </tr>
          </thead>
          {columnSpecificData.map((col, colIndex) => {
            return (
              <Fragment key={colIndex}>
                <tbody className="tableBody">
                  <tr
                    className={classNames('tableBody-row')}
                    data-testid="tableBody-row">
                    <td
                      className="tw-relative tableBody-cell"
                      data-testid="tableBody-cell">
                      <div className="tw-flex">
                        {col.name.constraint && (
                          <span className="tw-mr-3 tw--ml-2">
                            {getConstraintIcon(
                              col.name.constraint,
                              'tw-relative'
                            )}
                          </span>
                        )}
                        <div className="tw-flex">
                          {col.name.colName.length > 25 ? (
                            <span>
                              <PopOver
                                html={
                                  <div className="tw-break-words">
                                    <span>{col.name.colName}</span>
                                  </div>
                                }
                                position="bottom"
                                theme="light"
                                trigger="click">
                                <div className="tw-cursor-pointer tw-underline tw-inline-block">
                                  <RichTextEditorPreviewer
                                    markdown={`${col.name.colName.slice(
                                      0,
                                      20
                                    )}...`}
                                  />
                                </div>
                              </PopOver>
                            </span>
                          ) : (
                            col.name.colName
                          )}
                        </div>
                      </div>
                    </td>
                    <td
                      className="tw-relative tableBody-cell"
                      data-testid="tableBody-cell">
                      <div className="tw-flex">
                        {col.name.colType.length > 25 ? (
                          <span>
                            <PopOver
                              html={
                                <div className="tw-break-words">
                                  <span>{col.name.colType.toLowerCase()}</span>
                                </div>
                              }
                              position="bottom"
                              theme="light"
                              trigger="click">
                              <div className="tw-cursor-pointer tw-underline tw-inline-block">
                                <RichTextEditorPreviewer
                                  markdown={`${col.name.colType
                                    .slice(0, 20)
                                    .toLowerCase()}...`}
                                />
                              </div>
                            </PopOver>
                          </span>
                        ) : (
                          col.name.colType.toLowerCase()
                        )}
                      </div>
                    </td>
                    <td className="tw-relative tableBody-cell profiler-graph">
                      <PercentageGraph
                        percentage={(col.data?.[0]?.nullProportion ?? 0) * 100}
                        title="null value"
                      />
                    </td>
                    <td className="tw-relative tableBody-cell profiler-graph">
                      <PercentageGraph
                        percentage={
                          (col.data?.[0]?.uniqueProportion ?? 0) * 100
                        }
                        title="unique value"
                      />
                    </td>
                    <td className="tw-relative tableBody-cell profiler-graph">
                      <PercentageGraph
                        percentage={
                          (col.data?.[0]?.distinctProportion ?? 0) * 100
                        }
                        title="distinct value"
                      />
                    </td>
                    <td
                      className="tw-relative tableBody-cell"
                      data-testid="tableBody-cell">
                      {col.columnMetrics.length ? (
                        <div className=" tw-rounded tw-max-h-44 tw-overflow-y-auto">
                          {col.columnMetrics.map((m, i) => (
                            <p className="tw-mb-1 tw-flex" key={i}>
                              <span className="tw-mx-1">{m.key}</span>
                              <span className="tw-mx-1">-</span>
                              <span className="tw-mx-1">
                                {getRoundedValue(m.value)}
                              </span>
                            </p>
                          ))}
                        </div>
                      ) : (
                        `No metrics available`
                      )}
                    </td>
                    <td
                      className="tw-relative tableBody-cell"
                      colSpan={2}
                      data-testid="tableBody-cell">
                      <div className="tw-flex tw-justify-between">
                        {col.columnTests?.length ? (
                          <div className="tw-rounded tw-max-h-44 tw-overflow-y-auto tw-flex-1">
                            {col.columnTests.map((m, i) => (
                              <div className="tw-flex tw-mb-2" key={i}>
                                <p className="tw-mr-2">
                                  {m.results?.every(
                                    (result) =>
                                      result.testCaseStatus === 'Success'
                                  ) ? (
                                    <FontAwesomeIcon
                                      className="tw-text-status-success"
                                      icon="check-square"
                                    />
                                  ) : (
                                    <FontAwesomeIcon
                                      className="tw-text-status-failed"
                                      icon="times"
                                    />
                                  )}
                                </p>
                                <div>
                                  <span
                                    className="tw-mx-1 tw-font-medium tw-cursor-pointer"
                                    onClick={() => qualityTestFormHandler(6)}>
                                    {m.testCase.columnTestType}
                                  </span>
                                  <div className="tw-mx-1">
                                    {Object.entries(
                                      m.testCase.config ?? {}
                                    ).map((config, i) => (
                                      <p className="tw-mx-1" key={i}>
                                        <span>{config[0]}:</span>
                                        <span>{config[1] ?? 'null'}</span>
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          `No tests available`
                        )}
                        <div className="tw-self-center tw-ml-5">
                          {!isColumnTestSupported(col.name.dataType) ? (
                            <span>Not supported</span>
                          ) : (
                            <NonAdminAction
                              position="bottom"
                              title={TITLE_FOR_NON_ADMIN_ACTION}>
                              <Button
                                className={classNames({
                                  'tw-opacity-40':
                                    !isAdminUser && !isAuthDisabled,
                                })}
                                size="small"
                                theme="primary"
                                type="button"
                                variant="outlined"
                                onClick={() =>
                                  qualityTestFormHandler(
                                    6,
                                    'column',
                                    col.name.colName
                                  )
                                }>
                                Add Test
                              </Button>
                            </NonAdminAction>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </Fragment>
            );
          })}
        </table>
      ) : (
        <div className="tw-mt-4 tw-ml-4 tw-flex tw-justify-center tw-font-medium tw-items-center tw-border tw-border-main tw-rounded-md tw-p-8">
          <span>
            Data Profiler is an optional configuration in Ingestion. Please
            enable the data profiler by following the documentation
          </span>
          <Link
            className="tw-ml-1"
            target="_blank"
            to={{
              pathname: 'https://docs.open-metadata.org/connectors',
            }}>
            here.
          </Link>
        </div>
      )}
    </div>
  );
};

export default TableProfiler;
