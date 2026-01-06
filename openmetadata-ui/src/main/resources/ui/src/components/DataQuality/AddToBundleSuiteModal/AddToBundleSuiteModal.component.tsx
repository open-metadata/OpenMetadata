/*
 *  Copyright 2025 Collate.
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

import { Button, Form, Modal, Radio, Select, Space, Typography } from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { AxiosError } from 'axios';
import { debounce } from 'lodash';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { WILD_CARD_CHAR } from '../../../constants/char.constants';
import { PAGE_SIZE_MEDIUM } from '../../../constants/constants';
import { TestSuiteType } from '../../../enums/TestSuite.enum';
import { TestSuite } from '../../../generated/tests/testSuite';
import {
  addTestCaseToLogicalTestSuite,
  getListTestSuitesBySearch,
} from '../../../rest/testAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { getPopupContainer } from '../../../utils/formUtils';
import { getTestSuitePath } from '../../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { AddToBundleSuiteModalProps } from './AddToBundleSuiteModal.interface';

type FormData = {
  mode: 'existing' | 'new';
  testSuiteId?: string;
};

export const AddToBundleSuiteModal = ({
  visible,
  testCases,
  onCancel,
  onSuccess,
}: AddToBundleSuiteModalProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form] = useForm<FormData>();
  const [isLoading, setIsLoading] = useState(false);
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [isLoadingTestSuites, setIsLoadingTestSuites] = useState(false);
  const mode = Form.useWatch('mode', form);

  const fetchTestSuites = useCallback(async (searchValue = '') => {
    setIsLoadingTestSuites(true);
    try {
      const searchQuery = searchValue ? `*${searchValue}*` : WILD_CARD_CHAR;
      const response = await getListTestSuitesBySearch({
        q: searchQuery,
        testSuiteType: TestSuiteType.logical,
        limit: PAGE_SIZE_MEDIUM,
      });
      setTestSuites(response.data);
    } catch (error) {
      showErrorToast(error as AxiosError);
      setTestSuites([]);
    } finally {
      setIsLoadingTestSuites(false);
    }
  }, []);

  const debouncedFetchTestSuites = useCallback(
    debounce((value: string) => fetchTestSuites(value), 500),
    [fetchTestSuites]
  );

  useEffect(() => {
    if (visible) {
      form.setFieldsValue({ mode: 'existing' });
      fetchTestSuites();
    }
  }, [visible, form, fetchTestSuites]);

  const handleSubmit = async (values: FormData) => {
    if (values.mode === 'existing' && !values.testSuiteId) {
      return;
    }

    setIsLoading(true);
    try {
      if (values.mode === 'existing') {
        const testCaseIds = testCases
          .map((tc) => tc.id)
          .filter((id): id is string => Boolean(id));

        await addTestCaseToLogicalTestSuite({
          testCaseIds,
          testSuiteId: values.testSuiteId!,
        });

        showSuccessToast(
          t('server.entity-added-successfully', {
            entity: t('label.test-case-plural'),
          })
        );
        onSuccess();
      } else {
        // Navigate to create new bundle suite page with pre-selected test cases
        onCancel();
        // Store selected test case IDs in session storage for the new bundle suite form
        sessionStorage.setItem(
          'preselectedTestCases',
          JSON.stringify(testCases.map((tc) => tc.id))
        );
        navigate('/data-quality/test-suites?action=create');
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      destroyOnClose
      cancelButtonProps={{ disabled: isLoading }}
      okButtonProps={{ loading: isLoading, form: 'add-to-bundle-suite-form' }}
      okText={mode === 'new' ? t('label.create') : t('label.add')}
      open={visible}
      title={`Add Test Cases to Bundle Suite`}
      onCancel={onCancel}
      onOk={() => form.submit()}>
      <Form<FormData>
        form={form}
        id="add-to-bundle-suite-form"
        layout="vertical"
        onFinish={handleSubmit}>
        <Typography.Paragraph className="text-grey-muted">
          {testCases.length} {t('label.test-case-plural')}{' '}
          {t('label.selected-lowercase')}
        </Typography.Paragraph>

        <Form.Item
          label={t('label.select-field', { field: t('label.option') })}
          name="mode"
          rules={[{ required: true }]}>
          <Radio.Group>
            <Space direction="vertical">
              <Radio value="existing">Use existing Bundle Suite</Radio>
              <Radio value="new">Create new Bundle Suite</Radio>
            </Space>
          </Radio.Group>
        </Form.Item>

        {mode === 'existing' && (
          <Form.Item
            label={t('label.bundle-suite')}
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
              showSearch
              data-testid="test-suite-select"
              filterOption={false}
              getPopupContainer={getPopupContainer}
              loading={isLoadingTestSuites}
              placeholder={t('label.search-entity', {
                entity: t('label.bundle-suite'),
              })}
              onSearch={debouncedFetchTestSuites}>
              {testSuites.map((suite) => (
                <Select.Option key={suite.id} value={suite.id}>
                  <Space direction="vertical" size={0}>
                    <Typography.Text>{getEntityName(suite)}</Typography.Text>
                    <Typography.Text className="text-xs text-grey-muted">
                      {suite.fullyQualifiedName}
                    </Typography.Text>
                  </Space>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        )}

        {mode === 'new' && (
          <Typography.Paragraph className="text-grey-muted m-t-sm">
            You will be redirected to create a new Bundle Suite with the
            selected test cases.
          </Typography.Paragraph>
        )}
      </Form>
    </Modal>
  );
};
