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
import { Alert, Button, Col, Row, Select, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Loader from '../../components/common/Loader/Loader';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import SchemaEditor from '../../components/Database/SchemaEditor/SchemaEditor';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { JSON_TAB_SIZE } from '../../constants/constants';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import { CSMode } from '../../enums/codemirror.enum';
import {
  getSearchIndexMapping,
  getSearchIndexMappingsList,
  resetSearchIndexMapping,
  SearchIndexMapping,
  SearchIndexMappingsList,
  updateSearchIndexMapping,
} from '../../rest/settingConfigAPI';
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { SelectOption } from './SearchIndexMappingsPage.interface';

const DEFAULT_LANGUAGE = 'en';

// Saving only persists the mapping in DB settings; the change applies on the
// next reindex of that entity. A reindex trigger is intentionally omitted for
// this iteration — the banner instructs the admin to reindex.
const SearchIndexMappingsPage = () => {
  const { t } = useTranslation();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isMappingLoading, setIsMappingLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [mappingsList, setMappingsList] = useState<SearchIndexMappingsList>({});
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [selectedEntityType, setSelectedEntityType] = useState<string>('');
  const [editorValue, setEditorValue] = useState<string>('');

  const breadcrumbs: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.PREFERENCES,
        t('label.search-mapping-plural')
      ),
    [t]
  );

  const languageOptions: SelectOption[] = useMemo(
    () =>
      Object.keys(mappingsList).map((language) => ({
        label: language,
        value: language,
      })),
    [mappingsList]
  );

  const entityTypeOptions: SelectOption[] = useMemo(
    () =>
      (mappingsList[selectedLanguage] ?? []).map((entityType) => ({
        label: entityType,
        value: entityType,
      })),
    [mappingsList, selectedLanguage]
  );

  const fetchMappingsList = async () => {
    try {
      setIsLoading(true);
      const data = await getSearchIndexMappingsList();
      setMappingsList(data);

      const languages = Object.keys(data);
      const defaultLanguage = languages.includes(DEFAULT_LANGUAGE)
        ? DEFAULT_LANGUAGE
        : languages[0] ?? '';
      setSelectedLanguage(defaultLanguage);
      setSelectedEntityType(data[defaultLanguage]?.[0] ?? '');
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMapping = async (language: string, entityType: string) => {
    try {
      setIsMappingLoading(true);
      const mapping = await getSearchIndexMapping(language, entityType);
      setEditorValue(JSON.stringify(mapping, null, JSON_TAB_SIZE));
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsMappingLoading(false);
    }
  };

  const handleLanguageChange = (language: string) => {
    setSelectedLanguage(language);
    setSelectedEntityType(mappingsList[language]?.[0] ?? '');
  };

  const handleSave = async () => {
    let parsedMapping: SearchIndexMapping | undefined;
    try {
      parsedMapping = JSON.parse(editorValue) as SearchIndexMapping;
    } catch (error) {
      showErrorToast(t('message.invalid-json-mapping'));
    }

    if (parsedMapping) {
      try {
        setIsSaving(true);
        await updateSearchIndexMapping(
          selectedLanguage,
          selectedEntityType,
          parsedMapping
        );
        showSuccessToast(
          t('server.update-entity-success', {
            entity: t('label.search-mapping-plural'),
          })
        );
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleReset = async () => {
    try {
      setIsResetting(true);
      await resetSearchIndexMapping(selectedLanguage, selectedEntityType);
      await fetchMapping(selectedLanguage, selectedEntityType);
      showSuccessToast(
        t('server.update-entity-success', {
          entity: t('label.search-mapping-plural'),
        })
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsResetting(false);
    }
  };

  useEffect(() => {
    fetchMappingsList();
  }, []);

  useEffect(() => {
    if (!isEmpty(selectedLanguage) && !isEmpty(selectedEntityType)) {
      fetchMapping(selectedLanguage, selectedEntityType);
    }
  }, [selectedLanguage, selectedEntityType]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1 pageTitle={t('label.search-mapping-plural')}>
      <Row className="p-md" gutter={[0, 16]}>
        <Col span={24}>
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </Col>
        <Col span={24}>
          <PageHeader
            data={{
              header: t(PAGE_HEADERS.SEARCH_INDEX_MAPPINGS.header),
              subHeader: t(PAGE_HEADERS.SEARCH_INDEX_MAPPINGS.subHeader),
            }}
          />
        </Col>
        <Col span={24}>
          <Alert
            showIcon
            data-testid="reindex-info-banner"
            message={t('message.search-index-mappings-reindex-info')}
            type="info"
          />
        </Col>
        <Col span={24}>
          <Space wrap size={16}>
            <Space direction="vertical" size={4}>
              <Typography.Text>{t('label.language')}</Typography.Text>
              <Select
                className="w-60"
                data-testid="language-select"
                options={languageOptions}
                value={selectedLanguage || undefined}
                onChange={handleLanguageChange}
              />
            </Space>
            <Space direction="vertical" size={4}>
              <Typography.Text>{t('label.entity-type')}</Typography.Text>
              <Select
                className="w-60"
                data-testid="entity-type-select"
                options={entityTypeOptions}
                value={selectedEntityType || undefined}
                onChange={setSelectedEntityType}
              />
            </Space>
          </Space>
        </Col>
        <Col span={24}>
          {isMappingLoading ? (
            <Loader />
          ) : (
            <SchemaEditor
              className="search-index-mapping-editor"
              mode={{ name: CSMode.JAVASCRIPT, json: true }}
              value={editorValue}
              onChange={setEditorValue}
            />
          )}
        </Col>
        <Col span={24}>
          <Space size={16}>
            <Button
              data-testid="save-mapping-btn"
              disabled={
                isMappingLoading || isEmpty(selectedEntityType) || isResetting
              }
              loading={isSaving}
              type="primary"
              onClick={handleSave}>
              {t('label.save')}
            </Button>
            <Button
              data-testid="reset-mapping-btn"
              disabled={
                isMappingLoading || isEmpty(selectedEntityType) || isSaving
              }
              loading={isResetting}
              onClick={handleReset}>
              {t('label.reset-to-default')}
            </Button>
          </Space>
        </Col>
      </Row>
    </PageLayoutV1>
  );
};

export default SearchIndexMappingsPage;
