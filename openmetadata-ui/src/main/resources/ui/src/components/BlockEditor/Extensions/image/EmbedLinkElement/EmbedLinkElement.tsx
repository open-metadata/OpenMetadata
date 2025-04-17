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
import { Button, Col, Form, FormProps, Input, Row, Space } from 'antd';
import { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { UPLOADED_ASSETS_URL } from '../../../../../constants/BlockEditor.constants';
import { ImagePopoverContentProps } from '../ImageComponent.interface';

const EmbedLinkElement: FC<ImagePopoverContentProps> = ({
  updateAttributes,
  onPopupVisibleChange,
  onUploadingChange,
  src,
  deleteNode,
  fileType,
}) => {
  const { t } = useTranslation();
  const isAssetsUrl = useMemo(() => {
    return src?.includes(UPLOADED_ASSETS_URL);
  }, [src]);

  const handleEmbedImage: FormProps['onFinish'] = (values) => {
    onPopupVisibleChange(false);
    onUploadingChange(true);
    const { Url } = values;
    updateAttributes({ src: Url });
    onUploadingChange(false);
  };

  return (
    <Form
      data-testid="embed-link-form"
      initialValues={{ Url: src }}
      onFinish={handleEmbedImage}>
      <Row gutter={[8, 8]}>
        <Col span={24}>
          <Form.Item
            name="Url"
            rules={[
              {
                required: true,
                type: 'url',
                message: t('label.field-required', {
                  field: t('label.url-uppercase'),
                }),
              },
            ]}>
            <Input
              autoFocus
              data-testid="embed-input"
              placeholder={
                t('label.paste-the-file-type-link', {
                  fileType: t(`label.${fileType}`),
                }) + ' ...'
              }
            />
          </Form.Item>
        </Col>
        <Col className="om-image-node-embed-link-btn-col gap-3" span={24}>
          <Space className="om-image-node-action">
            <Button
              danger
              type="text"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                deleteNode();
              }}>
              {t('label.delete')}
            </Button>
          </Space>

          <Button type="link" onClick={() => onPopupVisibleChange(false)}>
            {t('label.close')}
          </Button>
          {isAssetsUrl ? null : (
            <Button htmlType="submit" type="primary">
              {t('label.embed-file-type', { fileType })}
            </Button>
          )}
        </Col>
      </Row>
    </Form>
  );
};

export default EmbedLinkElement;
