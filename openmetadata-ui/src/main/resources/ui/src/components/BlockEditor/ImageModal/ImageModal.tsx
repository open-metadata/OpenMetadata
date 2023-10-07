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
import { Form, FormProps, Input, Modal } from 'antd';
import React, { FC } from 'react';

export interface ImageData {
  src: string;
}

export interface LinkModalProps {
  isOpen: boolean;
  onSave: (data: ImageData) => void;
  onCancel: () => void;
}

const ImageModal: FC<LinkModalProps> = ({ isOpen, onSave, onCancel }) => {
  const handleSubmit: FormProps<ImageData>['onFinish'] = (values) => {
    onSave(values);
  };

  return (
    <Modal
      className="block-editor-image-modal"
      maskClosable={false}
      okButtonProps={{
        htmlType: 'submit',
        id: 'image-form',
        form: 'image-form',
      }}
      okText="Save"
      open={isOpen}
      onCancel={onCancel}>
      <Form
        data-testid="image-form"
        id="image-form"
        layout="vertical"
        onFinish={handleSubmit}>
        <Form.Item label="Image link" name="src">
          <Input autoFocus required />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ImageModal;
