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

import classNames from 'classnames';
import { Query } from 'generated/entity/data/query';
// import { isUndefined } from 'lodash';
import React, { FC, HTMLAttributes, useState } from 'react';
// import { Link } from 'react-router-dom';
// import { getUserPath } from '../../constants/constants';
import { CSMode } from '../../enums/codemirror.enum';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import CopyToClipboardButton from '../buttons/CopyToClipboardButton/CopyToClipboardButton';
import SchemaEditor from '../schema-editor/SchemaEditor';
interface QueryCardProp extends HTMLAttributes<HTMLDivElement> {
  query: Query;
  onQuerySelection: (query: Query) => void;
}
const QueryCard: FC<QueryCardProp> = ({
  className,
  query,
  onQuerySelection,
}: QueryCardProp) => {
  const [expanded, setExpanded] = useState<boolean>(false);

  return (
    <div
      className={classNames(
        'tw-bg-white tw-py-3 tw-mb-3 tw-cursor-pointer',
        className
      )}
      onClick={() => {
        setExpanded((pre) => !pre);
        onQuerySelection(query);
      }}>
      {/* {!isUndefined(query.user) && !isUndefined(query.duration) ? (
        <div data-testid="query-header">
          <p>
            Last run by{' '}
            <Link
              className="button-comp"
              to={getUserPath(query.user?.name as string)}>
              <button className="tw-font-medium tw-text-grey-body ">
                {query.user?.displayName ?? query.user?.name}
              </button>{' '}
            </Link>
            and took{' '}
            <span className="tw-font-medium">{query.duration} seconds</span>
          </p>
        </div>
      ) : null} */}
      <div className="tw-border tw-border-main tw-rounded-md tw-p-px">
        <div
          className={classNames('tw-overflow-hidden tw-relative', {
            'tw-max-h-10': !expanded,
          })}>
          <span className="tw-absolute tw-right-4 tw-z-9999 tw--mt-0.5 tw-flex">
            <button data-testid="expand-collapse-button">
              {expanded ? (
                <SVGIcons
                  alt="arrow-up"
                  className="tw-mr-2"
                  icon={Icons.ICON_UP}
                  width="16px"
                />
              ) : (
                <SVGIcons
                  alt="arrow-down"
                  className="tw-mr-2"
                  icon={Icons.ICON_DOWN}
                  width="16px"
                />
              )}
            </button>
            <span
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}>
              <CopyToClipboardButton copyText={query.query ?? ''} />
            </span>
          </span>

          <SchemaEditor
            editorClass={classNames('table-query-editor')}
            mode={{ name: CSMode.SQL }}
            options={{
              styleActiveLine: false,
            }}
            value={query.query ?? ''}
          />
        </div>
      </div>
    </div>
  );
};

export default QueryCard;
