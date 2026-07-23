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

import { Card, Col, Radio, Row, Space, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { NavigationBlocker } from '../../components/common/NavigationBlocker/NavigationBlocker';
import { CustomizablePageHeader } from '../../components/MyData/CustomizableComponents/CustomizablePageHeader/CustomizablePageHeader';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { Persona } from '../../generated/entity/teams/persona';
import {
  AppMode,
  PersonaPreferences,
} from '../../generated/type/personaPreferences';
import { useAppRoutesRegistry } from '../../hooks/useAppRoutesRegistry';
import { useCustomizeStore } from '../CustomizablePage/CustomizeStore';

interface Props {
  personaDetails?: Persona;
  onSave: (appMode: AppMode) => Promise<void>;
}

const APP_MODE_OPTIONS: readonly AppMode[] = [AppMode.Classic, AppMode.AI];

const labelFor = (t: (key: string) => string, mode: AppMode): string => {
  switch (mode) {
    case AppMode.Classic:
      return t('label.app-mode-classic');
    case AppMode.AI:
      return t('label.app-mode-ai');
  }
};

export const SettingsAppModePage = ({ personaDetails, onSave }: Props) => {
  const { t } = useTranslation();
  const { document } = useCustomizeStore();
  const hasNonDefaultMode = useAppRoutesRegistry(
    (state) => Object.keys(state.routes).length > 0
  );

  const persistedAppMode = useMemo<AppMode>(() => {
    const preferences = (document?.data?.personaPreferences ??
      []) as PersonaPreferences[];

    return (
      preferences.find((entry) => entry.personaId === personaDetails?.id)
        ?.appMode ?? AppMode.Classic
    );
  }, [document, personaDetails?.id]);

  const [selectedMode, setSelectedMode] = useState<AppMode>(persistedAppMode);

  const disableSave = selectedMode === persistedAppMode;

  const handleSave = async () => {
    await onSave(selectedMode);
  };

  const handleReset = () => {
    setSelectedMode(AppMode.Classic);
  };

  if (!hasNonDefaultMode) {
    return (
      <PageLayoutV1 className="bg-grey" pageTitle="Settings App Mode Page">
        <div data-testid="app-mode-unavailable-placeholder">
          <ErrorPlaceHolder
            className="m-t-lg"
            type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
            <Typography.Paragraph className="w-max-500">
              {t('message.app-mode-not-available')}
            </Typography.Paragraph>
          </ErrorPlaceHolder>
        </div>
      </PageLayoutV1>
    );
  }

  return (
    <NavigationBlocker enabled={!disableSave} onConfirm={handleSave}>
      <PageLayoutV1 className="bg-grey" pageTitle="Settings App Mode Page">
        <Row gutter={[0, 20]}>
          <Col span={24}>
            <CustomizablePageHeader
              hasNavigationBlocker
              disableSave={disableSave}
              personaName={t('label.customize-your-app-mode')}
              onReset={handleReset}
              onSave={handleSave}
            />
          </Col>

          <Col span={24}>
            <Card bordered={false} title={t('label.app-mode')}>
              <Typography.Paragraph type="secondary">
                {t('message.app-mode-description')}
              </Typography.Paragraph>

              <Radio.Group
                value={selectedMode}
                onChange={(e) => setSelectedMode(e.target.value as AppMode)}>
                <Space direction="vertical">
                  {APP_MODE_OPTIONS.map((mode) => (
                    <Radio
                      data-testid={`app-mode-option-${mode}`}
                      key={mode}
                      value={mode}>
                      {labelFor(t, mode)}
                    </Radio>
                  ))}
                </Space>
              </Radio.Group>
            </Card>
          </Col>
        </Row>
      </PageLayoutV1>
    </NavigationBlocker>
  );
};
