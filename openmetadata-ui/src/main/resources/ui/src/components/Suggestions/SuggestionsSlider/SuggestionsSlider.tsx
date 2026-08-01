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
import { Space } from 'antd';

import { Button, Typography } from '@openmetadata/ui-core-components';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ExitIcon } from '../../../assets/svg/ic-exit.svg';
import { SuggestionType } from '../../../types/taskSuggestion';
import AvatarCarousel from '../../common/AvatarCarousel/AvatarCarousel';
import { useSuggestionsContext } from '../SuggestionsProvider/SuggestionsProvider';
import { SuggestionAction } from '../SuggestionsProvider/SuggestionsProvider.interface';

const SuggestionsSlider = () => {
  const {
    loading,
    dataSuggestionType,
    suggestionPendingCount,
    fetchSuggestions,
    selectedUserSuggestions,
    acceptRejectAllSuggestions,
    loadingAccept,
    loadingReject,
    onUpdateActiveUser,
  } = useSuggestionsContext();
  const { t } = useTranslation();

  const suggestionLabel = useMemo(() => {
    switch (dataSuggestionType) {
      case SuggestionType.SuggestDescription:
        return t('label.suggested-description-plural');

      case SuggestionType.SuggestTagLabel:
        return t('label.suggested-tag-plural');

      default:
        return t('label.suggested-description-tag-plural');
    }
  }, [dataSuggestionType]);

  return (
    <div className="d-flex items-center gap-2 m-r-md">
      <Typography className="right-panel-label">{suggestionLabel}</Typography>
      <AvatarCarousel />
      {suggestionPendingCount > 0 && (
        <Button
          className="suggestion-pending-btn"
          color="primary"
          data-testid="more-suggestion-button"
          isLoading={loading}
          onClick={() => fetchSuggestions()}>
          {t('label.plus-count-more', {
            count: suggestionPendingCount,
          })}
        </Button>
      )}
      {selectedUserSuggestions?.combinedData.length > 0 && (
        <Space className="slider-btn-container m-l-xs">
          <Button
            className="text-xs text-primary font-medium"
            color="tertiary"
            data-testid="accept-all-suggestions"
            iconLeading={<CheckOutlined />}
            isDisabled={loadingAccept}
            isLoading={loadingAccept}
            onClick={() => acceptRejectAllSuggestions(SuggestionAction.Accept)}>
            {t('label.accept-all')}
          </Button>
          <Button
            className="text-xs text-primary font-medium"
            color="tertiary"
            data-testid="reject-all-suggestions"
            iconLeading={<CloseOutlined />}
            isDisabled={loadingReject}
            isLoading={loadingReject}
            onClick={() => acceptRejectAllSuggestions(SuggestionAction.Reject)}>
            {t('label.reject-all')}
          </Button>
          <Button
            className="text-xs text-primary font-medium close-suggestion-btn flex-center"
            color="tertiary"
            data-testid="close-suggestion"
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
