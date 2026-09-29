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
import { isEmpty, isEqual, omit } from 'lodash';
import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ErrorPlaceHolder from '../../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { NavigationBlocker } from '../../../../components/common/NavigationBlocker/NavigationBlocker';
import { CustomizablePageHeader } from '../../../../components/MyData/CustomizableComponents/CustomizablePageHeader/CustomizablePageHeader';
import PageLayoutV1 from '../../../../components/PageLayoutV1/PageLayoutV1';
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
import { ERROR_PLACEHOLDER_TYPE } from '../../../../enums/common.enum';
import { Persona } from '../../../../generated/entity/teams/persona';
import {
  AppMode,
  DefaultViewModes,
  PageViewMode,
} from '../../../../generated/type/personaPreferences';
import {
  getPersonaPreferences,
  PersonaGeneralPreferences,
  resolvePersonaLandingPage,
} from '../../../../utils/CustomizePage/PersonaPage.utils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { useCustomizeStore } from '../../../CustomizablePage/CustomizeStore';

interface Props {
  personaDetails?: Persona;
  onSave: (preferences: PersonaGeneralPreferences) => Promise<void>;
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
        <Box direction="col" gap={1}>
          <Typography
            as="h3"
            className="not-prose tw:m-0 tw:text-primary"
            size="text-md"
            weight="semibold">
            {title}
          </Typography>
          <Typography
            as="p"
            className="not-prose tw:text-tertiary"
            size="text-sm">
            {description}
          </Typography>
        </Box>
      </Grid.Item>
      <Grid.Item span={16}>{children}</Grid.Item>
    </Grid>
  </Card.Content>
);

export const PersonaGeneralPreferencesPage = ({
  personaDetails,
  onSave,
}: Props) => {
  const { t } = useTranslation();
  const { document } = useCustomizeStore();
  // AI is always available in OSS — the shell ships in-tree, no
  // install-gate.
  const hasNonDefaultMode = true;

  const persistedPreferences = getPersonaPreferences(
    document,
    personaDetails?.id
  );
  const persistedAppMode = persistedPreferences?.appMode ?? NO_DEFAULT_VALUE;
  const persistedViewModes: DefaultViewModes =
    persistedPreferences?.defaultViewModes ?? {};
  const persistedLandingPage = resolvePersonaLandingPage(
    document,
    personaDetails?.id
  );

  const [selectedMode, setSelectedMode] = useState<string>(persistedAppMode);
  const [landingPage, setLandingPage] = useState(persistedLandingPage);
  const [viewModes, setViewModes] = useState(persistedViewModes);

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

  const handleSave = async () => {
    await onSave({
      appMode:
        selectedMode === NO_DEFAULT_VALUE
          ? undefined
          : (selectedMode as AppMode),
      defaultLandingPage:
        landingPage === DEFAULT_LANDING_PAGE ? undefined : landingPage,
      defaultViewModes: isEmpty(viewModes) ? undefined : viewModes,
    });
  };

  const handleReset = () => {
    setSelectedMode(NO_DEFAULT_VALUE);
    setLandingPage(DEFAULT_LANDING_PAGE);
    setViewModes({});
  };

  if (!hasNonDefaultMode) {
    return (
      <PageLayoutV1
        className="bg-grey"
        pageTitle={t('label.customize-entity', {
          entity: t('label.app-mode'),
        })}>
        <div data-testid="app-mode-unavailable-placeholder">
          <ErrorPlaceHolder
            className="m-t-lg"
            type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
            <Typography as="p" className="w-max-500">
              {t('message.app-mode-not-available')}
            </Typography>
          </ErrorPlaceHolder>
        </div>
      </PageLayoutV1>
    );
  }

  return (
    <NavigationBlocker enabled={!disableSave} onConfirm={handleSave}>
      <PageLayoutV1
        className="bg-grey"
        pageTitle={t('label.customize-entity', {
          entity: t('label.general-preferences'),
        })}>
        <Box direction="col" gap={5}>
          <CustomizablePageHeader
            disableSave={disableSave}
            personaName={getEntityName(personaDetails)}
            onReset={handleReset}
            onSave={handleSave}
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
                        size="text-sm">
                        {t(option.hintKey)}
                      </Typography>
                    }
                    key={option.value}
                    label={
                      <Typography
                        as="span"
                        className="tw:text-primary"
                        size="text-md"
                        weight="semibold">
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
                fontSize="md"
                labelWeight="semibold"
                selectedKey={landingPage}
                size="md"
                onSelectionChange={(key) => key && setLandingPage(String(key))}>
                {LANDING_PAGE_SECTIONS.map((section) => (
                  <Select.Section id={section.titleKey} key={section.titleKey}>
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
                      size="text-md"
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
      </PageLayoutV1>
    </NavigationBlocker>
  );
};
