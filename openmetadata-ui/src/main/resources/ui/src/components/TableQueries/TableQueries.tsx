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
import React, { FC, HTMLAttributes, useState } from 'react';
import { CSMode } from '../../enums/codemirror.enum';
import { SQLQuery, Table } from '../../generated/entity/data/table';
import { withLoader } from '../../hoc/withLoader';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import SchemaEditor from '../schema-editor/SchemaEditor';

interface TableQueriesProp extends HTMLAttributes<HTMLDivElement> {
  queries: Table['tableQueries'];
}
interface QueryCardProp extends HTMLAttributes<HTMLDivElement> {
  query: SQLQuery;
}

const QueryCard: FC<QueryCardProp> = ({ className, query }) => {
  const [displayMoreText, setDisplayMoreText] = useState(false);

  return (
    <div
      className={classNames(
        'tw-bg-white tw-p-3 tw-border tw-border-main tw-rounded-md tw-mb-3',
        className
      )}>
      <div
        className={classNames('tw-overflow-hidden tw-h-20 tw-relative', {
          'tw-h-full': displayMoreText,
        })}>
        <SchemaEditor
          mode={{ name: CSMode.SQL }}
          options={{
            lineNumbers: false,
            foldGutter: false,
            gutters: [],
            styleActiveLine: false,
          }}
          value={query.query ?? ''}
        />
        {(query.query?.length ?? 0) > 100 && (
          <div
            className={classNames(
              'tw-absolute tw-flex tw-h-full tw-w-full tw-inset-x-0',
              { 'see-more-blur-body': !displayMoreText },
              {
                'tw-top-0 tw-bottom-0 see-more-blur-body': !displayMoreText,
                'tw-bottom-0': displayMoreText,
              }
            )}>
            <p
              className="tw-cursor-pointer tw-self-end tw-pointer-events-auto tw-mx-auto tw-z-9999"
              onClick={() => setDisplayMoreText((pre) => !pre)}>
              <span className="tw-flex tw-items-center tw-gap-2">
                <SVGIcons
                  alt="expand-collapse"
                  className={classNames({ 'rotate-inverse': displayMoreText })}
                  icon={Icons.CHEVRON_DOWN}
                  width="32"
                />
              </span>
            </p>
          </div>
        )}
      </div>

      <div className="tw-mt-2">
        <p className="tw-flex">
          <span className="tw-text-grey-muted tw-mr-1">Duration:</span>
          <span>{query.duration} seconds</span>
        </p>
      </div>
    </div>
  );
};

const TableQueries: FC<TableQueriesProp> = ({ queries, className }) => {
  return (
    <div className={className}>
      <div className="tw-my-6">
        {queries?.map((query, index) => (
          <QueryCard key={index} query={query} />
        ))}
      </div>
    </div>
  );
};

export default withLoader<TableQueriesProp>(TableQueries);
