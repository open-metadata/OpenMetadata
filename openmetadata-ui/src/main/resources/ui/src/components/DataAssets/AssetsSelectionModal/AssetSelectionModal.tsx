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
import { Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import { AssetsOfEntity } from '../../Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import './asset-selection-model.style.less';
import { AssetSelectionModalProps } from './AssetSelectionModal.interface';
import { useAssetSelectionContent } from './useAssetSelectionContent';

export const AssetSelectionModal = ({
  entityFqn,
  onCancel,
  onSave,
  open,
  type = AssetsOfEntity.GLOSSARY,
  queryFilter,
  emptyPlaceHolderText,
}: AssetSelectionModalProps) => {
  const { t } = useTranslation();

  const { content, footer } = useAssetSelectionContent({
    entityFqn,
    onCancel,
    onSave,
    open,
    type,
    variant: 'modal',
    queryFilter,
    emptyPlaceHolderText,
  });

  return (
    <Modal
      centered
      destroyOnClose
      className="asset-selection-modal"
      closable={false}
      closeIcon={null}
      data-testid="asset-selection-modal"
      footer={footer}
      open={open}
      title={t('label.add-entity', { entity: t('label.asset-plural') })}
      width={675}
      onCancel={onCancel}>
      {content}
    </Modal>
  );
};
