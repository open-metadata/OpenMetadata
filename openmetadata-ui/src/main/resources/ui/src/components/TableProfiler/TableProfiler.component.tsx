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
import React, { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Table, TableProfile } from '../../generated/entity/data/table';
import { getConstraintIcon } from '../../utils/TableUtils';
import { Button } from '../buttons/Button/Button';
import TableProfilerGraph from './TableProfilerGraph.component';

type Props = {
  tableProfiles: Table['tableProfile'];
  columns: Array<{ constraint: string; colName: string; colType: string }>;
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

const TableProfiler = ({ tableProfiles, columns }: Props) => {
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
          className="tw-w-full"
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
                      <div className="tw-border tw-border-main tw-rounded tw-p-2">
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
                      data-testid="tableBody-cell">
                      <Button
                        className="tw-px-2 tw-py-0.5 tw-rounded tw-border-grey-muted"
                        size="custom"
                        type="button"
                        variant="outlined">
                        Add Test
                      </Button>
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
