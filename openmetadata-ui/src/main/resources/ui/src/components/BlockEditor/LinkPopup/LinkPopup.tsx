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
import { Button } from '@openmetadata/ui-core-components';
import { Space } from 'antd';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as ExternalLinkIcon } from '../../../assets/svg/external-links.svg';
import { ReactComponent as UnlinkIcon } from '../../../assets/svg/ic-format-unlink.svg';

import { FC } from 'react';

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

  return (
    <Space className="link-popup">
      <Button
        aria-label={t('label.edit-entity', { entity: t('label.link') })}
        color="tertiary"
        data-testid="link-popup-edit"
        iconLeading={EditIcon}
        size="md"
        onClick={handleLinkToggle}
      />
      <Button
        boxed
        aria-label={t('label.open-in-new-tab')}
        color="link-color"
        data-testid="link-popup-open"
        href={href}
        iconLeading={ExternalLinkIcon}
        rel="noopener noreferrer"
        size="md"
        target="_blank"
      />
      <Button
        aria-label={t('label.remove-entity', { entity: t('label.link') })}
        color="tertiary"
        data-testid="link-popup-unlink"
        iconLeading={UnlinkIcon}
        size="md"
        onClick={handleUnlink}
      />
    </Space>
  );
};

export default LinkPopup;
