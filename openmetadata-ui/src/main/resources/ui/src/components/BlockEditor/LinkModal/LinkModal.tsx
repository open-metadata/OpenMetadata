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

export interface LinkData {
  href: string;
}

export interface LinkModalProps {
  isOpen: boolean;
  data: LinkData;
  onSave: (data: LinkData) => void;
  onCancel: () => void;
  /**
   * Optional portal container for the modal. When the editor lives inside a
   * focus-trapping dialog/drawer (e.g. React Aria's SlideoutMenu), the modal
   * must render *inside* that dialog so the dialog's focus scope and
   * useInteractOutside do not steal focus from the input or dismiss the drawer
   * when the modal opens. Falls back to document.body (antd default) otherwise.
   */
  getContainer?: () => HTMLElement;
}

/**
 * z-index for the link modal when mounted inside a React Aria dialog. Must
 * exceed React Aria's useOverlayPosition z-index (100000) so the modal and its
 * mask paint above the dialog content. Keep in sync with the suggestion popup
 * z-index used by the handlebars extension.
 */
const LINK_MODAL_Z_INDEX = 100001;

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

  // Only elevate the z-index when the modal is actually mounted inside a
  // focus-trapping dialog (getContainer resolves to a non-body element). In
  // every other context the antd default is used so the modal does not paint
  // above unrelated portals (e.g. notifications/messages).
  const container = getContainer?.();
  const zIndex =
    container && container !== document.body ? LINK_MODAL_Z_INDEX : undefined;

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
