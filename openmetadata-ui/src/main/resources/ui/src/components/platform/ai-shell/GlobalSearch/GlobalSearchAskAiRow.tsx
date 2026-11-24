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
import { Stars02 } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { ASK_AI_OPTION_ID, KEY_HINT } from './GlobalSearch.constants';
import GlobalSearchKbd from './GlobalSearchKbd';

export interface GlobalSearchAskAiRowProps {
  isVisible: boolean;
  query: string;
  isActive: boolean;
  /** Text before the quoted question, supplied by the assistant plugin. */
  label: string;
  onHover: () => void;
  onSelect: () => void;
}

const GlobalSearchAskAiRow = ({
  isVisible,
  query,
  isActive,
  label,
  onHover,
  onSelect,
}: GlobalSearchAskAiRowProps) => {
  if (!isVisible) {
    return null;
  }

  return (
    <div className="tw:px-2">
      <button
        aria-selected={isActive}
        className={classNames(
          'tw:flex tw:w-full tw:cursor-pointer tw:items-center tw:gap-3 tw:rounded-lg tw:border-0 tw:px-3 tw:py-2 tw:text-left',
          isActive ? 'tw:bg-primary_hover' : 'tw:bg-transparent'
        )}
        data-testid="global-search-ask-ai"
        id={ASK_AI_OPTION_ID}
        role="option"
        tabIndex={-1}
        type="button"
        onClick={onSelect}
        onMouseMove={onHover}>
        <span className="tw:flex tw:size-8 tw:items-center tw:justify-center tw:text-fg-brand-primary">
          <Stars02 size={20} />
        </span>
        <span className="tw:min-w-0 tw:flex-1 tw:truncate tw:text-sm tw:text-secondary">
          {label}{' '}
          <span className="tw:font-semibold tw:text-primary">“{query}”</span>
        </span>
        <span className="tw:flex tw:gap-1">
          <GlobalSearchKbd>{KEY_HINT.mod}</GlobalSearchKbd>
          <GlobalSearchKbd>{KEY_HINT.enter}</GlobalSearchKbd>
        </span>
      </button>
    </div>
  );
};

export default GlobalSearchAskAiRow;
