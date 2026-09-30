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
  Box,
  Button,
  ButtonUtility,
  Card,
  Divider,
  Dropdown,
  Grid,
  RadioButton,
  RadioGroup,
  Select,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { Delete, Plus } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { isEmpty, isEqual, noop, omit } from 'lodash';
import { useState } from 'react';
import { Header, ListBoxSection } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { NavigationBlocker } from '../../../../components/common/NavigationBlocker/NavigationBlocker';
import { CustomizablePageHeader } from '../../../../components/MyData/CustomizableComponents/CustomizablePageHeader/CustomizablePageHeader';
import PageLayoutV1 from '../../../../components/PageLayoutV1/PageLayoutV1';
import {
  DEFAULT_LANDING_PAGE,
  DEFAULT_PAGE_VIEW_MODE,
  LANDING_PAGE_SECTIONS,
  PAGE_VIEW_MODE_LABEL_KEYS,
  ViewModePage,
  VIEW_MODE_PAGES,
} from '../../../../constants/platform/personaAppLayout.constants';
import {
  AppMode,
  DefaultViewModes,
  PageViewMode,
} from '../../../../generated/type/personaPreferences';
import {
  getPersonaPreferences,
  resolvePersonaLandingPage,
} from '../../../../utils/CustomizePage/PersonaPage.utils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import {
  PersonaAppLayoutPageProps,
  PreferenceRowProps,
} from './PersonaAppLayoutPage.types';

// A persona without an `appMode` forces nothing, so the tenant default
// applies. Radio values can't be `undefined`, so that choice travels as this
// sentinel and is dropped again on save.
const NO_DEFAULT_VALUE = 'null';

const APP_MODE_OPTIONS = [
  {
    value: NO_DEFAULT_VALUE,
    labelKey: 'label.no-default',
    hintKey: 'message.app-mode-no-default-hint',
  },
  {
    value: AppMode.Classic,
    labelKey: 'label.app-mode-classic',
    hintKey: 'message.app-mode-classic-hint',
  },
  {
    value: AppMode.AI,
    labelKey: 'label.app-mode-ai',
    hintKey: 'message.app-mode-ai-hint',
  },
];

const PreferenceRow = ({
  title,
  description,
  children,
}: PreferenceRowProps) => (
  <Card.Content className="tw:py-5">
    <Grid colGap="6" rowGap="4">
      <Grid.Item span={8}>
        <Box className="tw:gap-1.5" direction="col">
          <Typography
            as="h2"
            className="not-prose tw:m-0 tw:text-primary"
            size="text-sm"
            weight="semibold">
            {title}
          </Typography>
          <Typography
            as="p"
            className="not-prose tw:text-[13px] tw:leading-normal tw:text-tertiary">
            {description}
          </Typography>
        </Box>
      </Grid.Item>
      <Grid.Item span={16}>{children}</Grid.Item>
    </Grid>
  </Card.Content>
);

