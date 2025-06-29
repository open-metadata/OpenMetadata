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
import { WidgetProps } from '@rjsf/utils';
import { Col, Input, Radio, RadioChangeEvent, Row, Typography } from 'antd';
import { FC, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ALL_ASTERISKS_REGEX } from '../../../../../constants/regex.constants';
import { CertificationInputType } from '../../../../../enums/PasswordWidget.enum';
import FileUploadWidget from './FileUploadWidget';
import './password-widget.less';

const PasswordWidget: FC<WidgetProps> = (props) => {
  const { t } = useTranslation();
  const [inputType, setInputType] = useState<CertificationInputType>(
    props.schema.uiFieldType === 'fileOrInput'
      ? CertificationInputType.FILE_UPLOAD
      : CertificationInputType.FILE_PATH
  );

  const isInputTypeFile = props.schema.uiFieldType === 'file';
  const isInputTypeFileOrInput = props.schema.uiFieldType === 'fileOrInput';

  const passwordWidgetValue = useMemo(() => {
    if (ALL_ASTERISKS_REGEX.test(props.value)) {
      return undefined; // Do not show the password if it is masked
    } else {
      return props.value;
    }
  }, [props.value]);

  const getPasswordInput = useCallback(
    (disabled?: boolean) => (
      <Input.Password
        autoComplete="off"
        autoFocus={props.autofocus}
        data-testid={`password-input-widget-${props.id}`}
        disabled={disabled || props.disabled}
        id={props.id}
        name={props.name}
        placeholder={props.placeholder}
        readOnly={props.readonly}
        required={props.required}
        value={passwordWidgetValue}
        onBlur={() => props.onBlur(props.id, props.value)}
        onChange={(e) => props.onChange(e.target.value)}
        onFocus={() => props.onFocus(props.id, props.value)}
      />
    ),
    [props]
  );

  const onRadioChange = (e: RadioChangeEvent) => {
    setInputType(e.target.value);
  };

  if (isInputTypeFile) {
    return <FileUploadWidget {...props} />;
  }

  if (isInputTypeFileOrInput) {
    return (
      <Radio.Group
        className="password-widget"
        data-testid={`password-input-radio-group-${props.id}`}
        value={inputType}
        onChange={onRadioChange}>
        <Row>
          <Col span={8}>
            <Radio
              className="widget-radio-option"
              data-testid={`radio-${CertificationInputType.FILE_UPLOAD}`}
              value={CertificationInputType.FILE_UPLOAD}>
              <Typography.Text>{t('message.upload-file')}</Typography.Text>
              <FileUploadWidget
                {...props}
                disabled={inputType === CertificationInputType.FILE_PATH}
              />
            </Radio>
          </Col>
          <Col span={16}>
            <Radio
              className="widget-radio-option"
              data-testid={`radio-${CertificationInputType.FILE_PATH}`}
              value={CertificationInputType.FILE_PATH}>
              <Typography.Text>{t('label.enter-file-content')}</Typography.Text>
              {getPasswordInput(
                inputType === CertificationInputType.FILE_UPLOAD
              )}
            </Radio>
          </Col>
        </Row>
      </Radio.Group>
    );
  }

  return getPasswordInput();
};

export default PasswordWidget;
