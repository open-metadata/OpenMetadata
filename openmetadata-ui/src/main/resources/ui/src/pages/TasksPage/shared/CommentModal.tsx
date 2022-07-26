/*
 *  Copyright 2021 Collate
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

import { Modal } from 'antd';
import React, { FC } from 'react';
import RichTextEditor from '../../../components/common/rich-text-editor/RichTextEditor';
import { Thread } from '../../../generated/entity/feed/thread';

interface CommentModalProps {
  taskDetail: Thread;
  comment: string;
  isVisible: boolean;
  setComment: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

const CommentModal: FC<CommentModalProps> = ({
  taskDetail,
  comment,
  isVisible,
  setComment,
  onClose,
  onConfirm,
}) => {
  return (
    <Modal
      centered
      destroyOnClose
      cancelButtonProps={{
        type: 'link',
        className: 'ant-btn-link-custom',
      }}
      data-testid="comment-modal"
      okButtonProps={{
        disabled: !comment,
        className: 'ant-btn-primary-custom',
      }}
      okText="Close with comment"
      title={`Close Task #${taskDetail.task?.id} ${taskDetail.message}`}
      visible={isVisible}
      width={700}
      onCancel={onClose}
      onOk={onConfirm}>
      <RichTextEditor
        height="208px"
        initialValue={comment}
        placeHolder="Add comment"
        style={{ marginTop: '0px' }}
        onTextChange={setComment}
      />
    </Modal>
  );
};

export default CommentModal;
