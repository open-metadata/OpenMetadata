/*
 *  Copyright 2022 Collate.
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

import { Modal, Typography } from 'antd';
import classNames from 'classnames';
import { t } from 'i18next';
import { clone } from 'lodash';
import React, { FC, useEffect, useState } from 'react';
import SchemaEditor from '../../schema-editor/SchemaEditor';
import CloseIcon from '../CloseIcon.component';
import { SchemaModalProp } from './SchemaModal.interface';
import './SchemaModal.style.less';

const SchemaModal: FC<SchemaModalProp> = ({
  className,
  onClose,
  data,
  visible,
}) => {
  const [schemaText, setSchemaText] = useState(data);

  useEffect(() => {
    setSchemaText(clone(data));
  }, [data, visible]);

  return (
    <Modal
      centered
      destroyOnClose
      className={classNames('schema-modal', className)}
      closeIcon={
        <CloseIcon
          dataTestId="schema-modal-close-button"
          handleCancel={onClose}
        />
      }
      data-testid="schema-modal"
      footer={null}
      maskClosable={false}
      open={visible}
      title={
        <Typography.Text strong data-testid="schema-modal-header">
          {t('label.json-data')}
        </Typography.Text>
      }
      width={800}
      onCancel={onClose}>
      <div data-testid="schema-modal-body">
        <SchemaEditor
          className="schema-editor"
          editorClass="custom-entity-schema"
          value={schemaText}
        />
      </div>
    </Modal>
  );
};

export default SchemaModal;
