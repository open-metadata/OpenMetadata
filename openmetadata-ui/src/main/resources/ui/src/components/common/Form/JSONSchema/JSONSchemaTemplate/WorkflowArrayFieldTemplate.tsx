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

import { FieldProps } from '@rjsf/utils';
import { Button, Col, Row, Select, Tooltip, Typography } from 'antd';
import { isArray, isEmpty, isObject, startCase } from 'lodash';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import CopyLeft from '../../../../../assets/svg/copy-left.svg?react';
import { useClipboard } from '../../../../../hooks/useClipBoard';
import { splitCSV } from '../../../../../utils/CSV/CSV.utils';
import './workflow-array-field-template.less';

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
        label: option,
        value: option,
      }));
    }

    return undefined;
  };

  const id = props.idSchema.$id;
  const value = props.formData ?? [];
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
    <Row>
      <Col span={24}>
        {/* Display field title only if uniqueItems is not true to remove duplicate title set
         automatically due to an unknown behavior */}
        {props.schema.uniqueItems !== true && (
          <Typography>{startCase(props.name)}</Typography>
        )}
      </Col>
      <Col className="select-container" span={24}>
        <Select
          className="m-t-xss w-full"
          data-testid="workflow-array-field-template"
          disabled={props.disabled}
          id={id}
          mode={options ? 'multiple' : 'tags'}
          open={options ? undefined : false}
          options={options}
          placeholder={placeholder}
          value={value}
          onBlur={() => props.onBlur(id, value)}
          onChange={(value) => props.onChange(value)}
          onFocus={handleFocus}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !options) {
              e.preventDefault();
              handlePaste();
            }
            if (!options && e.key === 'Enter') {
              // If there are no options(mode is tags), we need to split the input value by comma
              e.preventDefault();
              const inputValue = (e.target as HTMLInputElement).value;
              if (inputValue) {
                handleInputSplit(inputValue);
              }
            }
          }}
        />

        <div className="workflow-array-field-divider" />
        <Tooltip
          overlayClassName="custom-tooltip"
          placement="top"
          title={hasCopied ? 'Copied to clipboard' : 'Copy'}>
          <Button
            className="workflow-array-field-copy-button remove-button-default-styling"
            icon={<CopyLeft height={20} />}
            size="small"
            type="text"
            onClick={(e) => {
              e.stopPropagation();
              handleCopy(e);
            }}
          />
        </Tooltip>
      </Col>
    </Row>
  );
};

export default WorkflowArrayFieldTemplate;
