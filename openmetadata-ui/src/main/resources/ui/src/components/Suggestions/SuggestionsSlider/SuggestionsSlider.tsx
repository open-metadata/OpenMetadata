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
import { Button, Typography } from '@openmetadata/ui-core-components';
import { Check, XClose } from '@openmetadata/ui-core-components/icons';
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
      <Typography className="right-panel-label">{suggestionLabel}</Typography>
      <AvatarCarousel />
      {suggestionPendingCount > 0 && (
        <Button
          className="suggestion-pending-btn"
          color="primary"
          data-testid="more-suggestion-button"
          isLoading={loading}
          size="xs"
          onPress={() => fetchSuggestions()}>
          {t('label.plus-count-more', {
            count: suggestionPendingCount,
          })}
        </Button>
      )}
      {selectedUserSuggestions?.combinedData.length > 0 && (
        <div className="slider-btn-container m-l-xs tw:flex tw:items-center tw:gap-2">
          {hasSuggestionEditAccess && (
            <>
              <Button
                className="text-xs font-medium"
                color="secondary-brand"
                data-testid="accept-all-suggestions"
                iconLeading={Check}
                isDisabled={loadingAccept}
                isLoading={loadingAccept}
                size="xs"
                onPress={() =>
                  acceptRejectAllSuggestions(SuggestionAction.Accept)
                }>
                {t('label.accept-all')}
              </Button>
              <Button
                className="text-xs font-medium"
                color="secondary-brand"
                data-testid="reject-all-suggestions"
                iconLeading={XClose}
                isDisabled={loadingReject}
                isLoading={loadingReject}
                size="xs"
                onPress={() =>
                  acceptRejectAllSuggestions(SuggestionAction.Reject)
                }>
                {t('label.reject-all')}
              </Button>
            </>
          )}
          <Button
            className="text-xs font-medium close-suggestion-btn"
            color="secondary-brand"
            data-testid="close-suggestion"
            iconLeading={<ExitIcon />}
            size="xs"
            onPress={() => onUpdateActiveUser()}>
            {t('label.close')}
          </Button>
        </div>
      )}
    </div>
  );
};

export default SuggestionsSlider;
