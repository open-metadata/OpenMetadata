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

import {
  Button,
  Dialog,
  Divider,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import { Utils as QbUtils } from '@react-awesome-query-builder/ui';
import { FunctionComponent, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../enums/entity.enum';
import QueryBuilder from '../common/QueryBuilder/QueryBuilder';
import { useAdvanceSearch } from './AdvanceSearchProvider/AdvanceSearchProvider.component';

interface Props {
  visible: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}

export const AdvancedSearchModal: FunctionComponent<Props> = ({
  visible,
  onSubmit,
  onCancel,
}: Props) => {
  const { t } = useTranslation();
  const { config, treeInternal, onTreeUpdate, onReset, modalProps } =
    useAdvanceSearch();

  // The provider holds an ImmutableTree; the builder takes a plain JsonTree.
  const treeJson = useMemo(() => QbUtils.getTree(treeInternal), [treeInternal]);

  return (
    <ModalOverlay
      isOpen={visible}
      onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <Modal data-testid="advanced-search-modal">
        <Dialog showCloseButton width={1080} onClose={onCancel}>
          <Dialog.Header
            className="tw:pr-12 tw:pb-5"
            title={
              modalProps?.title ??
              t('label.advanced-entity', {
                entity: t('label.search'),
              })
            }>
            <Typography
              as="p"
              className="tw:text-secondary"
              data-testid="advanced-search-message"
              size="text-sm">
              {modalProps?.subTitle ?? t('message.advanced-search-message')}
            </Typography>
          </Dialog.Header>

          <Divider />

          <Dialog.Content>
            <QueryBuilder
              conjunctionMode="editable"
              entityType={EntityType.ALL}
              fields={config.fields}
              groupMode="nested"
              showCountPreview={false}
              tree={treeJson}
              onChange={(_value, nextTree) =>
                nextTree && onTreeUpdate(QbUtils.loadTree(nextTree), config)
              }
            />
          </Dialog.Content>

          <Dialog.Footer>
            <Button
              className="tw:mr-auto"
              color="secondary"
              data-testid="reset-btn"
              size="sm"
              onPress={onReset}>
              {t('label.reset')}
            </Button>
            <Button
              color="secondary"
              data-testid="cancel-btn"
              onPress={onCancel}>
              {t('label.cancel')}
            </Button>
            <Button color="primary" data-testid="apply-btn" onPress={onSubmit}>
              {t('label.apply')}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
