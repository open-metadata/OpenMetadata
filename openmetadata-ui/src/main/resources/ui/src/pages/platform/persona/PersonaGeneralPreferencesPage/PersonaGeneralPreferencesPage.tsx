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
  Card,
  Divider,
  Grid,
  RadioButton,
  RadioGroup,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
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
import { ERROR_PLACEHOLDER_TYPE } from '../../../../enums/common.enum';
import { Persona } from '../../../../generated/entity/teams/persona';
import { AppMode } from '../../../../generated/type/personaPreferences';
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

  const persistedAppMode =
    getPersonaPreferences(document, personaDetails?.id)?.appMode ??
    NO_DEFAULT_VALUE;
  const persistedLandingPage = resolvePersonaLandingPage(
    document,
    personaDetails?.id
  );

  const [selectedMode, setSelectedMode] = useState<string>(persistedAppMode);
  const [landingPage, setLandingPage] = useState(persistedLandingPage);

  const disableSave =
    selectedMode === persistedAppMode && landingPage === persistedLandingPage;

  const handleSave = async () => {
    await onSave({
      appMode:
        selectedMode === NO_DEFAULT_VALUE
          ? undefined
          : (selectedMode as AppMode),
      defaultLandingPage:
        landingPage === DEFAULT_LANDING_PAGE ? undefined : landingPage,
    });
  };

  const handleReset = () => {
    setSelectedMode(NO_DEFAULT_VALUE);
    setLandingPage(DEFAULT_LANDING_PAGE);
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
          </Card>
        </Box>
      </PageLayoutV1>
    </NavigationBlocker>
  );
};
