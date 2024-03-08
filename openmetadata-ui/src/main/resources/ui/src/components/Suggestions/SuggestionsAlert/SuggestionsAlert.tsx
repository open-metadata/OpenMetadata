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
import React from 'react';
import { useTranslation } from 'react-i18next';
import UserPopOverCard from '../../common/PopOverCard/UserPopOverCard';
import ProfilePicture from '../../common/ProfilePicture/ProfilePicture';
import RichTextEditorPreviewer from '../../common/RichTextEditor/RichTextEditorPreviewer';
import { useSuggestionsContext } from '../SuggestionsProvider/SuggestionsProvider';
import { SuggestionAction } from '../SuggestionsProvider/SuggestionsProvider.interface';
import './suggestions-alert.less';
import { SuggestionsAlertProps } from './SuggestionsAlert.interface';

const SuggestionsAlert = ({
  suggestion,
  hasEditAccess = false,
  maxLength,
}: SuggestionsAlertProps) => {
  const { t } = useTranslation();
  const { acceptRejectSuggestion } = useSuggestionsContext();
  const userName = suggestion?.createdBy?.name ?? '';

  if (!suggestion) {
    return null;
  }

  return (
    <Space
      className="schema-description d-flex"
      data-testid="asset-description-container"
      direction="vertical"
      size={12}>
      <Card className="suggested-description-card">
        <div className="d-flex m-b-xs justify-between">
          <div className="d-flex items-center">
            <UserPopOverCard userName={userName}>
              <span className="m-r-xs">
                <ProfilePicture name={userName} width="28" />
              </span>
            </UserPopOverCard>

            <Typography.Text className="m-b-0 font-medium">
              {`${userName} ${t('label.suggested-description')}`}
            </Typography.Text>
          </div>
        </div>
        <RichTextEditorPreviewer
          markdown={suggestion.description ?? ''}
          maxLength={maxLength}
        />
        {hasEditAccess && (
          <div className="d-flex justify-end p-t-xss gap-2">
            <Button
              ghost
              data-testid="reject-suggestion"
              icon={<CloseOutlined />}
              size="small"
              type="primary"
              onClick={() =>
                acceptRejectSuggestion(suggestion, SuggestionAction.Reject)
              }
            />
            <Button
              data-testid="accept-suggestion"
              icon={<CheckOutlined />}
              size="small"
              type="primary"
              onClick={() =>
                acceptRejectSuggestion(suggestion, SuggestionAction.Accept)
              }
            />
          </div>
        )}
      </Card>
    </Space>
  );
};

export default SuggestionsAlert;
