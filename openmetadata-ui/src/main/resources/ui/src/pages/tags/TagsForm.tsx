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

import { Form, Input, Modal, Space, Switch, Typography } from 'antd';
import RichTextEditor from 'components/common/rich-text-editor/RichTextEditor';
import { VALIDATION_MESSAGES } from 'constants/constants';
import { delimiterRegex } from 'constants/regex.constants';
import { DEFAULT_FORM_VALUE } from 'constants/Tags.constant';
import { Classification } from 'generated/entity/classification/classification';
import { Tag } from 'generated/entity/classification/tag';
import { isUndefined, toLower } from 'lodash';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { isUrlFriendlyName } from 'utils/CommonUtils';

interface SubmitProps {
  name: string;
  description: string;
  displayName: string;
  mutuallyExclusive?: boolean;
}

interface RenameFormProps {
  visible: boolean;
  onCancel: () => void;
  header: string;
  initialValues?: Tag;
  onSubmit: (value: SubmitProps) => void;
  showMutuallyExclusive?: boolean;
  isClassification?: boolean;
  data?: Classification[];
  disableName?: boolean;
  isLoading: boolean;
}

const TagsForm: React.FC<RenameFormProps> = ({
  visible,
  onCancel,
  header,
  initialValues,
  onSubmit,
  showMutuallyExclusive = false,
  data,
  isClassification = false,
  disableName = false,
  isLoading,
}): JSX.Element => {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  useEffect(() => {
    form.setFieldsValue(initialValues);
  }, [initialValues]);

  return (
    <Modal
      centered
      destroyOnClose
      closable={false}
      data-testid="modal-container"
      okButtonProps={{
        form: 'tags',
        type: 'primary',
        htmlType: 'submit',
        loading: isLoading,
      }}
      okText={t('label.save')}
      open={visible}
      title={
        <Typography.Text strong data-testid="header">
          {header}
        </Typography.Text>
      }
      width={750}
      onCancel={() => {
        form.setFieldsValue(DEFAULT_FORM_VALUE);
        onCancel();
      }}>
      <Form
        form={form}
        initialValues={initialValues || DEFAULT_FORM_VALUE}
        layout="vertical"
        name="tags"
        validateMessages={VALIDATION_MESSAGES}
        onFinish={(data) => {
          onSubmit(data);
          form.setFieldsValue(DEFAULT_FORM_VALUE);
        }}>
        <Form.Item
          data-testid="name"
          label={t('label.name')}
          name="name"
          rules={[
            {
              required: true,
              type: 'string',
              min: 2,
              max: 64,
              whitespace: true,
            },
            {
              validator: (_, value) => {
                if (delimiterRegex.test(value)) {
                  return Promise.reject(
                    t('message.entity-delimiters-not-allowed', {
                      entity: t('label.name'),
                    })
                  );
                }
                if (isClassification) {
                  if (!isUrlFriendlyName(value)) {
                    return Promise.reject(
                      t('message.special-character-not-allowed')
                    );
                  } else if (
                    !isUndefined(
                      data?.find(
                        (item) => toLower(item.name) === toLower(value)
                      )
                    )
                  ) {
                    return Promise.reject(
                      t('message.entity-already-exists', {
                        entity: t('label.name'),
                      })
                    );
                  }
                }

                return Promise.resolve();
              },
            },
          ]}>
          <Input disabled={disableName} placeholder={t('label.name')} />
        </Form.Item>

        <Form.Item
          data-testid="displayName"
          label={t('label.display-name')}
          name="displayName"
          rules={[{ required: true }]}>
          <Input placeholder={t('label.display-name')} />
        </Form.Item>

        <Form.Item label={t('label.description')} name="description">
          <RichTextEditor
            data-testid="test-suite-description"
            initialValue={initialValues?.description || ''}
            onTextChange={(value) =>
              form.setFieldsValue({ description: value })
            }
          />
        </Form.Item>
        {showMutuallyExclusive && (
          <Space align="center" className="switch-field">
            <Typography.Text>{t('label.mutually-exclusive')}</Typography.Text>
            <Form.Item
              data-testid="mutually-exclusive-label"
              name="mutuallyExclusive">
              <Switch data-testid="mutually-exclusive-button" />
            </Form.Item>
          </Space>
        )}
      </Form>
    </Modal>
  );
};

export default TagsForm;
