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

import { Box, Select, Typography } from '@openmetadata/ui-core-components';
import { FC, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { QueryBuilderCell } from './QueryBuilderControl';

interface QueryBuilderValueCellProps {
  cells: { id: string; node: ReactNode }[];
  /** The operator, such as "Is set", compares against nothing. */
  takesNoValue?: boolean;
}

/**
 * A rule's value column: the operator's widgets, a note when the operator takes no value, or a
 * disabled stand-in until a field and operator name a widget.
 */
const QueryBuilderValueCell: FC<QueryBuilderValueCellProps> = ({
  cells,
  takesNoValue = false,
}) => {
  const { t } = useTranslation();

  const renderValue = () => {
    if (takesNoValue) {
      return (
        <Typography
          as="span"
          className="tw:flex tw:h-9 tw:items-center tw:text-sm tw:text-tertiary">
          {t('label.no-value-needed')}
        </Typography>
      );
    }
    // Until the field and operator name a widget there is nothing to edit, but the column still
    // reads as part of the row — an empty gap where a control belongs looks like a rendering fault.
    if (cells.length === 0) {
      return (
        <Select
          isDisabled
          aria-label={t('label.value')}
          className="tw:min-w-0 tw:flex-1"
          items={[]}
          placeholder={t('label.value')}
          size="sm">
          {(item) => (
            <Select.Item id={String(item.id)} key={String(item.id)}>
              {String(item.id)}
            </Select.Item>
          )}
        </Select>
      );
    }

    // A two-valued operator keeps both slots readable: they share the column when it is wide enough
    // and wrap when it is not. `min-w` is the narrowest a value slot may get before they wrap.
    return cells.map((cell) => (
      <div className="tw:min-w-[130px] tw:flex-1" key={cell.id}>
        {cell.node}
      </div>
    ));
  };

  return (
    <QueryBuilderCell label={t('label.value')}>
      <Box
        className="tw:min-w-0"
        data-testid="advanced-search-value"
        gap={2}
        wrap="wrap">
        {renderValue()}
      </Box>
    </QueryBuilderCell>
  );
};

export default QueryBuilderValueCell;
