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
import { CloseOutlined } from '@ant-design/icons';
import { Card, Drawer, Typography } from 'antd';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as MetaPilotIcon } from '../../../assets/svg/ic-metapilot.svg';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { Suggestion } from '../../../generated/entity/feed/suggestion';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import RichTextEditorPreviewer from '../../common/RichTextEditor/RichTextEditorPreviewer';
import Loader from '../../Loader/Loader';
import { useMetaPilotContext } from '../MetaPilotProvider/MetaPilotProvider';
import './meta-pilot-sidebar.less';

const MetaPilotSidebar = () => {
  const { t } = useTranslation();
  const {
    onUpdateActiveSuggestion,
    suggestions,
    loading,
    suggestionsVisible,
    onToggleSuggestionsVisible,
  } = useMetaPilotContext();

  const descriptionsView = useMemo(() => {
    return suggestions.map((item: Suggestion) => {
      return (
        <Card
          className="suggestion-card m-t-xs border-primary"
          key={item.id}
          onClick={() => onUpdateActiveSuggestion(item)}>
          <RichTextEditorPreviewer
            enableSeeMoreVariant={false}
            markdown={item.description ?? ''}
          />
          <Typography.Text className="text-xss text-grey-muted">
            {item.entityLink}
          </Typography.Text>
        </Card>
      );
    });
  }, [suggestions]);

  return (
    <Drawer
      destroyOnClose
      className="meta-pilot-drawer"
      closable={false}
      extra={
        <CloseOutlined
          data-testid="entity-panel-close-icon"
          onClick={() => onToggleSuggestionsVisible(false)}
        />
      }
      getContainer={false}
      headerStyle={{ padding: 16 }}
      mask={false}
      open={suggestionsVisible}
      title={
        <div className="d-flex items-center gap-2">
          <MetaPilotIcon height={24} width={24} />
          <Typography.Title className="m-b-0" level={4}>
            {t('label.metapilot')}
          </Typography.Title>
        </div>
      }
      width={340}>
      {loading ? (
        <Loader />
      ) : (
        <>
          {suggestions?.length === 0 && (
            <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.NO_DATA} />
          )}
          {suggestions.length > 0 && (
            <>
              <Typography.Text className="text-grey-muted m-m-xs">
                {t('label.suggested-description-plural')}
              </Typography.Text>
              {descriptionsView}
            </>
          )}
        </>
      )}
    </Drawer>
  );
};

export default MetaPilotSidebar;
