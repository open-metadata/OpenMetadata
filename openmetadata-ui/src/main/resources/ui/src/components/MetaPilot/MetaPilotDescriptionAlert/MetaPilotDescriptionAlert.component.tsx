/*
 *  Copyright 2024 Collate.
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
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { Button, Card, Space, Typography } from 'antd';
import React, { useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as SuggestionsIcon } from '../../../assets/svg/ic-suggestions.svg';
import { ReactComponent as MetaPilotIcon } from '../../../assets/svg/MetaPilotApplication.svg';
import RichTextEditorPreviewer from '../../common/RichTextEditor/RichTextEditorPreviewer';
import { useMetaPilotContext } from '../MetaPilotProvider/MetaPilotProvider';
import { SuggestionAction } from '../MetaPilotProvider/MetaPilotProvider.interface';
import { MetaPilotDescriptionAlertProps } from './MetaPilotDescriptionAlert.interface';

const MetaPilotDescriptionAlert = ({
  showHeading = true,
  suggestion,
  hasEditAccess = false,
}: MetaPilotDescriptionAlertProps) => {
  const { t } = useTranslation();
  const { onUpdateActiveSuggestion, acceptRejectSuggestion } =
    useMetaPilotContext();

  useLayoutEffect(() => {
    const element = document.querySelector('.suggested-description-card');
    if (element) {
      element.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, []);

  if (!suggestion) {
    return null;
  }

  return (
    <Space
      className="schema-description d-flex"
      data-testid="asset-description-container"
      direction="vertical"
      size={12}>
      {showHeading && (
        <Space size={4}>
          <Typography.Text className="right-panel-label">
            {t('label.description')}
          </Typography.Text>
          <MetaPilotIcon className="d-flex" height={24} width={24} />
        </Space>
      )}
      <Card className="suggested-description-card">
        <div className="d-flex m-b-xs justify-between">
          <div className="d-flex items-center gap-2">
            <SuggestionsIcon height={20} width={20} />
            <Typography.Text className="m-b-0 font-medium text-md">
              {t('label.metapilot-suggested-description')}
            </Typography.Text>
          </div>
          <CloseOutlined onClick={() => onUpdateActiveSuggestion(undefined)} />
        </div>
        <RichTextEditorPreviewer markdown={suggestion.description ?? ''} />
        {hasEditAccess && (
          <div className="d-flex justify-end p-t-sm gap-2">
            <Button
              ghost
              icon={<CloseOutlined />}
              type="primary"
              onClick={() =>
                acceptRejectSuggestion(suggestion, SuggestionAction.Reject)
              }>
              {t('label.reject')}
            </Button>
            <Button
              icon={<CheckOutlined />}
              type="primary"
              onClick={() =>
                acceptRejectSuggestion(suggestion, SuggestionAction.Accept)
              }>
              {t('label.accept')}
            </Button>
          </div>
        )}
      </Card>
    </Space>
  );
};

export default MetaPilotDescriptionAlert;
