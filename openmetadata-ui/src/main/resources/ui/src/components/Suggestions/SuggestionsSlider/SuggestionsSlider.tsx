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
import { Button, Typography } from 'antd';
import { t } from 'i18next';
import React from 'react';
import { SuggestionType } from '../../../generated/entity/feed/suggestion';
import AvatarCarousel from '../../common/AvatarCarousel/AvatarCarousel';
import { useSuggestionsContext } from '../SuggestionsProvider/SuggestionsProvider';
import { SuggestionAction } from '../SuggestionsProvider/SuggestionsProvider.interface';

const SuggestionsSlider = () => {
  const {
    selectedUserSuggestions,
    acceptRejectAllSuggestions,
    loadingAccept,
    loadingReject,
  } = useSuggestionsContext();

  return (
    <div className="d-flex items-center gap-2">
      <Typography.Text className="right-panel-label">
        {t('label.suggested-description-plural')}
      </Typography.Text>
      <AvatarCarousel />
      {selectedUserSuggestions.length > 0 && (
        <>
          <Button
            data-testid="accept-all-suggestions"
            loading={loadingAccept}
            size="small"
            type="primary"
            onClick={() =>
              acceptRejectAllSuggestions(
                SuggestionType.SuggestDescription,
                SuggestionAction.Accept
              )
            }>
            <Typography.Text className="text-xs text-white">
              {t('label.accept-all')}
            </Typography.Text>
          </Button>
          <Button
            ghost
            data-testid="reject-all-suggestions"
            loading={loadingReject}
            size="small"
            type="primary"
            onClick={() =>
              acceptRejectAllSuggestions(
                SuggestionType.SuggestDescription,
                SuggestionAction.Reject
              )
            }>
            <Typography.Text className="text-xs text-primary">
              {t('label.reject-all')}
            </Typography.Text>
          </Button>
        </>
      )}
    </div>
  );
};

export default SuggestionsSlider;
