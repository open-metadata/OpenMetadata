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
import { Button, Col, Form, Input, Modal, Row } from 'antd';
import { ReactComponent as PlusIcon } from 'assets/svg/plus-primary.svg';
import { TermReference } from 'generated/entity/data/glossaryTerm';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import SVGIcons, { Icons } from 'utils/SvgUtils';

interface GlossaryTermReferencesModalProps {
  references: TermReference[];
  isVisible: boolean;
  onClose: () => void;
  onSave: (values: TermReference[]) => void;
}

const GlossaryTermReferencesModal = ({
  references,
  isVisible,
  onClose,
  onSave,
}: GlossaryTermReferencesModalProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<{ references: TermReference[] }>();

  const handleSubmit = async (obj: { references: TermReference[] }) => {
    try {
      await form.validateFields();
      onSave(obj.references);
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    isVisible ? form.setFieldValue('references', references) : null;
  }, [isVisible]);

  return (
    <Modal
      destroyOnClose
      footer={[
        <Button key="cancel-btn" type="link" onClick={onClose}>
          {t('label.cancel')}
        </Button>,
        <Button
          data-testid="save-button"
          key="save-btn"
          type="primary"
          onClick={() => form.submit()}>
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
                        <SVGIcons
                          alt="delete"
                          icon={Icons.DELETE}
                          width="16px"
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
                  icon={<PlusIcon className="anticon" />}
                  size="small"
                  onClick={() => add()}>
                  {t('label.add-entity', {
                    entity: t('label.reference-plural'),
                  })}
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
