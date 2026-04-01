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
} from '@openmetadata/ui-core-components';
import { Select } from 'antd';
import { AxiosError } from 'axios';
import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { WILD_CARD_CHAR } from '../../../constants/char.constants';
import { PAGE_SIZE_BASE } from '../../../constants/constants';
import { TestSuiteType } from '../../../enums/TestSuite.enum';
import { TestSuite } from '../../../generated/tests/testSuite';
import {
  addTestCasesToLogicalTestSuiteBulk,
  getListTestSuitesBySearch,
} from '../../../rest/testAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { getPopupContainer } from '../../../utils/formUtils';
import { getTestSuitePath } from '../../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { AddToBundleSuiteModalProps } from './AddToBundleSuiteModal.interface';

const AddToBundleSuiteModal: React.FC<AddToBundleSuiteModalProps> = ({
  open,
  selectedTestCases,
  onCancel,
  onAddedToExisting,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selectedSuiteId, setSelectedSuiteId] = useState<string | undefined>(
    undefined
  );
  const [options, setOptions] = useState<
    { label: string; value: string; suite: TestSuite }[]
  >([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selectedIds = useMemo(
    () =>
      selectedTestCases
        .map((tc) => tc.id)
        .filter((id): id is string => Boolean(id)),
    [selectedTestCases]
  );

  const fetchLogicalSuites = useCallback(async (searchText: string) => {
    setOptionsLoading(true);
    try {
      const result = await getListTestSuitesBySearch({
        q: searchText ? `*${searchText}*` : WILD_CARD_CHAR,
        limit: PAGE_SIZE_BASE,
        testSuiteType: TestSuiteType.logical,
        includeEmptyTestSuites: true,
      });
      setOptions(
        result.data.map((ts: TestSuite) => ({
          label: getEntityName(ts),
          value: ts.id ?? '',
          suite: ts,
        }))
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
      setOptions([]);
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  const debouncedSearch = useMemo(
    () => debounce((value: string) => fetchLogicalSuites(value), 400),
    [fetchLogicalSuites]
  );

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  useEffect(() => {
    if (open) {
      setSelectedSuiteId(undefined);
      fetchLogicalSuites('');
    }
  }, [open, fetchLogicalSuites]);

  const handleOk = async () => {
    if (selectedIds.length === 0) {
      onCancel();

      return;
    }

    if (!selectedSuiteId) {
      return;
    }

    try {
      setSubmitting(true);
      await addTestCasesToLogicalTestSuiteBulk(selectedSuiteId, {
        selectAll: false,
        includeIds: selectedIds,
        excludeIds: [],
      });
      showSuccessToast(t('message.test-cases-added-to-bundle-suite'));

      const selectedSuite = options.find(
        (opt) => opt.value === selectedSuiteId
      );
      if (selectedSuite?.suite.fullyQualifiedName) {
        navigate(getTestSuitePath(selectedSuite.suite.fullyQualifiedName));
      }

      onAddedToExisting();
      onCancel();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalOverlay isDismissable isOpen={open} onOpenChange={onCancel}>
      <Modal>
        <Dialog
          showCloseButton
          title={t('label.add-test-cases-to-bundle-suite')}
          onClose={onCancel}>
          <Dialog.Content className="tw:min-h-45">
            <Select
              allowClear
              showSearch
              className="w-full"
              data-testid="bundle-suite-select"
              disabled={submitting}
              filterOption={false}
              getPopupContainer={getPopupContainer}
              listHeight={150}
              loading={optionsLoading}
              options={options}
              placeholder={t('label.select-field', {
                field: t('label.bundle-suite'),
              })}
              value={selectedSuiteId}
              onChange={(value) => setSelectedSuiteId(value)}
              onSearch={(value) => debouncedSearch(value)}
            />
          </Dialog.Content>
          <Dialog.Footer>
            <div className="tw:col-span-2 tw:flex tw:justify-end tw:gap-3">
              <Button
                color="secondary"
                data-testid="cancel-button"
                disabled={submitting}
                onPress={onCancel}>
                {t('label.cancel')}
              </Button>
              <Button
                color="primary"
                data-testid="add-button"
                isDisabled={
                  !selectedSuiteId || selectedIds.length === 0 || submitting
                }
                isLoading={submitting}
                onPress={handleOk}>
                {t('label.add')}
              </Button>
            </div>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default AddToBundleSuiteModal;
