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
import {
  Alert,
  Badge,
  Button,
  Card,
  Select,
  SelectItemType,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import HeaderBreadcrumb from '../../components/common/HeaderBreadcrumb/HeaderBreadcrumb.component';
import Loader from '../../components/common/Loader/Loader';
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

  const breadcrumbs = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.PREFERENCES,
        t('label.search-mapping-plural')
      ).map((link) => ({ href: link.url, label: link.name })),
    [t]
  );

  const languageItems: SelectItemType[] = useMemo(
    () =>
      Object.keys(mappingsList).map((language) => ({
        id: language,
        label: language.toUpperCase(),
      })),
    [mappingsList]
  );

  const entityTypeItems: SelectItemType[] = useMemo(
    () =>
      (mappingsList[selectedLanguage] ?? []).map((entityType) => ({
        id: entityType,
        label: entityType,
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
        <HeaderBreadcrumb items={breadcrumbs} />

        <div className="tw:flex tw:items-start tw:justify-between tw:flex-wrap tw:gap-4 tw:mt-3">
          <PageHeader
            data={{
              header: t(PAGE_HEADERS.SEARCH_INDEX_MAPPINGS.header),
              subHeader: t(PAGE_HEADERS.SEARCH_INDEX_MAPPINGS.subHeader),
            }}
          />
          <div className="tw:flex tw:gap-3">
            <Button
              color="secondary"
              data-testid="reset-mapping-btn"
              isDisabled={isActionDisabled || isSaving}
              isLoading={isResetting}
              onPress={handleReset}>
              {t('label.reset-to-default')}
            </Button>
            <Button
              color="primary"
              data-testid="save-mapping-btn"
              isDisabled={isActionDisabled || isResetting}
              isLoading={isSaving}
              onPress={handleSave}>
              {t('label.save')}
            </Button>
          </div>
        </div>

        <Alert
          className="tw:mt-4"
          title={t('message.search-index-mappings-reindex-info')}
          variant="brand"
        />

        <Card className="tw:mt-4">
          <Card.Content>
            <div className="tw:flex tw:flex-wrap tw:gap-4">
              <Select
                className="tw:w-60"
                items={languageItems}
                label={t('label.language')}
                placeholder={t('label.language')}
                selectedKey={selectedLanguage || null}
                onSelectionChange={(key) =>
                  key != null && handleLanguageChange(String(key))
                }>
                {(item) => (
                  <Select.Item
                    id={item.id}
                    key={item.id}
                    textValue={item.label}>
                    {item.label}
                  </Select.Item>
                )}
              </Select>
              <Select
                className="tw:w-60"
                items={entityTypeItems}
                label={t('label.entity-type')}
                placeholder={t('label.entity-type')}
                selectedKey={selectedEntityType || null}
                onSelectionChange={(key) =>
                  key != null && setSelectedEntityType(String(key))
                }>
                {(item) => (
                  <Select.Item
                    id={item.id}
                    key={item.id}
                    textValue={item.label}>
                    {item.label}
                  </Select.Item>
                )}
              </Select>
            </div>
          </Card.Content>
        </Card>

        <Card className="tw:mt-4 search-index-mappings-page__editor-card">
          <Card.Header
            extra={
              <Button
                color="link-gray"
                data-testid="format-mapping-btn"
                isDisabled={isActionDisabled}
                size="sm"
                onPress={handleFormat}>
                {t('label.format')}
              </Button>
            }
            title={
              <div className="tw:flex tw:items-center tw:gap-2">
                <span>{selectedEntityType || '--'}</span>
                {selectedLanguage ? (
                  <Badge color="gray" size="sm" type="pill-color">
                    {selectedLanguage.toUpperCase()}
                  </Badge>
                ) : null}
              </div>
            }
          />
          <Card.Content className="tw:p-0">
            {!hasMappings || !isEntitySelected ? (
              <div className="search-index-mappings-page__empty">
                {t('message.no-data-available')}
              </div>
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
          </Card.Content>
        </Card>
      </div>
    </PageLayoutV1>
  );
};

export default SearchIndexMappingsPage;
