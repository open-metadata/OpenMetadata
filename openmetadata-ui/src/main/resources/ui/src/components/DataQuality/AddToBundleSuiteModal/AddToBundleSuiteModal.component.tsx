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

import { Form, Modal, Select } from 'antd';
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
  const [form] = Form.useForm<{
    testSuiteId?: string;
  }>();
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
      form.setFieldsValue({ testSuiteId: undefined });
      fetchLogicalSuites('');
    }
  }, [open, form, fetchLogicalSuites]);

  const handleOk = async () => {
    if (selectedIds.length === 0) {
      onCancel();

      return;
    }

    try {
      const values = await form.validateFields(['testSuiteId']);
      const testSuiteId = values.testSuiteId;
      if (!testSuiteId) {
        return;
      }
      setSubmitting(true);
      await addTestCasesToLogicalTestSuiteBulk(testSuiteId, {
        selectAll: false,
        includeIds: selectedIds,
        excludeIds: [],
      });
      showSuccessToast(t('message.test-cases-added-to-bundle-suite'));

      const selectedSuite = options.find((opt) => opt.value === testSuiteId);
      if (selectedSuite?.suite.fullyQualifiedName) {
        navigate(getTestSuitePath(selectedSuite.suite.fullyQualifiedName));
      }

      onAddedToExisting();
      onCancel();
    } catch (error) {
      if ((error as { errorFields?: unknown }).errorFields) {
        return;
      }
      showErrorToast(error as AxiosError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      bodyStyle={{ minHeight: '175px' }}
      cancelText={t('label.cancel')}
      confirmLoading={submitting}
      okButtonProps={{ disabled: selectedIds.length === 0 }}
      okText={t('label.add')}
      open={open}
      title={t('label.add-test-cases-to-bundle-suite')}
      onCancel={onCancel}
      onOk={handleOk}>
      <Form form={form}>
        <Form.Item
          name="testSuiteId"
          rules={[
            {
              required: true,
              message: t('label.field-required', {
                field: t('label.bundle-suite'),
              }),
            },
          ]}>
          <Select
            allowClear
            showSearch
            className="w-full"
            filterOption={false}
            getPopupContainer={getPopupContainer}
            loading={optionsLoading}
            options={options}
            placeholder={t('label.select-field', {
              field: t('label.bundle-suite'),
            })}
            onSearch={(value) => debouncedSearch(value)}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddToBundleSuiteModal;
