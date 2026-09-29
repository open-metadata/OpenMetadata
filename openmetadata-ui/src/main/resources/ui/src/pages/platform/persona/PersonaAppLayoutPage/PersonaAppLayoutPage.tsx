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
  Breadcrumbs,
  Button,
  ButtonGroup,
  ButtonGroupItem,
  ButtonUtility,
  Card,
  Divider,
  Dropdown,
  Grid,
  RadioButton,
  RadioGroup,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import { Delete, Plus } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { isEmpty, isEqual, noop, omit } from 'lodash';
import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { NavigationBlocker } from '../../../../components/common/NavigationBlocker/NavigationBlocker';
import PageLayoutV1 from '../../../../components/PageLayoutV1/PageLayoutV1';
import { GlobalSettingsMenuCategory } from '../../../../constants/GlobalSettings.constants';
import {
  DEFAULT_LANDING_PAGE,
  LANDING_PAGE_SECTIONS,
} from '../../../../constants/platform/personaLandingPage.constants';
import {
  DEFAULT_PAGE_VIEW_MODE,
  PAGE_VIEW_MODE_LABEL_KEYS,
  ViewModePage,
  VIEW_MODE_PAGES,
} from '../../../../constants/platform/personaViewMode.constants';
import { Document } from '../../../../generated/entity/docStore/document';
import { Persona } from '../../../../generated/entity/teams/persona';
import {
  AppMode,
  DefaultViewModes,
  PageViewMode,
} from '../../../../generated/type/personaPreferences';
import {
  getPersonaPreferences,
  PersonaAppLayoutPreferences,
  resolvePersonaLandingPage,
} from '../../../../utils/CustomizePage/PersonaPage.utils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { Transi18next } from '../../../../utils/i18next/LocalUtil';
import {
  getPersonaDetailsPath,
  getSettingPath,
} from '../../../../utils/RouterUtils';

interface Props {
  personaDetails?: Persona;
  personaDocument: Document | null;
  onSave: (preferences: PersonaAppLayoutPreferences) => Promise<void>;
}

