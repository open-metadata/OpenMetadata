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
import { ReactComponent as QuestionMarkIcon } from '../../../assets/svg/ic-question-mark.svg';
import { ReactComponent as SuggestionsIcon } from '../../../assets/svg/ic-suggestions.svg';
import RichTextEditorPreviewer from '../../common/RichTextEditor/RichTextEditorPreviewer';
import { useMetaPilotContext } from '../MetaPilotProvider/MetaPilotProvider';
import { SuggestionAction } from '../MetaPilotProvider/MetaPilotProvider.interface';
import './metapilot-popover-content.less';
import { MetaPilotPopoverContentProps } from './MetaPilotPopoverContent.interface';

const MetaPilotPopoverContent = ({
  suggestion,
  hasEditAccess = false,
}: MetaPilotPopoverContentProps) => {
  const { t } = useTranslation();
  const { acceptRejectSuggestion } = useMetaPilotContext();

  useLayoutEffect(() => {
    const element = document.querySelector('.has-suggestion');
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
      <Card className="card-padding-0 card-body-border-none">
        <div className="p-sm">
          <SuggestionsIcon
            className="float-left m-r-xs"
            height={16}
            width={16}
          />
          <RichTextEditorPreviewer markdown={suggestion.description ?? ''} />
        </div>

        <div className="p-xs popover-card-footer">
          <div className="d-flex items-center text-xs">
            <QuestionMarkIcon height={20} width={20} />
            <Typography.Text className="m-l-xs">
              {t('label.generated-by')}
            </Typography.Text>
            <Typography.Text strong className="m-l-xss text-primary">
              {t('label.metapilot')}
            </Typography.Text>
          </div>
          {hasEditAccess && (
            <div className="d-flex gap-2">
              <Button
                ghost
                icon={<CloseOutlined />}
                size="small"
                type="primary"
                onClick={() =>
                  acceptRejectSuggestion(suggestion, SuggestionAction.Reject)
                }
              />
              <Button
                icon={<CheckOutlined />}
                size="small"
                type="primary"
                onClick={() =>
                  acceptRejectSuggestion(suggestion, SuggestionAction.Accept)
                }
              />
            </div>
          )}
        </div>
      </Card>
    </Space>
  );
};

export default MetaPilotPopoverContent;
