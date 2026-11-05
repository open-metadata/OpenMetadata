/*
 *  Copyright 2023 Collate.
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
import { Box, ButtonUtility } from '@openmetadata/ui-core-components';
import { Edit01 } from '@openmetadata/ui-core-components/icons';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ExternalLinkIcon } from '../../../assets/svg/external-links.svg';
import { ReactComponent as UnlinkIcon } from '../../../assets/svg/ic-format-unlink.svg';

interface LinkPopupProps {
  href: string;
  handleLinkToggle: () => void;
  handleUnlink: () => void;
}

const LinkPopup: FC<LinkPopupProps> = ({
  href,
  handleLinkToggle,
  handleUnlink,
}) => {
  const { t } = useTranslation();
  const linkLabel = t('label.link');

  return (
    <Box inline className="link-popup" gap={2}>
      <ButtonUtility
        aria-label={t('label.edit-entity', { entity: linkLabel })}
        data-testid="link-popup-edit"
        icon={Edit01}
        size="lg"
        onClick={handleLinkToggle}
      />
      <ButtonUtility
        aria-label={t('label.open-in-new-tab')}
        data-testid="link-popup-open"
        href={href}
        icon={ExternalLinkIcon}
        rel="noopener noreferrer"
        size="lg"
        target="_blank"
      />
      <ButtonUtility
        aria-label={t('label.remove-entity', { entity: linkLabel })}
        data-testid="link-popup-unlink"
        icon={UnlinkIcon}
        size="lg"
        onClick={handleUnlink}
      />
    </Box>
  );
};

export default LinkPopup;
