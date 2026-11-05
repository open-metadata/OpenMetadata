/*
 *  Copyright 2026 Collate.
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
import { PanelEmptyPlaceholderProps } from './EmptyPlaceholder.interface';
import NoDataPlaceholder from './NoDataPlaceholder';
import NoSearchResultsPlaceholder from './NoSearchResultsPlaceholder';

/**
 * Empty state for a searchable list inside a panel, such as the Explore
 * summary panel tabs. While a search is active it reports no matching
 * results; otherwise it shows the no-data message.
 *
 * The placeholders are absolutely positioned, so this also renders the
 * positioned host they fill.
 */
const PanelEmptyPlaceholder = ({
  searchText,
  title,
  description,
  className,
  'data-testid': dataTestId = 'no-data-placeholder',
  searchResultsTestId = dataTestId,
}: PanelEmptyPlaceholderProps) => (
  <div
    className={classNames(
      'tw:relative tw:h-full tw:w-full tw:min-h-60 tw:rounded-xl tw:bg-surface',
      className
    )}>
    {searchText ? (
      <NoSearchResultsPlaceholder data-testid={searchResultsTestId} />
    ) : (
      <NoDataPlaceholder
        data-testid={dataTestId}
        description={description}
        title={title}
      />
    )}
  </div>
);

export default PanelEmptyPlaceholder;
