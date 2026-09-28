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
import { Button, Typography } from '@openmetadata/ui-core-components';
import { Space } from 'antd';
import { isEmpty } from 'lodash';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ExitIcon } from '../../../assets/svg/ic-exit.svg';
import { SuggestionAction } from '../../../enums/Suggestion.enum';
import { SuggestionType } from '../../../types/taskSuggestion';
import { getDerivedPermissionFlags } from '../../../utils/PermissionDerivation';
import AvatarCarousel from '../../common/AvatarCarousel/AvatarCarousel';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import { useSuggestionsContext } from '../SuggestionsProvider/SuggestionsProvider';

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
  const { permissions } = useGenericContext();
  const { t } = useTranslation();

  // Accept/Reject all resolves every pending suggestion of the selected user, including
  // the column level ones rendered inside the entity tables. Only offer the actions when
  // the user may apply each kind of suggestion present, otherwise the API rejects the
  // call and the entity silently reverts to its original state on the next fetch.
  const hasSuggestionEditAccess = useMemo(() => {
    const { canEditDescription, canEditTags } =
      getDerivedPermissionFlags(permissions);

    return (
      (isEmpty(selectedUserSuggestions?.description) || canEditDescription) &&
      (isEmpty(selectedUserSuggestions?.tags) || canEditTags)
    );
  }, [permissions, selectedUserSuggestions]);

  const suggestionLabel = useMemo(() => {
    switch (dataSuggestionType) {
      case SuggestionType.SuggestDescription:
        return t('label.suggested-description-plural');

      case SuggestionType.SuggestTagLabel:
        return t('label.suggested-tag-plural');

      default:
        return t('label.suggested-description-tag-plural');
    }
  }, [dataSuggestionType, t]);

  return (
    <div className="d-flex items-center gap-2 m-r-md">
      <Typography className="right-panel-label" variant="text">
        {suggestionLabel}
      </Typography>
      <AvatarCarousel />
      {suggestionPendingCount > 0 && (
        <Button
          showTextWhileLoading
          className="suggestion-pending-btn tw:ml-1 tw:rounded-full tw:px-2! tw:text-xs! tw:before:rounded-full"
          color="primary"
          data-testid="more-suggestion-button"
          isLoading={loading}
          size="md"
          onClick={() => fetchSuggestions()}>
          {t('label.plus-count-more', {
            count: suggestionPendingCount,
          })}
        </Button>
      )}
      {selectedUserSuggestions?.combinedData.length > 0 && (
        <Space className="slider-btn-container m-l-xs">
          {hasSuggestionEditAccess && (
            <>
              <Button
                showTextWhileLoading
                className="text-xs text-primary font-medium"
                color="secondary-brand"
                data-testid="accept-all-suggestions"
                iconLeading={CheckOutlined}
                isDisabled={loadingAccept}
                isLoading={loadingAccept}
                size="md"
                onClick={() =>
                  acceptRejectAllSuggestions(SuggestionAction.Accept)
                }>
                {t('label.accept-all')}
              </Button>
              <Button
                showTextWhileLoading
                className="text-xs text-primary font-medium"
                color="secondary-brand"
                data-testid="reject-all-suggestions"
                iconLeading={CloseOutlined}
                isDisabled={loadingReject}
                isLoading={loadingReject}
                size="md"
                onClick={() =>
                  acceptRejectAllSuggestions(SuggestionAction.Reject)
                }>
                {t('label.reject-all')}
              </Button>
            </>
          )}
          <Button
            className="text-xs text-primary font-medium close-suggestion-btn"
            color="secondary-brand"
            data-testid="close-suggestion"
            iconLeading={ExitIcon}
            size="md"
            onClick={() => onUpdateActiveUser()}>
            {t('label.close')}
          </Button>
        </Space>
      )}
    </div>
  );
};

export default SuggestionsSlider;
