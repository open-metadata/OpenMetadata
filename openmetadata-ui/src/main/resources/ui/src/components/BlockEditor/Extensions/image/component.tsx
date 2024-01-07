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
import { NodeViewProps } from '@tiptap/core';
import { NodeViewWrapper } from '@tiptap/react';
import {
  Button,
  Col,
  Form,
  FormProps,
  Input,
  Popover,
  Row,
  Space,
  Tabs,
  Typography,
  Upload,
  UploadProps,
} from 'antd';
import { UploadChangeParam } from 'antd/lib/upload';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import React, { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconFormatImage } from '../../../../assets/svg/ic-format-image.svg';
import Loader from '../../../Loader/Loader';

interface PopoverContentProps {
  updateAttributes: NodeViewProps['updateAttributes'];
  deleteNode: NodeViewProps['deleteNode'];
  isUploading: boolean;
  isValidSource: boolean;
  src: string;
  onPopupVisibleChange: (value: boolean) => void;
  onUploadingChange: (value: boolean) => void;
}

const PopoverContent: FC<PopoverContentProps> = ({
  updateAttributes,
  onPopupVisibleChange,
  onUploadingChange,
  isUploading,
  deleteNode,
  isValidSource,
  src,
}) => {
  const { t } = useTranslation();
  const handleFileUploadChange = async (info: UploadChangeParam) => {
    try {
      const srcUrl = info.file.response?.result;
      if (srcUrl) {
        updateAttributes({ src: srcUrl, alt: info.file.fileName });
        onPopupVisibleChange(false);
      }
    } catch (error) {
      // handle error
    } finally {
      onUploadingChange(false);
    }
  };

  const handleRequestUpload: UploadProps['customRequest'] = (options) => {
    onUploadingChange(true);
    const reader = new FileReader();
    reader.readAsDataURL(options.file as Blob);
    reader.addEventListener('load', (e) => {
      setTimeout(() => {
        options?.onSuccess?.(e.target);
      }, 1000);
    });
  };

  const handleEmbedImage: FormProps['onFinish'] = (values) => {
    onPopupVisibleChange(false);
    onUploadingChange(true);
    const { Url } = values;
    updateAttributes({ src: Url });
    onUploadingChange(false);
  };

  const uploadElement = (
    <Upload
      accept="image/jpeg, image/png, image/webp"
      className="om-node-image-upload"
      customRequest={handleRequestUpload}
      multiple={false}
      showUploadList={false}
      onChange={handleFileUploadChange}>
      <Space className="om-image-node-action">
        <Button className="w-full" disabled={isUploading}>
          {isValidSource ? t('label.update-image') : t('label.upload-image')}
        </Button>
        {isValidSource && (
          <Button
            className="w-full"
            disabled={isUploading}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              deleteNode();
            }}>
            {t('label.delete')}
          </Button>
        )}
      </Space>
    </Upload>
  );

  const embedLinkElement = (
    <Form initialValues={{ Url: src }} onFinish={handleEmbedImage}>
      <Row gutter={[8, 8]}>
        <Col span={24}>
          <Form.Item name="Url" rules={[{ required: true, type: 'url' }]}>
            <Input autoFocus placeholder="Paste the image link..." />
          </Form.Item>
        </Col>
        <Col className="om-image-node-embed-link-btn-col" span={24}>
          <Button htmlType="submit" type="primary">
            {t('label.embed-image')}
          </Button>
        </Col>
      </Row>
    </Form>
  );

  return (
    <Tabs
      defaultActiveKey="upload"
      items={[
        {
          label: t('label.upload'),
          key: 'upload',
          children: uploadElement,
        },
        {
          label: t('label.embed-link'),
          key: 'embed',
          children: embedLinkElement,
        },
      ]}
    />
  );
};

const ImageComponent: FC<NodeViewProps> = ({
  node,
  updateAttributes,
  deleteNode,
}) => {
  const { t } = useTranslation();
  const { src, alt } = node.attrs;
  const isValidSource = !isEmpty(src);

  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isPopupVisible, setIsPopupVisible] = useState<boolean>(!isValidSource);

  return (
    <NodeViewWrapper as="div" className="om-react-node">
      <div className={classNames({ 'om-image-node-wrapper': isPopupVisible })}>
        <Popover
          align={{ targetOffset: [0, 16] }}
          content={
            <PopoverContent
              deleteNode={deleteNode}
              isUploading={isUploading}
              isValidSource={isValidSource}
              src={src}
              updateAttributes={updateAttributes}
              onPopupVisibleChange={(value) => setIsPopupVisible(value)}
              onUploadingChange={(value) => setIsUploading(value)}
            />
          }
          destroyTooltipOnHide={{ keepParent: false }}
          open={isPopupVisible}
          overlayClassName="om-image-node-popover"
          placement="bottom"
          showArrow={false}
          trigger="click"
          onOpenChange={setIsPopupVisible}>
          {isValidSource ? (
            <div className="om-image-node-uploaded">
              <img alt={alt ?? ''} src={src} />
            </div>
          ) : (
            <div className="image-placeholder" contentEditable={false}>
              {isUploading ? (
                <Loader />
              ) : (
                <>
                  <IconFormatImage
                    style={{ verticalAlign: 'middle' }}
                    width={40}
                  />
                  <Typography>{t('label.add-an-image')}</Typography>
                </>
              )}
            </div>
          )}
        </Popover>
      </div>
    </NodeViewWrapper>
  );
};

ImageComponent.displayName = 'ImageComponent';

export default ImageComponent;
