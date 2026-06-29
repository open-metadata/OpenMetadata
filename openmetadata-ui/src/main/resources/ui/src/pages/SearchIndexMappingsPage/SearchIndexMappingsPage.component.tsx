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
import { Alert, Button, Card, Col, Empty, Row, Select, Space, Tag } from 'antd';
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
import './search-index-mappings-page.less';
import { SelectOption } from './SearchIndexMappingsPage.interface';

const DEFAULT_LANGUAGE = 'en';

/**
 * Admin page to view and edit the per-language, per-entity Elasticsearch/
 * OpenSearch index mappings stored in settings. Saving only persists the
 * mapping; the change applies on the next reindex of that entity. A reindex
 * trigger is intentionally omitted here — the info banner instructs the admin
 * to reindex after saving.
 */
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
        label: language.toUpperCase(),
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

  const hasMappings = !isEmpty(mappingsList);
  const isEntitySelected =
    !isEmpty(selectedLanguage) && !isEmpty(selectedEntityType);
  const isActionDisabled = isMappingLoading || !isEntitySelected;

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

  const handleFormat = () => {
    try {
      setEditorValue(
        JSON.stringify(JSON.parse(editorValue), null, JSON_TAB_SIZE)
      );
    } catch (error) {
      showErrorToast(t('message.invalid-json-mapping'));
    }
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
    if (isEntitySelected) {
      fetchMapping(selectedLanguage, selectedEntityType);
    }
  }, [selectedLanguage, selectedEntityType]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1 pageTitle={t('label.search-mapping-plural')}>
      <div
        className="search-index-mappings-page"
        data-testid="search-index-mappings-page">
        <TitleBreadcrumb titleLinks={breadcrumbs} />

        <div className="d-flex justify-between items-start flex-wrap gap-4 search-index-mappings-page__header">
          <PageHeader
            data={{
              header: t(PAGE_HEADERS.SEARCH_INDEX_MAPPINGS.header),
              subHeader: t(PAGE_HEADERS.SEARCH_INDEX_MAPPINGS.subHeader),
            }}
          />
          <Space size={12}>
            <Button
              data-testid="reset-mapping-btn"
              disabled={isActionDisabled || isSaving}
              loading={isResetting}
              onClick={handleReset}>
              {t('label.reset-to-default')}
            </Button>
            <Button
              data-testid="save-mapping-btn"
              disabled={isActionDisabled || isResetting}
              loading={isSaving}
              type="primary"
              onClick={handleSave}>
              {t('label.save')}
            </Button>
          </Space>
        </div>

        <Alert
          showIcon
          className="m-t-md"
          data-testid="reindex-info-banner"
          message={t('message.search-index-mappings-reindex-info')}
          type="info"
        />

        <Card
          className="m-t-md search-index-mappings-page__toolbar"
          data-testid="mapping-selectors">
          <Row gutter={[16, 16]}>
            <Col lg={6} md={8} xs={24}>
              <label
                className="d-block m-b-xs text-grey-muted"
                htmlFor="language-select">
                {t('label.language')}
              </label>
              <Select
                className="w-full"
                data-testid="language-select"
                id="language-select"
                options={languageOptions}
                value={selectedLanguage || undefined}
                onChange={handleLanguageChange}
              />
            </Col>
            <Col lg={6} md={8} xs={24}>
              <label
                className="d-block m-b-xs text-grey-muted"
                htmlFor="entity-type-select">
                {t('label.entity-type')}
              </label>
              <Select
                showSearch
                className="w-full"
                data-testid="entity-type-select"
                id="entity-type-select"
                options={entityTypeOptions}
                value={selectedEntityType || undefined}
                onChange={setSelectedEntityType}
              />
            </Col>
          </Row>
        </Card>

        <Card
          className="m-t-md search-index-mappings-page__editor-card"
          data-testid="mapping-editor-card"
          extra={
            <Button
              data-testid="format-mapping-btn"
              disabled={isActionDisabled}
              size="small"
              type="text"
              onClick={handleFormat}>
              {t('label.format')}
            </Button>
          }
          title={
            <Space size={8}>
              <span>{selectedEntityType || '--'}</span>
              {selectedLanguage ? (
                <Tag className="m-r-0">{selectedLanguage.toUpperCase()}</Tag>
              ) : null}
            </Space>
          }>
          {!hasMappings || !isEntitySelected ? (
            <Empty
              className="search-index-mappings-page__empty"
              description={t('message.no-data-available')}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : isMappingLoading ? (
            <div className="search-index-mappings-page__editor-loader">
              <Loader size="small" />
            </div>
          ) : (
            <SchemaEditor
              className="search-index-mappings-page__editor"
              mode={{ name: CSMode.JAVASCRIPT, json: true }}
              value={editorValue}
              onChange={setEditorValue}
            />
          )}
        </Card>
      </div>
    </PageLayoutV1>
  );
};

export default SearchIndexMappingsPage;
