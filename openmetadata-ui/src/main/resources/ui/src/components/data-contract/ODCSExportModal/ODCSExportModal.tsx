/*
 *  Copyright 2026 Collate.
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
  Select,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_ODCS_EXPORT_VERSION,
  ODCSExportVersion,
  ODCS_EXPORT_VERSIONS,
} from '../../../constants/DataContract.constants';
import { exportContractToODCSYaml } from '../../../rest/contractAPI';
import { downloadContractAsODCSYaml } from '../../../utils/DataContract/DataContractUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';

interface ODCSExportModalProps {
  contractId: string;
  contractName: string;
  onClose: () => void;
}

export const ODCSExportModal = ({
  contractId,
  contractName,
  onClose,
}: ODCSExportModalProps) => {
  const { t } = useTranslation();
  const [version, setVersion] = useState<ODCSExportVersion>(
    DEFAULT_ODCS_EXPORT_VERSION
  );
  const [isExporting, setIsExporting] = useState(false);

  const handleClose = () => {
    if (!isExporting) {
      onClose();
    }
  };

  const handleExport = async () => {
    if (isExporting) {
      return;
    }

    setIsExporting(true);
    try {
      const yaml = await exportContractToODCSYaml(
        contractId,
        undefined,
        version
      );
      downloadContractAsODCSYaml(yaml, contractName);
      showSuccessToast(
        t('message.entity-exported-successfully', {
          entity: t('label.odcs-contract'),
        })
      );
      onClose();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <ModalOverlay
      isOpen
      isDismissable={!isExporting}
      isKeyboardDismissDisabled={isExporting}
      onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <Modal>
        <Dialog
          showCloseButton
          data-testid="odcs-export-modal"
          dividers="scroll"
          title={t('label.export-odcs')}
          onClose={handleClose}>
          <Dialog.Content>
            <Select
              data-testid="odcs-export-version"
              isDisabled={isExporting}
              label={t('label.version')}
              name="odcsVersion"
              selectedKey={version}
              onSelectionChange={(key) => {
                const selected = ODCS_EXPORT_VERSIONS.find(
                  (item) => item === key
                );
                if (selected) {
                  setVersion(selected);
                }
              }}>
              {ODCS_EXPORT_VERSIONS.map((item) => (
                <Select.Item id={item} key={item} label={item} />
              ))}
            </Select>
          </Dialog.Content>
          <Dialog.Footer>
            <Button
              color="secondary"
              isDisabled={isExporting}
              onPress={handleClose}>
              {t('label.cancel')}
            </Button>
            <Button
              data-testid="confirm-odcs-export"
              isDisabled={isExporting}
              isLoading={isExporting}
              onPress={handleExport}>
              {t('label.export')}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
