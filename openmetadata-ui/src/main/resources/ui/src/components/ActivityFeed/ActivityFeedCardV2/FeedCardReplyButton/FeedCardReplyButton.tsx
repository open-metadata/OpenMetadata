/*
 *  Copyright 2026 Collate.
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
import { Button } from '@openmetadata/ui-core-components';
import {
  Comment,
  MessageDotsCircle,
} from '@openmetadata/ui-core-components/icons';
import { ButtonProps as AriaButtonProps } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { LABELLED_REPLY_CLASS } from '../FeedCardFooter/FeedCardFooterNew.constants';
import { getReplyCountLabel } from '../FeedCardFooter/FeedCardFooterNew.utils';

interface FeedCardReplyButtonProps {
  count: number;
  showCount: boolean;
  pressProps: Pick<AriaButtonProps, 'onPress'>;
}

const FeedCardReplyButton = ({
  count,
  showCount,
  pressProps,
}: FeedCardReplyButtonProps) => {
  const { t } = useTranslation();

  // The labelled one (activity thread panels) is the Inbox's footer button.
  if (showCount) {
    return (
      <Button
        className={LABELLED_REPLY_CLASS}
        color="tertiary"
        data-testid="reply-button"
        iconLeading={<MessageDotsCircle data-icon data-testid="reply-count" />}
        size="sm"
        {...pressProps}>
        {getReplyCountLabel(count, t)}
      </Button>
    );
  }

  // link-gray: no hover background behind the icon, on any card surface.
  return (
    <Button
      aria-label={t('label.reply')}
      color="link-gray"
      data-testid="reply-button"
      iconLeading={Comment}
      size="xs"
      {...pressProps}
    />
  );
};

export default FeedCardReplyButton;
