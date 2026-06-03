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

import { WidgetProps } from '@rjsf/utils';
import { startCase } from 'lodash';
import i18n from '../../../../../../utils/i18next/LocalUtil';
import {
  DesignSecretControl,
  DesignTextControl,
  isValidPrivateKey,
} from './DesignControls';

const KEY_FIELD = /privatekey$/i;

const getLabel = (props: WidgetProps): string =>
  props.label || props.schema.title || startCase(props.id.split('/').pop());

const getHint = (props: WidgetProps): string | undefined =>
  props.schema.description || props.options?.help;

export const DesignTextWidget = (props: WidgetProps) => {
  const { schema, options } = props;
  const isNumber = schema.type === 'number' || schema.type === 'integer';

  const handleChange = (value: string) => {
    if (isNumber) {
      props.onChange(value === '' ? options?.emptyValue : Number(value));
    } else {
      props.onChange(value);
    }
  };

  return (
    <DesignTextControl
      autofocus={props.autofocus}
      disabled={props.disabled}
      error={props.rawErrors?.[0]}
      hint={getHint(props)}
      id={props.id}
      inputMode={isNumber ? 'decimal' : 'text'}
      label={getLabel(props)}
      placeholder={props.placeholder}
      readonly={props.readonly}
      required={props.required}
      suffix={options?.suffix as string | undefined}
      value={props.value ?? ''}
      onBlur={() => props.onBlur(props.id, props.value)}
      onChange={handleChange}
      onFocus={() => props.onFocus(props.id, props.value)}
    />
  );
};

export const DesignSecretWidget = (props: WidgetProps) => {
  const isKey = KEY_FIELD.test(props.id);
  const pemError =
    isKey && !isValidPrivateKey(props.value)
      ? i18n.t('message.invalid-private-key-format')
      : undefined;

  return (
    <DesignSecretControl
      allowUpload={isKey}
      autofocus={props.autofocus}
      disabled={props.disabled}
      error={props.rawErrors?.[0] ?? pemError}
      hint={getHint(props)}
      id={props.id}
      label={getLabel(props)}
      multiline={isKey}
      placeholder={props.placeholder}
      readonly={props.readonly}
      required={props.required}
      value={props.value ?? ''}
      onBlur={() => props.onBlur(props.id, props.value)}
      onChange={(value) => props.onChange(value === '' ? undefined : value)}
      onFocus={() => props.onFocus(props.id, props.value)}
    />
  );
};
