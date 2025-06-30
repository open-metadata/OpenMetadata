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
import { Button, Card, Typography } from 'antd';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { ReactComponent as StarIcon } from '../../../assets/svg/ic-suggestions-coloured.svg';
import { SuggestionType } from '../../../generated/entity/feed/suggestion';
import UserPopOverCard from '../../common/PopOverCard/UserPopOverCard';
import ProfilePicture from '../../common/ProfilePicture/ProfilePicture';
import RichTextEditorPreviewerV1 from '../../common/RichTextEditor/RichTextEditorPreviewerV1';
import TagsViewer from '../../Tag/TagsViewer/TagsViewer';
import { useSuggestionsContext } from '../SuggestionsProvider/SuggestionsProvider';
import { SuggestionAction } from '../SuggestionsProvider/SuggestionsProvider.interface';
import './suggestions-alert.less';
import { SuggestionsAlertProps } from './SuggestionsAlert.interface';

const SuggestionsAlert = ({
  suggestion,
  hasEditAccess = false,
  maxLength,
  showInlineCard,
  showSuggestedBy = true,
}: SuggestionsAlertProps) => {
  const { t } = useTranslation();
  const { acceptRejectSuggestion } = useSuggestionsContext();
  const userName = suggestion?.createdBy?.name ?? '';

  if (!suggestion) {
    return null;
  }

  return (
    <Card
      className={classNames('suggested-card card-padding-0', {
        'card-inline-flex': showInlineCard,
      })}
      data-testid={`suggested-${suggestion.type}-card`}>
      <div className="suggested-alert-content">
        {suggestion.type === SuggestionType.SuggestDescription ? (
          <RichTextEditorPreviewerV1
            markdown={suggestion.description ?? ''}
            maxLength={maxLength}
          />
        ) : (
          <TagsViewer tags={suggestion.tagLabels ?? []} />
        )}
      </div>
      <div className="suggested-alert-footer d-flex justify-between">
        <div className="d-flex items-center gap-2 ">
          {showSuggestedBy && (
            <>
              <StarIcon width={14} />
              <Typography.Text className="text-grey-muted font-italic">
                {t('label.suggested-by')}
              </Typography.Text>
              <UserPopOverCard userName={userName}>
                <span>
                  <ProfilePicture
                    className="suggested-alert-footer-profile-pic"
                    name={userName}
                    width="20"
                  />
                </span>
              </UserPopOverCard>
            </>
          )}
        </div>

        {hasEditAccess && (
          <div className="d-flex justify-end gap-2">
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
      </div>
    </Card>
  );
};

export default SuggestionsAlert;
