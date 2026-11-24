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
import { Badge, ButtonUtility } from '@openmetadata/ui-core-components';
import { XClose } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { KEY_HINT } from './GlobalSearch.constants';
import { GlobalSearchRow } from './GlobalSearch.types';
import { splitHighlight } from './GlobalSearch.utils';

export interface GlobalSearchResultRowProps {
  id: string;
  row: GlobalSearchRow;
  query: string;
  isActive: boolean;
  isPreviewed?: boolean;
  enterHint?: string;
  onHover: () => void;
  onSelect: () => void;
  onRemove?: () => void;
}

const GlobalSearchResultRow = ({
  id,
  row,
  query,
  isActive,
  isPreviewed,
  enterHint,
  onHover,
  onSelect,
  onRemove,
}: GlobalSearchResultRowProps) => {
  const { t } = useTranslation();

  return (
    <div
      aria-selected={isActive}
      className={classNames(
        'tw:group tw:flex tw:items-center tw:gap-2 tw:rounded-lg tw:pr-2',
        isPreviewed ? 'tw:bg-brand-primary' : isActive && 'tw:bg-primary_hover'
      )}
      data-active={isActive}
      data-testid={`global-search-row-${row.id}`}
      id={id}
      role="option"
      tabIndex={-1}
      onMouseMove={onHover}>
      <button
        className="tw:flex tw:min-w-0 tw:flex-1 tw:cursor-pointer tw:items-center tw:gap-3 tw:border-0 tw:bg-transparent tw:px-3 tw:py-2 tw:text-left"
        tabIndex={-1}
        type="button"
        onClick={onSelect}>
        <span className="tw:flex tw:size-8 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-md tw:text-fg-quaternary">
          {row.icon}
        </span>
        <span className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col">
          <span className="tw:flex tw:min-w-0 tw:items-center tw:gap-1.5">
            <span className="tw:truncate tw:text-sm tw:font-medium tw:text-primary">
              {splitHighlight(row.title, query).map((part) =>
                part.isMatch ? (
                  <mark
                    className="tw:rounded-xs tw:bg-utility-yellow-100 tw:text-primary"
                    key={part.offset}>
                    {part.text}
                  </mark>
                ) : (
                  <span key={part.offset}>{part.text}</span>
                )
              )}
            </span>
            {row.badges?.map((badge) => (
              <Badge key={badge} size="sm">
                {badge}
              </Badge>
            ))}
          </span>
          {row.meta ? (
            <span className="tw:truncate tw:text-xs tw:text-tertiary">
              {row.meta}
            </span>
          ) : null}
        </span>
        {row.trailing ? (
          <span className="tw:shrink-0 tw:text-xs tw:text-tertiary">
            {row.trailing}
          </span>
        ) : null}
        {isActive && enterHint ? (
          <kbd
            aria-hidden
            className="tw:shrink-0 tw:rounded tw:border tw:border-secondary tw:px-1.5 tw:text-xs tw:text-tertiary">
            {KEY_HINT.enter}
          </kbd>
        ) : null}
      </button>
      {onRemove ? (
        <ButtonUtility
          color="tertiary"
          data-testid="global-search-remove-recent"
          icon={XClose}
          size="xs"
          tooltip={t('label.remove-from-recent-search-plural')}
          onClick={onRemove}
        />
      ) : null}
    </div>
  );
};

export default GlobalSearchResultRow;
