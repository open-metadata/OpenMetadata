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
import { CloseCircleOutlined, LockOutlined } from '@ant-design/icons';
import { WidgetProps } from '@rjsf/utils';
import {
  Button,
  Col,
  Input,
  Radio,
  RadioChangeEvent,
  Row,
  Space,
  Typography,
} from 'antd';
import { FC, useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ALL_ASTERISKS_REGEX } from '../../../../../constants/regex.constants';
import { CertificationInputType } from '../../../../../enums/PasswordWidget.enum';
import FileUploadWidget from './FileUploadWidget';
import './password-widget.less';

const PasswordWidget: FC<WidgetProps> = (props) => {
  const { t } = useTranslation();

  const isMaskedValue = useMemo(
    () => ALL_ASTERISKS_REGEX.test(props.value),
    [props.value]
  );

  const wasOriginallyMasked = useRef(isMaskedValue);

  const [isEditing, setIsEditing] = useState(!isMaskedValue);
  const [inputType, setInputType] = useState<CertificationInputType>(
    props.schema.uiFieldType === 'fileOrInput'
      ? CertificationInputType.FILE_UPLOAD
      : CertificationInputType.FILE_PATH
  );

  const isInputTypeFile = props.schema.uiFieldType === 'file';
  const isInputTypeFileOrInput = props.schema.uiFieldType === 'fileOrInput';

  const passwordWidgetValue = useMemo(() => {
    if (isMaskedValue) {
      return undefined;
    }

    return props.value;
  }, [props.value, isMaskedValue]);

  const handleRemove = useCallback(() => {
    props.onChange('');
    setIsEditing(true);
  }, [props]);

  const handleUpdate = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    props.onChange(props.value);
  }, [props]);

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
    [props, passwordWidgetValue]
  );

  const getSavedPasswordIndicator = useCallback(
    () => (
      <Space className="password-saved-indicator" direction="vertical" size={4}>
        <Space size={8}>
          {/* <LockOutlined className="password-saved-icon" /> */}
          <Typography.Text className="password-saved-text" type="secondary">
            {t('message.password-saved')}
          </Typography.Text>
        </Space>
        <Space size={8}>
          <Button
            data-testid={`password-update-btn-${props.id}`}
            size="small"
            type="link"
            onClick={handleUpdate}>
            {t('label.update')}
          </Button>
          {!props.required && (
            <Button
              danger
              data-testid={`password-remove-btn-${props.id}`}
              icon={<CloseCircleOutlined />}
              size="small"
              type="link"
              onClick={handleRemove}>
              {t('label.remove')}
            </Button>
          )}
        </Space>
      </Space>
    ),
    [props.id, props.required, handleUpdate, handleRemove, t]
  );

  const getEditingPasswordInput = useCallback(
    (disabled?: boolean) => (
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        {getPasswordInput(disabled)}
        {wasOriginallyMasked.current && (
          <Button
            data-testid={`password-cancel-edit-btn-${props.id}`}
            size="small"
            type="link"
            onClick={handleCancelEdit}>
            {t('label.cancel')}
          </Button>
        )}
      </Space>
    ),
    [getPasswordInput, props.id, handleCancelEdit, t]
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
        className="password-widget m-t-sm"
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
              {wasOriginallyMasked.current && !isEditing
                ? getSavedPasswordIndicator()
                : getEditingPasswordInput(
                    inputType === CertificationInputType.FILE_UPLOAD
                  )}
            </Radio>
          </Col>
        </Row>
      </Radio.Group>
    );
  }

  if (wasOriginallyMasked.current && !isEditing) {
    return getSavedPasswordIndicator();
  }

  return getEditingPasswordInput();
};

export default PasswordWidget;
