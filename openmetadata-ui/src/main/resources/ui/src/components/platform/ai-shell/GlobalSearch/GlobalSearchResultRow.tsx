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
import {
  Badge,
  Box,
  ButtonUtility,
  Typography,
} from '@openmetadata/ui-core-components';
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
  onHover: () => void;
  onSelect: () => void;
  onRemove?: () => void;
}

const ELLIPSIS = { excludeTriggerFromTabOrder: true };

/**
 * A result option. Core has no list-option component, so the row is a `Box`
 * whose only own styling is the background for the highlighted (keyboard or
 * hover) and previewed states, as in the prototype.
 */
const GlobalSearchResultRow = ({
  id,
  row,
  query,
  isActive,
  isPreviewed,
  onHover,
  onSelect,
  onRemove,
}: GlobalSearchResultRowProps) => {
  const { t } = useTranslation();

  return (
    <Box
      align="center"
      aria-selected={isActive}
      className={classNames(
        'tw:mx-2 tw:mt-1 tw:cursor-pointer tw:rounded-lg tw:px-3 tw:py-2',
        {
          'tw:bg-brand-primary': isPreviewed,
          'tw:bg-secondary_hover': isActive && !isPreviewed,
        }
      )}
      data-active={isActive}
      data-testid={`global-search-row-${row.id}`}
      gap={3}
      id={id}
      role="option"
      tabIndex={-1}
      onClick={onSelect}
      // Keep focus in the search input: the arrows, Enter and Esc are handled
      // there, so picking a row (e.g. to preview it) must not take focus away.
      onMouseDown={(event) => event.preventDefault()}
      onMouseMove={onHover}>
      {row.icon}
      <Box className="tw:min-w-0 tw:flex-1" direction="col">
        <Box align="center" className="tw:min-w-0" gap={2}>
          <Typography ellipsis={ELLIPSIS} size="text-sm" weight="medium">
            {splitHighlight(row.title, query).map((part) =>
              part.isMatch ? (
                <Typography
                  as="span"
                  color="brand"
                  key={part.offset}
                  weight="semibold">
                  {part.text}
                </Typography>
              ) : (
                part.text
              )
            )}
          </Typography>
          {row.badges?.map((badge) => (
            <Badge color="gray" key={badge} size="sm" type="color">
              {badge}
            </Badge>
          ))}
        </Box>
        {row.meta ? (
          <Typography color="quaternary" ellipsis={ELLIPSIS} size="text-xs">
            {row.meta}
          </Typography>
        ) : null}
      </Box>
      {row.addon}
      {row.trailing ? (
        <Typography color="quaternary" size="text-xs">
          {row.trailing}
        </Typography>
      ) : null}
      {isActive && !onRemove && !isPreviewed ? (
        <Badge color="gray" size="sm" type="modern">
          {KEY_HINT.enter}
        </Badge>
      ) : null}
      {onRemove ? (
        <ButtonUtility
          color="tertiary"
          data-testid="global-search-remove-recent"
          icon={XClose}
          size="md"
          tooltip={t('label.remove-from-recent-search-plural')}
          onClick={onRemove}
        />
      ) : null}
    </Box>
  );
};

export default GlobalSearchResultRow;
