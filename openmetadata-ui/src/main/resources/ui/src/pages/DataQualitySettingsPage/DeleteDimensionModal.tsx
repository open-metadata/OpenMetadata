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
import { Typography } from '@openmetadata/ui-core-components';
import { isUndefined } from 'lodash';
import { useTranslation } from 'react-i18next';
import DeleteModal from '../../components/common/DeleteModal/DeleteModal';
import { DataQualityDimension } from '../../generated/tests/dataQualityDimension';
import { getEntityName } from '../../utils/EntityNameUtils';

export interface DeleteDimensionModalProps {
  /** The dimension pending deletion; `undefined` keeps the modal closed. */
  dimension?: DataQualityDimension;
  /**
   * Test cases that reference it — they lose the dimension when it goes. `undefined` means the
   * count could not be fetched, which is reported as unknown rather than as none.
   */
  testCaseCount?: number;
  /** Test definitions classified with it — these are cleared too, so they are called out. */
  testDefinitionCount?: number;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const DeleteDimensionModal = ({
  dimension,
  testCaseCount,
  testDefinitionCount,
  isDeleting,
  onCancel,
  onConfirm,
}: DeleteDimensionModalProps) => {
  const { t } = useTranslation();

  if (!dimension) {
    return null;
  }

  // A count that failed to load must not read as "nothing is affected": the impact is unknown,
  // and on a destructive action that is worth saying out loud.
  const isImpactUnknown =
    isUndefined(testCaseCount) || isUndefined(testDefinitionCount);
  const hasReferences = Boolean(testCaseCount) || Boolean(testDefinitionCount);

  // Composed of inline elements only: the shared modal renders the message inside a <p>.
  const message = (
    <>
      <span>{t('message.delete-dimension-confirmation')}</span>
      {(isImpactUnknown || hasReferences) && (
        <span className="dimension-delete-warning">
          {isImpactUnknown && (
            <Typography as="span" size="text-sm">
              {t('message.dimension-impact-unknown')}
            </Typography>
          )}
          {Boolean(testCaseCount) && (
            <span className="dimension-delete-impact">
              <Typography as="span" size="text-sm" weight="semibold">
                {t('message.dimension-in-use-count', { count: testCaseCount })}
              </Typography>
              <Typography as="span" size="text-sm">
                {t('message.dimension-delete-fallback')}
              </Typography>
            </span>
          )}
          {Boolean(testDefinitionCount) && (
            <span className="dimension-delete-impact">
              <Typography as="span" size="text-sm" weight="semibold">
                {t('message.dimension-in-use-test-definition-count', {
                  count: testDefinitionCount,
                })}
              </Typography>
              <Typography as="span" size="text-sm">
                {t('message.dimension-delete-test-definition-fallback')}
              </Typography>
            </span>
          )}
        </span>
      )}
    </>
  );

  return (
    <DeleteModal
      open
      entityTitle={getEntityName(dimension)}
      isDeleting={isDeleting}
      message={message}
      onCancel={onCancel}
      onDelete={onConfirm}
    />
  );
};

export default DeleteDimensionModal;
