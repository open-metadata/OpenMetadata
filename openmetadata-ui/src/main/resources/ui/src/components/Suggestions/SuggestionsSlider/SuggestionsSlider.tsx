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
import { Button, Space, Typography } from 'antd';

import { useTranslation } from 'react-i18next';
import { ReactComponent as ExitIcon } from '../../../assets/svg/ic-exit.svg';
import AvatarCarousel from '../../common/AvatarCarousel/AvatarCarousel';
import { useSuggestionsContext } from '../SuggestionsProvider/SuggestionsProvider';
import { SuggestionAction } from '../SuggestionsProvider/SuggestionsProvider.interface';

const SuggestionsSlider = () => {
  const {
    suggestions,
    loading,
    fetchSuggestions,
    suggestionLimit,
    selectedUserSuggestions,
    acceptRejectAllSuggestions,
    loadingAccept,
    loadingReject,
    onUpdateActiveUser,
  } = useSuggestionsContext();
  const { t } = useTranslation();

  return (
    <div className="d-flex items-center gap-2 m-r-md">
      <Typography.Text className="right-panel-label">
        {t('label.suggested-description-plural')}
      </Typography.Text>
      <AvatarCarousel />
      {suggestions.length !== 0 && suggestions.length !== suggestionLimit && (
        <Button
          className="suggestion-pending-btn"
          data-testid="more-suggestion-button"
          loading={loading}
          type="primary"
          onClick={() => fetchSuggestions()}>
          {t('label.plus-count-more', {
            count: suggestionLimit - 10, // 10 is the default limit, and only show count of pending suggestions
          })}
        </Button>
      )}
      {selectedUserSuggestions?.combinedData.length > 0 && (
        <Space className="slider-btn-container m-l-xs">
          <Button
            ghost
            className="text-xs text-primary font-medium"
            data-testid="accept-all-suggestions"
            icon={<CheckOutlined />}
            loading={loadingAccept}
            type="primary"
            onClick={() => acceptRejectAllSuggestions(SuggestionAction.Accept)}>
            {t('label.accept-all')}
          </Button>
          <Button
            ghost
            className="text-xs text-primary font-medium"
            data-testid="reject-all-suggestions"
            icon={<CloseOutlined />}
            loading={loadingReject}
            type="primary"
            onClick={() => acceptRejectAllSuggestions(SuggestionAction.Reject)}>
            {t('label.reject-all')}
          </Button>
          <Button
            ghost
            className="text-xs text-primary font-medium close-suggestion-btn flex-center"
            data-testid="close-suggestion"
            type="primary"
            onClick={() => onUpdateActiveUser()}>
            <ExitIcon />
            {t('label.close')}
          </Button>
        </Space>
      )}
    </div>
  );
};

export default SuggestionsSlider;
