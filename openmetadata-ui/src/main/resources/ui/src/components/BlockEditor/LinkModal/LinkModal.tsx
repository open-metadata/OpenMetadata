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
import { FC } from 'react';
import { LINK_OVERLAY_Z_INDEX } from '../../../constants/BlockEditor.constants';

export interface LinkData {
  href: string;
}

export interface LinkModalProps {
  isOpen: boolean;
  data: LinkData;
  onSave: (data: LinkData) => void;
  onCancel: () => void;
  /**
   * Portal container for the modal. Lets it mount inside a focus-trapping
   * dialog so the dialog does not steal focus from the input.
   */
  getContainer?: () => HTMLElement;
}

const LinkModal: FC<LinkModalProps> = ({
  isOpen,
  data,
  onSave,
  onCancel,
  getContainer,
}) => {
  const handleSubmit: FormProps<LinkData>['onFinish'] = (values) => {
    onSave(values);
  };

  // Only elevate the z-index when mounted inside a dialog; otherwise the antd
  // default avoids painting above unrelated portals.
  const container = getContainer?.();
  const zIndex =
    container && container !== document.body ? LINK_OVERLAY_Z_INDEX : undefined;

  return (
    <Modal
      className="block-editor-link-modal"
      getContainer={getContainer}
      maskClosable={false}
      okButtonProps={{
        htmlType: 'submit',
        id: 'link-form',
        form: 'link-form',
      }}
      okText="Save"
      open={isOpen}
      title={data.href ? 'Edit link' : 'Add link'}
      zIndex={zIndex}
      onCancel={onCancel}>
      <Form
        data-testid="link-form"
        id="link-form"
        initialValues={{ ...data }}
        layout="vertical"
        onFinish={handleSubmit}>
        <Form.Item label="Link" name="href">
          <Input autoFocus />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default LinkModal;
