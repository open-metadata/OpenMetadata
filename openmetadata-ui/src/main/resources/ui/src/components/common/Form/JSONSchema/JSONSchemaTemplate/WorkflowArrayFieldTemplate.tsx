/*
 *  Copyright 2023 Collate.
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
  Autocomplete,
  ButtonUtility,
  Grid,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import { FieldProps } from '@rjsf/utils';
import { isArray, isEmpty, isObject, startCase } from 'lodash';
import React, { Key, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CopyLeft } from '../../../../../assets/svg/copy-left.svg';
import { useClipboard } from '../../../../../hooks/useClipBoard';
import { splitCSV } from '../../../../../utils/CSV/CSVPureUtils';
const WorkflowArrayFieldTemplate = (props: FieldProps) => {
  const { t } = useTranslation();
  const isFilterPatternField = (id: string) => {
    return /FilterPattern/.test(id);
  };

  const handleFocus = () => {
    let id = props.idSchema.$id;

    if (isFilterPatternField(id)) {
      id = id.split('/').slice(0, 2).join('/');
    }
    props.formContext?.handleFocus?.(id);
  };

  const generateOptions = () => {
    if (
      isObject(props.schema.items) &&
      !isArray(props.schema.items) &&
      props.schema.items.type === 'string' &&
      isArray(props.schema.items.enum)
    ) {
      return (props.schema.items.enum as string[]).map((option) => ({
        id: option,
        label: option,
      }));
    }

    return undefined;
  };

  const id = props.idSchema.$id;
  const value: string[] = props.formData ?? [];
  const placeholder = isFilterPatternField(id)
    ? t('message.filter-pattern-placeholder')
    : '';
  const options = generateOptions();
  const { onCopyToClipBoard, onPasteFromClipBoard, hasCopied } = useClipboard(
    JSON.stringify(value)
  );

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      await onCopyToClipBoard();
    },
    [value, onCopyToClipBoard]
  );

  const handlePaste = useCallback(async () => {
    const text = await onPasteFromClipBoard();
    if (!text) {
      return;
    }

    let processedValues: string[] = [];

    // Try to parse as JSON array
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        processedValues = parsed.map((item) => String(item));
      }
    } catch {
      // Fallback to existing logic if not a JSON array
      processedValues = splitCSV(text);
    }

    if (!isEmpty(processedValues)) {
      // Use Set to ensure unique values
      const uniqueValues = Array.from(new Set([...value, ...processedValues]));
      props.onChange(uniqueValues);
    }
  }, [onPasteFromClipBoard, props.onChange, value]);

  const handleInputSplit = useCallback(
    (inputValue: string) => {
      if (isEmpty(inputValue)) {
        return;
      }
      const processedValues = splitCSV(inputValue);

      // Use Set to ensure unique values
      const uniqueValues = Array.from(new Set([...value, ...processedValues]));
      props.onChange(uniqueValues);
    },
    [value, props.onChange]
  );

  return (
    <Grid className="layout-row layout-grid">
      <Grid.Item className="layout-column" span={24}>
        {/* Display field title only if uniqueItems is not true to remove duplicate title set
         automatically due to an unknown behavior */}
        {props.schema.uniqueItems !== true && (
          <Typography as="article">{startCase(props.name)}</Typography>
        )}
      </Grid.Item>
      <Grid.Item
        className="layout-column tw:mt-1 tw:flex tw:items-center tw:gap-1"
        span={24}>
        <div className="tw:min-w-0 tw:flex-1">
          <Autocomplete
            multiple
            allowsCreation={!options}
            aria-label={startCase(props.name)}
            data-testid={`workflow-array-field-${id}`}
            hideDropdown={!options}
            id={id}
            isDisabled={props.disabled}
            items={options ?? []}
            placeholder={placeholder}
            selectedItems={value.map((item) => ({ id: item, label: item }))}
            onBlur={() => props.onBlur(id, value)}
            onFocus={handleFocus}
            onItemCleared={(key: Key) =>
              props.onChange(value.filter((item) => item !== key))
            }
            onItemInserted={(key: Key) =>
              options
                ? props.onChange([...value, String(key)])
                : handleInputSplit(String(key))
            }
            onKeyDown={(e: React.KeyboardEvent) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !options) {
                e.preventDefault();
                handlePaste();
              }
            }}>
            {(item) => <Autocomplete.Item id={item.id} label={item.label} />}
          </Autocomplete>
        </div>
        <Tooltip
          arrow
          placement="top"
          title={hasCopied ? 'Copied to clipboard' : 'Copy'}>
          <ButtonUtility
            aria-label={t('label.copy')}
            color="tertiary"
            icon={CopyLeft}
            size="xs"
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.stopPropagation();
              handleCopy(e);
            }}
          />
        </Tooltip>
      </Grid.Item>
    </Grid>
  );
};

export default WorkflowArrayFieldTemplate;
