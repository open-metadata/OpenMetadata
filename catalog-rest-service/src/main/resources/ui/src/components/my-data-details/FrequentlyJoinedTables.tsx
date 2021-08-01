import React, { FunctionComponent } from 'react';
import { Link, useHistory } from 'react-router-dom';
import { getDatasetDetailsPath } from '../../constants/constants';
import PopOver from '../common/popover/PopOver';

type Props = {
  header: string;
  tableList: Array<{ name: string; fqn: string; joinCount: number }>;
};

const viewCap = 3;

const FrequentlyJoinedTables: FunctionComponent<Props> = ({
  header,
  tableList,
}: Props) => {
  const history = useHistory();

  const handleTableClick = (fqn: string) => {
    history.push(getDatasetDetailsPath(fqn));
  };

  const additionalOptions = () => {
    return (
      <div>
        {tableList?.slice(viewCap).map((table, index) => (
          <div
            className="tw-py-1 tw-cursor-pointer"
            data-testid="related-tables-data"
            key={index}>
            <span
              className="link-text"
              onClick={() => handleTableClick(table.fqn)}>
              {table.name}
            </span>
            <span className="tw-tag tw-ml-2">{table.joinCount}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      className="tw-flex tw-flex-col tw-relative"
      data-testid="related-tables-container">
      <div className="tw-flex tw-items-center tw-border-b tw-py-1 tw-px-3">
        <span
          className="tw-flex-1 tw-leading-8 tw-m-0 tw-text-sm tw-font-normal"
          data-testid="related-tables-header">
          {header}
        </span>
      </div>
      <div className="tw-flex tw-flex-col tw-px-3 tw-py-2">
        {(tableList.length <= viewCap
          ? tableList
          : tableList.slice(0, viewCap)
        ).map((table, index) => {
          return (
            <div
              className="tw-py-1"
              data-testid="related-tables-data"
              key={index}>
              <Link className="link-text" to={getDatasetDetailsPath(table.fqn)}>
                {table.name}
              </Link>
              <span className="tw-tag tw-ml-2">{table.joinCount}</span>
            </div>
          );
        })}

        {tableList.length > viewCap && (
          <div data-testid="related-tables-data">
            <PopOver
              html={additionalOptions()}
              position="bottom"
              theme="light"
              trigger="click">
              <span className="show-more">
                {`+ ${tableList.length - viewCap} more`}
              </span>
            </PopOver>
          </div>
        )}
      </div>
    </div>
  );
};

export default FrequentlyJoinedTables;
