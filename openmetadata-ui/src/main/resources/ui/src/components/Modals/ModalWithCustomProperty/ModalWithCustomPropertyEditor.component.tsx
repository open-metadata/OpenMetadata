/*
 *  Copyright 2024 Collate.
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
import { AxiosError } from 'axios';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomizeEntityType } from '../../../constants/Customize.constants';
import { Table } from '../../../generated/entity/data/table';
import { Type } from '../../../generated/entity/type';
import { getTypeByFQN } from '../../../rest/metadataTypeAPI';
import {
  convertCustomPropertyStringToEntityExtension,
  convertEntityExtensionToCustomPropertyString,
} from '../../../utils/CSV/CSV.utils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { CustomPropertyTable } from '../../common/CustomPropertyTable/CustomPropertyTable';
import { ExtentionEntities } from '../../common/CustomPropertyTable/CustomPropertyTable.interface';
import Loader from '../../common/Loader/Loader';
import { GenericProvider } from '../../Customization/GenericProvider/GenericProvider';
import {
  ExtensionDataProps,
  ModalWithCustomPropertyEditorProps,
} from './ModalWithMarkdownEditor.interface';

export const ModalWithCustomPropertyEditor = ({
  header,
  entityType,
  value,
  onSave,
  onCancel,
  visible,
}: ModalWithCustomPropertyEditorProps) => {
  const { t } = useTranslation();

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaveLoading, setIsSaveLoading] = useState<boolean>(false);

  const [extensionObject, setExtensionObject] = useState<ExtensionDataProps>();

  const [customPropertyEntityRecord, setCustomPropertyEntityRecord] =
    useState<Type>();

  const fetchTypeDetail = async () => {
    setIsLoading(true);
    try {
      const response = await getTypeByFQN(entityType);
      setCustomPropertyEntityRecord(response);
      setExtensionObject(
        convertCustomPropertyStringToEntityExtension(value ?? '', response)
      );
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveData = async () => {
    setIsSaveLoading(true);
    await onSave(
      convertEntityExtensionToCustomPropertyString(
        extensionObject,
        customPropertyEntityRecord
      )
    );
    setIsSaveLoading(false);
  };

  const onExtensionUpdate = async (
    data: ExtentionEntities[keyof ExtentionEntities]
  ) => {
    setExtensionObject(data.extension);
  };

  useEffect(() => {
    fetchTypeDetail();
  }, []);

  return (
    <Modal
      centered
      destroyOnClose
      className="description-markdown-editor"
      closable={false}
      data-testid="custom-property-editor"
      footer={[
        <Button
          data-testid="cancel"
          disabled={isSaveLoading}
          key="cancelButton"
          type="link"
          onClick={onCancel}>
          {t('label.cancel')}
        </Button>,
        <Button
          data-testid="save"
          key="saveButton"
          loading={isSaveLoading}
          type="primary"
          onClick={handleSaveData}>
          {t('label.save')}
        </Button>,
      ]}
      maskClosable={false}
      open={visible}
      title={<Typography.Text data-testid="header">{header}</Typography.Text>}
      width={650}
      onCancel={onCancel}>
      {isLoading ? (
        <Loader />
      ) : (
        <GenericProvider<Table>
          customizedPage={null}
          data={
            {
              extension: extensionObject,
            } as Table
          }
          isVersionView={false}
          permissions={DEFAULT_ENTITY_PERMISSION}
          type={entityType as CustomizeEntityType}
          onUpdate={onExtensionUpdate}>
          <CustomPropertyTable
            hasEditAccess
            hasPermission
            isRenderedInRightPanel
            entityType={entityType as keyof ExtentionEntities}
          />
        </GenericProvider>
      )}
    </Modal>
  );
};
