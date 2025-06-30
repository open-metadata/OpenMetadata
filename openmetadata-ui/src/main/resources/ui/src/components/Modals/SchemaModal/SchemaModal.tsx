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

import { Button, Modal, Typography } from 'antd';
import classNames from 'classnames';

import { clone } from 'lodash';
import { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SchemaEditor from '../../Database/SchemaEditor/SchemaEditor';
import CloseIcon from '../CloseIcon.component';
import './schema-modal.less';
import { SchemaModalProp } from './SchemaModal.interface';

const SchemaModal: FC<SchemaModalProp> = ({
  className,
  onClose,
  onChange,
  editorClass,
  data,
  mode,
  visible,
  onSave,
  isFooterVisible = false,
}) => {
  const [schemaText, setSchemaText] = useState(data);
  const { t } = useTranslation();
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
      footer={
        isFooterVisible
          ? [
              <Button
                data-testid="cancel"
                key="cancelButton"
                type="link"
                onClick={onClose}>
                {t('label.cancel')}
              </Button>,
              <Button
                data-testid="save"
                key="saveButton"
                type="primary"
                onClick={onSave}>
                {t('label.save')}
              </Button>,
            ]
          : null
      }
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
          editorClass={classNames('custom-entity-schema', editorClass)}
          mode={mode}
          value={schemaText as string}
          onChange={onChange}
        />
      </div>
    </Modal>
  );
};

export default SchemaModal;
