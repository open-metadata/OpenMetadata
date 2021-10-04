import classNames from 'classnames';
import React, { Fragment, useState } from 'react';
import { Sparklines, SparklinesLine } from 'react-sparklines';
import { Table, TableProfile } from '../../generated/entity/data/table';

type Props = {
  tableProfiles: Table['tableProfile'];
  columns: Array<string>;
};

const ProfilerTable = ({ tableProfiles, columns }: Props) => {
  const [expandedColumn, setExpandedColumn] = useState<{
    name: string;
    isExpanded: boolean;
  }>({
    name: '',
    isExpanded: false,
  });
  const modifiedData = tableProfiles?.map((tableProfile: TableProfile) => ({
    profileDate: tableProfile.profileDate,
    columnProfile: tableProfile.columnProfile,
  }));

  const columnSpecificData = columns.map((column) => {
    const data = modifiedData?.map((md) => {
      const currentColumn = md.columnProfile?.find(
        (colProfile) => colProfile.name === column
      );

      return { profilDate: md.profileDate, ...currentColumn };
    });

    return {
      name: column,
      data,
      distinctCount: 0,
      nullRatio: 0,
      min: 1,
      max: 1,
      median: 1,
      standardDeviation: 3.6,
    };
  });

  return (
    <div className="tw-table-responsive">
      <table className="tw-w-full" data-testid="schema-table">
        <thead>
          <tr className="tableHead-row">
            <th className="tableHead-cell">Column Name</th>
            <th className="tableHead-cell">Distinct Count</th>
            <th className="tableHead-cell">Null Ratio</th>
            <th className="tableHead-cell">Min</th>
            <th className="tableHead-cell">Max</th>
            <th className="tableHead-cell">Median</th>
            <th className="tableHead-cell">Standard Deviation</th>
          </tr>
        </thead>
        {columnSpecificData.map((col, colIndex) => {
          return (
            <Fragment key={colIndex}>
              <tbody className="tableBody">
                <tr className={classNames('tableBody-row')}>
                  <td className="tw-relative tableBody-cell">
                    <span
                      className="tw-mr-2 tw-cursor-pointer"
                      onClick={() =>
                        setExpandedColumn((prevState) => ({
                          name: col.name,
                          isExpanded:
                            prevState.name === col.name
                              ? !prevState.isExpanded
                              : true,
                        }))
                      }>
                      {expandedColumn.name === col.name ? (
                        expandedColumn.isExpanded ? (
                          <i className="fas fa-caret-down" />
                        ) : (
                          <i className="fas fa-caret-right" />
                        )
                      ) : (
                        <i className="fas fa-caret-right" />
                      )}
                    </span>
                    {col.name}
                  </td>
                  <td className="tw-relative tableBody-cell">
                    <Sparklines data={col.data?.map((d) => d.uniqueCount ?? 0)}>
                      <SparklinesLine
                        color="#7147E8"
                        style={{ fillOpacity: '0.4', strokeWidth: '1' }}
                      />
                    </Sparklines>
                  </td>
                  <td className="tw-relative tableBody-cell">
                    <Sparklines
                      data={col.data?.map((d) => d.nullProportion ?? 0)}>
                      <SparklinesLine
                        color="#7147E8"
                        style={{ fillOpacity: '0.4', strokeWidth: '1' }}
                      />
                    </Sparklines>
                  </td>
                  <td className="tw-relative tableBody-cell">{col.min}</td>
                  <td className="tw-relative tableBody-cell">{col.max}</td>
                  <td className="tw-relative tableBody-cell">{col.median}</td>
                  <td className="tw-relative tableBody-cell">
                    <Sparklines data={col.data?.map((d) => d.stddev ?? 0)}>
                      <SparklinesLine
                        color="#7147E8"
                        style={{ fillOpacity: '0.4', strokeWidth: '1' }}
                      />
                    </Sparklines>
                  </td>
                </tr>
              </tbody>
              {expandedColumn.name === col.name && expandedColumn.isExpanded && (
                <tbody>
                  {col.data?.map((colData, index) => (
                    <tr
                      className={classNames(
                        'tableBody-row tw-border-0 tw-border-l tw-border-r',
                        {
                          'tw-border-b':
                            columnSpecificData.length - 1 === colIndex,
                        }
                      )}
                      key={index}>
                      <td className="tw-relative tableBody-cell">
                        <span className="tw-pl-6">{colData.profilDate}</span>
                      </td>
                      <td className="tw-relative tableBody-cell">
                        {colData.uniqueCount ?? 0}
                      </td>
                      <td className="tw-relative tableBody-cell">
                        {colData.nullProportion ?? 0}
                      </td>
                      <td className="tw-relative tableBody-cell">
                        {colData.min ?? 0}
                      </td>
                      <td className="tw-relative tableBody-cell">
                        {colData.max ?? 0}
                      </td>
                      <td className="tw-relative tableBody-cell">
                        {colData.median ?? 0}
                      </td>
                      <td className="tw-relative tableBody-cell">
                        {colData.stddev ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </Fragment>
          );
        })}
      </table>
    </div>
  );
};

export default ProfilerTable;
