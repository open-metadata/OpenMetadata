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

import classNames from 'classnames';
import React, { FC, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Table, TableProfile } from '../../generated/entity/data/table';
import {
  ColumnTest,
  DatasetTestModeType,
} from '../../interface/dataQuality.interface';
import { getConstraintIcon } from '../../utils/TableUtils';
import { Button } from '../buttons/Button/Button';
import TableProfilerGraph from './TableProfilerGraph.component';

type Props = {
  tableProfiles: Table['tableProfile'];
  columns: Array<{
    constraint: string;
    colName: string;
    colType: string;
    colTests?: ColumnTest[];
  }>;
  quilityTestFormHandler: (
    tabValue: number,
    testMode: DatasetTestModeType
  ) => void;
};

type ProfilerGraphData = Array<{
  date: Date;
  value: number;
}>;

const excludedMetrics = [
  'profilDate',
  'name',
  'nullCount',
  'nullProportion',
  'uniqueCount',
  'uniqueProportion',
  'rows',
];

const TableProfiler: FC<Props> = ({
  tableProfiles,
  columns,
  quilityTestFormHandler,
}) => {
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
      columnMetrics: Object.entries(data?.[0] ?? {}).map((d) => ({
        key: d[0],
        value: d[1],
      })),
      columnTests: column.colTests,
      data,
      min: data?.length ? data[0].min ?? 0 : 0,
      max: data?.length ? data[0].max ?? 0 : 0,
      type: column.colType,
    };
  });

  return (
    <>
      {tableProfiles?.length ? (
        <table
          className="tw-table-responsive tw-overflow-x-auto"
          data-testid="schema-table"
          id="profilerDetails">
          <thead>
            <tr className="tableHead-row">
              <th className="tableHead-cell">Column Name</th>
              <th className="tableHead-cell">Type</th>
              <th className="tableHead-cell">Null</th>
              <th className="tableHead-cell">Unique</th>
              <th className="tableHead-cell">Distinct</th>
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
                        <span>{col.name.colName}</span>
                      </div>
                    </td>
                    <td
                      className="tw-relative tableBody-cell"
                      data-testid="tableBody-cell">
                      <div className="tw-flex">
                        <span>{col.name.colType}</span>
                      </div>
                    </td>
                    <td className="tw-relative tableBody-cell profiler-graph">
                      <TableProfilerGraph
                        data={
                          col.data
                            ?.map((d) => ({
                              date: d.profilDate,
                              value: d.nullCount ?? 0,
                            }))
                            .reverse() as ProfilerGraphData
                        }
                      />
                    </td>
                    <td className="tw-relative tableBody-cell profiler-graph">
                      <TableProfilerGraph
                        data={
                          col.data
                            ?.map((d) => ({
                              date: d.profilDate,
                              value: d.uniqueCount ?? 0,
                            }))
                            .reverse() as ProfilerGraphData
                        }
                      />
                    </td>
                    <td className="tw-relative tableBody-cell profiler-graph">
                      <TableProfilerGraph
                        data={
                          col.data
                            ?.map((d) => ({
                              date: d.profilDate,
                              value: d.distinctCount ?? 0,
                            }))
                            .reverse() as ProfilerGraphData
                        }
                      />
                    </td>
                    <td
                      className="tw-relative tableBody-cell"
                      data-testid="tableBody-cell">
                      <div className="tw-border tw-border-main tw-rounded tw-p-2 tw-min-h-32 tw-max-h-44 tw-overflow-y-auto">
                        {col.columnMetrics
                          .filter((m) => !excludedMetrics.includes(m.key))
                          .map((m, i) => (
                            <p className="tw-mb-1 tw-flex" key={i}>
                              <span className="tw-mx-1">{m.key}</span>
                              <span className="tw-mx-1">-</span>
                              <span className="tw-mx-1">{m.value}</span>
                            </p>
                          ))}
                      </div>
                    </td>
                    <td
                      className="tw-relative tableBody-cell"
                      colSpan={2}
                      data-testid="tableBody-cell">
                      <div className="tw-flex tw-justify-between">
                        {col.columnTests ? (
                          <div className="tw-border tw-border-main tw-rounded tw-p-2 tw-min-h-32 tw-max-h-44 tw-overflow-y-auto tw-flex-1">
                            {col.columnTests.map((m, i) => (
                              <div className="tw-flex tw-mb-2" key={i}>
                                <p className="tw-mr-2">
                                  {m.results?.every(
                                    (result) =>
                                      result.testCaseStatus === 'Success'
                                  ) ? (
                                    <i className="fas fa-check-square tw-text-status-success" />
                                  ) : (
                                    <i className="fas fa-times tw-text-status-failed" />
                                  )}
                                </p>
                                <div>
                                  <span className="tw-mx-1 tw-font-medium">
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
                          `No tests added yet.`
                        )}
                        <div className="tw-self-center tw-ml-5">
                          <Button
                            className="tw-px-2 tw-py-0.5 tw-rounded tw-border-grey-muted"
                            size="custom"
                            type="button"
                            variant="outlined"
                            onClick={() => quilityTestFormHandler(6, 'column')}>
                            Add Test
                          </Button>
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
    </>
  );
};

export default TableProfiler;
