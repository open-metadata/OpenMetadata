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
import Icon from '@ant-design/icons/lib/components/Icon';
import { Button, Col, Form, Input, Modal, Row } from 'antd';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconDelete } from '../../../assets/svg/ic-delete.svg';
import { ReactComponent as PlusIcon } from '../../../assets/svg/plus-primary.svg';
import { TermReference } from '../../../generated/entity/data/glossaryTerm';

interface GlossaryTermReferencesModalProps {
  references: TermReference[];
  isVisible: boolean;
  onClose: () => void;
  onSave: (values: TermReference[]) => Promise<void>;
}

const GlossaryTermReferencesModal = ({
  references,
  isVisible,
  onClose,
  onSave,
}: GlossaryTermReferencesModalProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<{ references: TermReference[] }>();
  const [saving, setSaving] = useState<boolean>(false);

  const handleSubmit = async (obj: { references: TermReference[] }) => {
    try {
      setSaving(true);
      await form.validateFields();
      await onSave(obj.references);
    } catch (_) {
      // Nothing here
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (isVisible) {
      const newRefs =
        references.length > 0
          ? references
          : [
              {
                name: '',
                endpoint: '',
              },
            ];
      form.setFieldValue('references', newRefs);
    }
  }, [isVisible]);

  return (
    <Modal
      destroyOnClose
      data-testid="glossary-term-references-modal"
      footer={[
        <Button key="cancel-btn" type="link" onClick={onClose}>
          {t('label.cancel')}
        </Button>,
        <Button
          data-testid="save-btn"
          key="save-btn"
          loading={saving}
          type="primary"
          onClick={form.submit}>
          {t('label.save')}
        </Button>,
      ]}
      open={isVisible}
      title={t('label.reference-plural')}
      onCancel={onClose}>
      <Form className="reference-edit-form" form={form} onFinish={handleSubmit}>
        <Form.List name="references">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...restField }) => (
                <Row gutter={8} key={key}>
                  <Col span={12}>
                    <Form.Item
                      className="w-full"
                      {...restField}
                      name={[name, 'name']}
                      rules={[
                        {
                          required: true,
                          message: t('label.field-required', {
                            field: t('label.name'),
                          }),
                        },
                      ]}>
                      <Input placeholder={t('label.name')} />
                    </Form.Item>
                  </Col>
                  <Col span={11}>
                    <Form.Item
                      className="w-full"
                      {...restField}
                      name={[name, 'endpoint']}
                      rules={[
                        {
                          required: true,
                          message: t('label.field-required', {
                            field: t('label.endpoint'),
                          }),
                        },
                        {
                          type: 'url',
                          message: t('message.endpoint-should-be-valid'),
                        },
                      ]}>
                      <Input placeholder={t('label.endpoint')} />
                    </Form.Item>
                  </Col>

                  <Col span={1}>
                    <Button
                      icon={
                        <Icon
                          className="align-middle"
                          component={IconDelete}
                          style={{ fontSize: '16px' }}
                        />
                      }
                      size="small"
                      type="text"
                      onClick={() => remove(name)}
                    />
                  </Col>
                </Row>
              ))}
              <Form.Item>
                <Button
                  className="text-primary d-flex items-center"
                  data-testid="add-references-button"
                  icon={<PlusIcon className="anticon" />}
                  size="small"
                  onClick={() => add()}>
                  {t('label.add')}
                </Button>
              </Form.Item>
            </>
          )}
        </Form.List>
      </Form>
    </Modal>
  );
};

export default GlossaryTermReferencesModal;
