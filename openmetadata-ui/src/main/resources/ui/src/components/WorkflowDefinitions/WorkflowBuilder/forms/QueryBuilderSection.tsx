/*
 *  Copyright 2025 Collate.
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

import { Registry } from '@rjsf/utils';
import { ConfigProvider } from 'antd';
import { noop } from 'lodash';
import React, { useEffect, useState } from 'react';
import { useWorkflowModeContext } from '../../../../contexts/WorkflowModeContext';
import { EntityType } from '../../../../enums/entity.enum';
import QueryBuilderWidget from '../../../common/Form/JSONSchema/JsonSchemaWidgets/QueryBuilderWidget/QueryBuilderWidget';
import { SearchOutputType } from '../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';

const PORTAL_CONTAINER_ID = 'workflow-query-builder-portal';

const getQueryBuilderPortalContainer = (): HTMLElement => {
  let container = document.getElementById(PORTAL_CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = PORTAL_CONTAINER_ID;
    container.setAttribute('data-react-aria-top-layer', 'true');
    container.style.position = 'absolute';
    container.style.zIndex = '10001';
    document.body.appendChild(container);
  }

  return container;
};

interface QueryBuilderSectionProps {
  entityTypes?: EntityType;
  forceReadOnly?: boolean;
  label?: string;
  outputType?: SearchOutputType;
  value: string;
  onChange: (value: string) => void;
}

export const QueryBuilderSection: React.FC<QueryBuilderSectionProps> = ({
  entityTypes = EntityType.ALL,
  forceReadOnly = false,
  label,
  onChange,
  outputType,
  value,
}) => {
  const { isViewMode } = useWorkflowModeContext();
  const readOnly = isViewMode || forceReadOnly;

  const [internalValue, setInternalValue] = useState(value || '');
  const emptyRegistry = {} as Registry;

  useEffect(() => {
    setInternalValue(value || '');
  }, [value]);

  const handleChange = (newValue: string) => {
    if (readOnly) {
      return;
    }
    setInternalValue(newValue);
    onChange(newValue);
  };

  return (
    <div
      className={readOnly ? 'tw:pointer-events-none' : ''}
      data-testid="query-builder-section">
      <ConfigProvider getPopupContainer={getQueryBuilderPortalContainer}>
        <QueryBuilderWidget
          data-testid="query-builder-widget"
          id={`query-builder-${label?.toLowerCase().replace(/\s+/g, '-')}`}
          label={label || ''}
          name={`query-builder-${label?.toLowerCase().replace(/\s+/g, '-')}`}
          options={{}}
          registry={emptyRegistry}
          schema={{
            entityType: entityTypes,
            ...(outputType === SearchOutputType.JSONLogic && {
              outputType,
            }),
          }}
          value={internalValue}
          onBlur={noop}
          onChange={handleChange}
          onFocus={noop}
        />
      </ConfigProvider>
    </div>
  );
};
