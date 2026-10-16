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
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DATA_PRODUCT_TYPE_LABEL_KEYS,
  PORTFOLIO_PRIORITY_LABEL_KEYS,
  VISIBILITY_LABEL_KEYS,
} from '../../../constants/DataProduct.constants';
import {
  DataProductType,
  PortfolioPriority,
  Visibility,
} from '../../../generated/entity/domains/dataProduct';
import { DataProductMetadataModalProps } from './DataProductMetadataModal.interface';

// react-aria Select treats an empty string key as "no selection" (matches the
// undefined-means-unset semantics of our DataProduct fields).
const NONE = '';

const DataProductMetadataModal = ({
  open,
  dataProduct,
  onCancel,
  onSubmit,
}: DataProductMetadataModalProps) => {
  const { t } = useTranslation();
  const [dataProductType, setDataProductType] = useState<string>(NONE);
  const [visibility, setVisibility] = useState<string>(NONE);
  const [portfolioPriority, setPortfolioPriority] = useState<string>(NONE);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setDataProductType(dataProduct.dataProductType ?? NONE);
      setVisibility(dataProduct.visibility ?? NONE);
      setPortfolioPriority(dataProduct.portfolioPriority ?? NONE);
      setSubmitting(false);
    }
  }, [open, dataProduct]);

  const handleSave = async () => {
    try {
      setSubmitting(true);
      await onSubmit({
        dataProductType: dataProductType
          ? (dataProductType as DataProductType)
          : undefined,
        visibility: visibility ? (visibility as Visibility) : undefined,
        portfolioPriority: portfolioPriority
          ? (portfolioPriority as PortfolioPriority)
          : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const dataProductTypeItems = [
    { id: NONE, label: t('label.none') },
    ...Object.values(DataProductType).map((v) => ({
      id: v,
      label: t(DATA_PRODUCT_TYPE_LABEL_KEYS[v]),
    })),
  ];

  const visibilityItems = [
    { id: NONE, label: t('label.none') },
    ...Object.values(Visibility).map((v) => ({
      id: v,
      label: t(VISIBILITY_LABEL_KEYS[v]),
    })),
  ];

  const portfolioPriorityItems = [
    { id: NONE, label: t('label.none') },
    ...Object.values(PortfolioPriority).map((v) => ({
      id: v,
      label: t(PORTFOLIO_PRIORITY_LABEL_KEYS[v]),
    })),
  ];

  return (
    <ModalOverlay
      isDismissable={!submitting}
      isOpen={open}
      onOpenChange={(isOpen) => !isOpen && !submitting && onCancel()}>
      <Modal>
        <Dialog
          showCloseButton
          data-testid="data-product-metadata-modal"
          title={t('label.edit-entity', { entity: t('label.data-product') })}
          width={520}
          onClose={onCancel}>
          <Dialog.Content>
            <div className="tw:flex tw:flex-col tw:gap-4">
              <Select
                data-testid="type-select"
                label={t('label.type')}
                value={dataProductType}
                onChange={(key) => setDataProductType(String(key ?? ''))}>
                {dataProductTypeItems.map((opt) => (
                  <Select.Item id={opt.id} key={opt.id} label={opt.label} />
                ))}
              </Select>
              <Select
                data-testid="visibility-select"
                label={t('label.visibility')}
                value={visibility}
                onChange={(key) => setVisibility(String(key ?? ''))}>
                {visibilityItems.map((opt) => (
                  <Select.Item id={opt.id} key={opt.id} label={opt.label} />
                ))}
              </Select>
              <Select
                data-testid="priority-select"
                label={t('label.portfolio-priority')}
                value={portfolioPriority}
                onChange={(key) => setPortfolioPriority(String(key ?? ''))}>
                {portfolioPriorityItems.map((opt) => (
                  <Select.Item id={opt.id} key={opt.id} label={opt.label} />
                ))}
              </Select>
            </div>
          </Dialog.Content>
          <Dialog.Footer>
            <div className="tw:col-span-2 tw:flex tw:justify-end tw:gap-3">
              <Button
                color="tertiary"
                data-testid="metadata-modal-cancel"
                isDisabled={submitting}
                size="sm"
                onPress={onCancel}>
                {t('label.cancel')}
              </Button>
              <Button
                color="primary"
                data-testid="metadata-modal-save"
                isLoading={submitting}
                size="sm"
                onPress={handleSave}>
                {t('label.save')}
              </Button>
            </div>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default DataProductMetadataModal;