interface PreferenceRowProps {
  title: string;
  description: string;
  children: ReactNode;
}

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
}: Props) => {
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
  const [isSaving, setIsSaving] = useState(false);

  const personaName = getEntityName(personaDetails);
  const personaPath = `${getPersonaDetailsPath(
    personaDetails?.fullyQualifiedName ?? ''
  )}#customize-ui`;
  const breadcrumbs = [
    {
      id: 'settings',
      label: t('label.setting-plural'),
      href: getSettingPath(),
    },
    {
      id: 'personas',
      label: t('label.persona-plural'),
      href: getSettingPath(GlobalSettingsMenuCategory.PERSONA),
    },
    { id: 'persona', label: personaName, href: personaPath },
    { id: 'app-layout', label: t('label.app-layout') },
  ];

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
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        appMode:
          selectedMode === NO_DEFAULT_VALUE
            ? undefined
            : (selectedMode as AppMode),
        defaultLandingPage:
          landingPage === DEFAULT_LANDING_PAGE ? undefined : landingPage,
        defaultViewModes: isEmpty(viewModes) ? undefined : viewModes,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePress = () => handleSave().catch(noop);

  const handleDiscard = () => {
    setSelectedMode(persistedAppMode);
    setLandingPage(persistedLandingPage);
    setViewModes(persistedViewModes);
  };

  return (
    <NavigationBlocker enabled={!disableSave} onConfirm={handleSave}>
      <PageLayoutV1
        fullHeight
        className="bg-grey"
        pageTitle={t('label.customize-entity', {
          entity: t('label.app-layout'),
        })}>
        <Box className="tw:min-h-0 tw:flex-1" direction="col">
          <Box
            className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:py-4"
            direction="col"
            gap={4}>
            <Box direction="col" gap={4}>
              <Breadcrumbs divider="slash" items={breadcrumbs} size="md" />
              <Box className="tw:gap-1.5" direction="col">
                <Typography
                  as="h1"
                  className="not-prose tw:m-0 tw:text-primary"
                  data-testid="customize-page-title"
                  size="text-xl"
                  weight="semibold">
                  {t('label.app-layout')}
                </Typography>
                <Typography
                  as="p"
                  className="not-prose tw:text-tertiary"
                  size="text-sm">
                  <Transi18next
                    i18nKey="message.customize-your-app-layout-subheader"
                    renderElement={<Link to={personaPath} />}
                    values={{ persona: personaName }}
                  />
                </Typography>
              </Box>
            </Box>

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
                  labelWeight="semibold"
                  selectedKey={landingPage}
                  size="md"
                  onSelectionChange={(key) =>
                    key && setLandingPage(String(key))
                  }>
                  {LANDING_PAGE_SECTIONS.map((section) => (
                    <Select.Section
                      id={section.titleKey}
                      key={section.titleKey}>
                      <Select.SectionHeader className="tw:px-3.5 tw:pt-3 tw:pb-1 tw:text-sm tw:font-semibold tw:text-tertiary">
                        {t(section.titleKey)}
                      </Select.SectionHeader>
                      {section.options.map((option) => (
                        <Select.Item
                          id={option.path}
                          key={option.path}
                          label={t(option.labelKey)}
                          supportingText={option.path}
                        />
                      ))}
                    </Select.Section>
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
                        <ButtonGroup
                          disallowEmptySelection
                          aria-label={t(labelKey)}
                          selectedKeys={[viewModes[page] as PageViewMode]}
                          size="sm"
                          variant="segmented"
                          onSelectionChange={(keys) =>
                            setPageViewMode(
                              page,
                              Array.from(keys)[0] as PageViewMode
                            )
                          }>
                          {views.map((view) => (
                            <ButtonGroupItem
                              data-testid={`view-mode-${page}-${view}`}
                              id={view}
                              key={view}>
                              {t(PAGE_VIEW_MODE_LABEL_KEYS[view])}
                            </ButtonGroupItem>
                          ))}
                        </ButtonGroup>
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
                            {addablePages.map(({ page, labelKey, views }) => (
                              <Dropdown.Item
                                data-testid={`add-view-mode-page-${page}`}
                                id={page}
                                key={page}
                                textValue={t(labelKey)}>
                                <span className="tw:flex tw:justify-between tw:gap-4">
                                  <span className="tw:text-md tw:text-primary">
                                    {t(labelKey)}
                                  </span>
                                  <span className="tw:text-tertiary">
                                    {views
                                      .map((view) =>
                                        t(PAGE_VIEW_MODE_LABEL_KEYS[view])
                                      )
                                      .join(' · ')}
                                  </span>
                                </span>
                              </Dropdown.Item>
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

          <Box
            align="center"
            className="tw:-mx-4 tw:shrink-0 tw:border-t tw:border-secondary tw:bg-surface tw:px-6 tw:py-4"
            data-testid="app-layout-footer"
            gap={4}
            justify="between">
            <Typography
              as="span"
              className="tw:text-[13px] tw:leading-5 tw:text-tertiary"
              data-testid="save-status">
              {disableSave
                ? t('message.all-changes-saved')
                : t('message.unsaved-changes')}
            </Typography>
            <Box gap={3}>
              <Button
                color="secondary"
                data-testid="discard-button"
                isDisabled={disableSave || isSaving}
                size="md"
                onPress={handleDiscard}>
                {t('label.discard')}
              </Button>
              <Button
                color="primary"
                data-testid="save-button"
                isDisabled={disableSave}
                isLoading={isSaving}
                size="md"
                onPress={handleSavePress}>
                {t('label.save-changes')}
              </Button>
            </Box>
          </Box>
        </Box>
      </PageLayoutV1>
    </NavigationBlocker>
  );
};