export const PersonaAppLayoutPage = ({
  personaDetails,
  personaDocument,
  onSave,
}: PersonaAppLayoutPageProps) => {
  const { t } = useTranslation();

  const persistedPreferences = getPersonaPreferences(
    personaDocument,
    personaDetails?.id
  );
  const persistedAppMode = persistedPreferences?.appMode ?? NO_DEFAULT_VALUE;
  const persistedViewModes: DefaultViewModes =
    persistedPreferences?.defaultViewModes ?? {};
  const persistedLandingPage = resolvePersonaLandingPage(
    personaDocument,
    personaDetails?.id
  );

  const [selectedMode, setSelectedMode] = useState<string>(persistedAppMode);
  const [landingPage, setLandingPage] = useState(persistedLandingPage);
  const [viewModes, setViewModes] = useState(persistedViewModes);

  const personaName = getEntityName(personaDetails);
  const configuredPages = VIEW_MODE_PAGES.filter(({ page }) => viewModes[page]);
  const addablePages = VIEW_MODE_PAGES.filter(({ page }) => !viewModes[page]);

  const disableSave =
    selectedMode === persistedAppMode &&
    landingPage === persistedLandingPage &&
    isEqual(viewModes, persistedViewModes);

  const setPageViewMode = (page: ViewModePage, view: PageViewMode) =>
    setViewModes((prev) => ({ ...prev, [page]: view }));

  const removePageViewMode = (page: ViewModePage) =>
    setViewModes((prev) => omit(prev, page));

  // Rejects when the save fails, which is what keeps NavigationBlocker's
  // "Save and leave" on the page. `onSave` has already shown the error toast.
  const handleSave = () =>
    onSave({
      appMode:
        selectedMode === NO_DEFAULT_VALUE
          ? undefined
          : (selectedMode as AppMode),
      defaultLandingPage:
        landingPage === DEFAULT_LANDING_PAGE ? undefined : landingPage,
      defaultViewModes: isEmpty(viewModes) ? undefined : viewModes,
    });

  // The header awaits `onSave` without a catch, so a rejection would leave its
  // Save button spinning.
  const handleHeaderSave = () => handleSave().catch(noop);

  const handleReset = () => {
    setSelectedMode(NO_DEFAULT_VALUE);
    setLandingPage(DEFAULT_LANDING_PAGE);
    setViewModes({});
  };

  return (
    <NavigationBlocker enabled={!disableSave} onConfirm={handleSave}>
      <PageLayoutV1
        className="bg-grey"
        pageTitle={t('label.customize-entity', {
          entity: t('label.app-layout'),
        })}>
        {/* The Select list closes when focus moves to another element, and a
            click on plain page content moves it nowhere. Being focusable lets
            this box take that focus, as a modal's dialog does, so an outside
            click closes the list. */}
        <Box direction="col" gap={5} tabIndex={-1}>
          <CustomizablePageHeader
            disableSave={disableSave}
            personaName={personaName}
            onReset={handleReset}
            onSave={handleHeaderSave}
          />

          <Card>
            <PreferenceRow
              description={t('message.app-mode-description')}
              title={t('label.app-mode')}>
              <RadioGroup
                aria-label={t('label.app-mode')}
                className="tw:flex-row tw:gap-3"
                data-testid="app-mode-radio-group"
                size="md"
                value={selectedMode}
                onChange={setSelectedMode}>
                {APP_MODE_OPTIONS.map((option) => (
                  <RadioButton
                    className={({ isSelected }) =>
                      classNames(
                        'tw:flex-1 tw:cursor-pointer tw:rounded-xl tw:border tw:p-4 tw:transition-colors',
                        isSelected
                          ? 'tw:border-brand tw:bg-brand-primary'
                          : 'tw:border-secondary'
                      )
                    }
                    data-testid={`app-mode-option-${option.value}`}
                    hint={
                      <Typography
                        as="span"
                        className="tw:text-tertiary"
                        size="text-xs">
                        {t(option.hintKey)}
                      </Typography>
                    }
                    key={option.value}
                    label={
                      <Typography
                        as="span"
                        className="tw:text-primary"
                        size="text-sm"
                        weight="medium">
                        {t(option.labelKey)}
                      </Typography>
                    }
                    value={option.value}
                  />
                ))}
              </RadioGroup>
            </PreferenceRow>

            <Divider />

            <PreferenceRow
              description={t('message.default-landing-page-description')}
              title={t('label.default-landing-page')}>
              <Select
                aria-label={t('label.default-landing-page')}
                data-testid="default-landing-page-select"
                fontSize="sm"
                selectedKey={landingPage}
                size="md"
                onSelectionChange={(key) => key && setLandingPage(String(key))}>
                {LANDING_PAGE_SECTIONS.map((section) => (
                  <ListBoxSection id={section.titleKey} key={section.titleKey}>
                    <Header className="tw:px-3.5 tw:pt-3 tw:pb-1 tw:text-sm tw:font-semibold tw:text-tertiary">
                      {t(section.titleKey)}
                    </Header>
                    {section.options.map((option) => (
                      <Select.Item
                        id={option.path}
                        key={option.path}
                        label={t(option.labelKey)}
                        supportingText={option.path}
                      />
                    ))}
                  </ListBoxSection>
                ))}
              </Select>
            </PreferenceRow>

            <Divider />

            <PreferenceRow
              description={t('message.view-mode-description')}
              title={t('label.view-mode')}>
              <Box
                className="tw:rounded-xl tw:border tw:border-secondary"
                data-testid="view-mode-pages"
                direction="col">
                {configuredPages.map(({ page, labelKey, views }) => (
                  <Box
                    align="center"
                    className="tw:border-b tw:border-secondary tw:px-5 tw:py-3"
                    data-testid={`view-mode-row-${page}`}
                    gap={4}
                    justify="between"
                    key={page}>
                    <Typography
                      as="span"
                      className="tw:text-primary"
                      size="text-sm"
                      weight="medium">
                      {t(labelKey)}
                    </Typography>
                    <Box align="center" gap={3}>
                      <Tabs
                        className="tw:w-auto"
                        selectedKey={viewModes[page]}
                        onSelectionChange={(key) =>
                          setPageViewMode(page, key as PageViewMode)
                        }>
                        <Tabs.List
                          aria-label={t(labelKey)}
                          size="sm"
                          type="button-border">
                          {views.map((view) => (
                            <Tabs.Item
                              data-testid={`view-mode-${page}-${view}`}
                              id={view}
                              key={view}>
                              {t(PAGE_VIEW_MODE_LABEL_KEYS[view])}
                            </Tabs.Item>
                          ))}
                        </Tabs.List>
                      </Tabs>
                      <ButtonUtility
                        color="tertiary"
                        data-testid={`remove-view-mode-${page}`}
                        icon={Delete}
                        tooltip={t('label.remove-entity', {
                          entity: t(labelKey),
                        })}
                        onClick={() => removePageViewMode(page)}
                      />
                    </Box>
                  </Box>
                ))}
                <Box className="tw:px-5 tw:py-3">
                  <Dropdown.Root>
                    <Button
                      className="tw:text-[13px] tw:leading-5"
                      color="link-color"
                      data-testid="add-view-mode-page"
                      iconLeading={Plus}
                      isDisabled={isEmpty(addablePages)}
                      size="md">
                      {t('label.add-entity', { entity: t('label.page') })}
                    </Button>
                    <Dropdown.Popover
                      className="tw:w-80"
                      placement="bottom left">
                      <Dropdown.Menu
                        selectionMode="none"
                        onAction={(page) =>
                          setPageViewMode(
                            page as ViewModePage,
                            DEFAULT_PAGE_VIEW_MODE
                          )
                        }>
                        <Dropdown.Section>
                          <Dropdown.SectionHeader className="tw:px-4 tw:pt-2 tw:pb-1 tw:text-sm tw:font-semibold tw:text-tertiary">
                            {t('label.select-entity', {
                              entity: t('label.page'),
                            })}
                          </Dropdown.SectionHeader>
                          {addablePages.map(({ page, labelKey }) => (
                            <Dropdown.Item
                              data-testid={`add-view-mode-page-${page}`}
                              id={page}
                              key={page}
                              label={t(labelKey)}
                              textValue={t(labelKey)}
                            />
                          ))}
                        </Dropdown.Section>
                      </Dropdown.Menu>
                    </Dropdown.Popover>
                  </Dropdown.Root>
                </Box>
              </Box>
            </PreferenceRow>
          </Card>
        </Box>
      </PageLayoutV1>
    </NavigationBlocker>
  );
};
