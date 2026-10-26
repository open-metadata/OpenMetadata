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

import { Button, SimpleModal } from '@openmetadata/ui-core-components';
import classNames from 'classnames';

import { clone } from 'lodash';
import { FC, lazy, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import { KeyDownStopPropagationWrapper } from '../../common/KeyDownStopPropagationWrapper/KeyDownStopPropagationWrapper';
import './schema-modal.less';
import { SchemaModalProp } from './SchemaModal.interface';

const SchemaEditor = withSuspenseFallback(
  lazy(() => import('../../Database/SchemaEditor/SchemaEditor'))
);

const SchemaModal: FC<SchemaModalProp> = ({
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
    <SimpleModal
      data-testid="schema-modal"
      footer={
        isFooterVisible ? (
          <KeyDownStopPropagationWrapper>
            <Button
              color="secondary"
              data-testid="cancel"
              key="cancelButton"
              onClick={onClose}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary"
              data-testid="save"
              key="saveButton"
              onClick={onSave}>
              {t('label.save')}
            </Button>
          </KeyDownStopPropagationWrapper>
        ) : null
      }
      isDismissable={false}
      isOpen={visible}
      title={t('label.json-data')}
      width={800}
      onCancel={onClose}>
      <KeyDownStopPropagationWrapper>
        <div data-testid="schema-modal-body">
          <SchemaEditor
            className="schema-editor"
            editorClass={classNames('custom-entity-schema', editorClass)}
            mode={mode}
            value={schemaText as string}
            onChange={onChange}
          />
        </div>
      </KeyDownStopPropagationWrapper>
    </SimpleModal>
  );
};

export default SchemaModal;
