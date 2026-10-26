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
import {
  Button,
  Dialog,
  Modal,
  ModalOverlay,
} from '@openmetadata/ui-core-components';
import { GridDotsOuter } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomizeEntityType } from '../../../constants/Customize.constants';
import { Table } from '../../../generated/entity/data/table';
import { Type } from '../../../generated/entity/type';
import { getTypeByFQN } from '../../../rest/metadataTypeAPI';
import {
  convertCustomPropertyStringToEntityExtension,
  convertEntityExtensionToCustomPropertyString,
} from '../../../utils/CSV/CSVPureUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { CustomPropertyTable } from '../../common/CustomPropertyTable/CustomPropertyTable';
import { ExtentionEntities } from '../../common/CustomPropertyTable/CustomPropertyTable.interface';
import NoDataPlaceholder from '../../common/EmptyPlaceholder/NoDataPlaceholder';
import { KeyDownStopPropagationWrapper } from '../../common/KeyDownStopPropagationWrapper/KeyDownStopPropagationWrapper';
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
  // The value as the editor would save it untouched, so formatting differences
  // in the incoming CSV string don't count as an edit.
  const [initialValue, setInitialValue] = useState<string>();

  const fetchTypeDetail = async () => {
    setIsLoading(true);
    try {
      const response = await getTypeByFQN(entityType);
      const extension = convertCustomPropertyStringToEntityExtension(
        value ?? '',
        response
      );
      setCustomPropertyEntityRecord(response);
      setExtensionObject(extension);
      setInitialValue(
        convertEntityExtensionToCustomPropertyString(extension, response)
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

  const hasCustomProperties = !isEmpty(
    customPropertyEntityRecord?.customProperties
  );

  const isDirty = useMemo(
    () =>
      convertEntityExtensionToCustomPropertyString(
        extensionObject,
        customPropertyEntityRecord
      ) !== initialValue,
    [extensionObject, customPropertyEntityRecord, initialValue]
  );

  return (
    <ModalOverlay
      isDismissable={false}
      isOpen={visible}
      onOpenChange={(isOpen) => !isOpen && onCancel?.()}>
      <Modal>
        <Dialog
          showCloseButton
          data-testid="custom-property-editor"
          dividers="scroll"
          title={header}
          width={650}
          onClose={() => onCancel?.()}>
          <Dialog.Content>
            <KeyDownStopPropagationWrapper>
              {isLoading && <Loader />}
              {/* Only a loaded type can be empty; a failed load already showed a toast. */}
              {!isLoading &&
                customPropertyEntityRecord &&
                !hasCustomProperties && (
                  // The placeholder fills its nearest positioned ancestor.
                  <div className="tw:relative tw:min-h-60">
                    <NoDataPlaceholder
                      description={t('message.no-custom-properties-defined')}
                      icon={<GridDotsOuter />}
                      title={t('label.no-custom-properties-defined')}
                    />
                  </div>
                )}
              {!isLoading && hasCustomProperties && (
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
            </KeyDownStopPropagationWrapper>
          </Dialog.Content>
          <Dialog.Footer>
            <KeyDownStopPropagationWrapper className="tw:flex tw:gap-3">
              <Button
                color="secondary"
                data-testid="cancel"
                isDisabled={isSaveLoading}
                key="cancelButton"
                onClick={onCancel}>
                {t('label.cancel')}
              </Button>
              <Button
                color="primary"
                data-testid="save"
                isDisabled={isLoading || !hasCustomProperties || !isDirty}
                isLoading={isSaveLoading}
                key="saveButton"
                onClick={handleSaveData}>
                {t('label.save')}
              </Button>
            </KeyDownStopPropagationWrapper>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
