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

import { Button, Input } from '@openmetadata/ui-core-components';
import {
  ADDITIONAL_PROPERTY_FLAG,
  WrapIfAdditionalTemplateProps,
} from '@rjsf/utils';
import { Trash01 } from '@untitledui/icons';
import { FunctionComponent, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const CoreWrapIfAdditionalTemplate: FunctionComponent<
  WrapIfAdditionalTemplateProps
> = ({
  id,
  label,
  onKeyChange,
  onDropPropertyClick,
  disabled,
  readonly,
  schema,
  children,
}) => {
  const { t } = useTranslation();
  const [keyValue, setKeyValue] = useState(label);
  const additional = ADDITIONAL_PROPERTY_FLAG in schema;

  if (!additional) {
    return <>{children}</>;
  }

  return (
    <div className="tw:flex tw:w-full tw:items-end tw:gap-2">
      <div className="tw:w-2/5 tw:shrink-0">
        <Input
          id={`${id}-key`}
          label={t('label.key')}
          placeholder={t('label.key')}
          value={keyValue}
          onBlur={() => onKeyChange(keyValue)}
          onChange={setKeyValue}
        />
      </div>
      <div className="tw:flex-1">{children}</div>
      <Button
        aria-label={t('label.remove')}
        className="tw:mb-0.5 tw:shrink-0"
        color="secondary"
        isDisabled={disabled || readonly}
        size="sm"
        type="button"
        onClick={onDropPropertyClick(label)}>
        <Trash01 data-icon size={14} />
      </Button>
    </div>
  );
};
