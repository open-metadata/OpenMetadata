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
import { Typography } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useIsTextClamped } from '../../hooks/useIsTextClamped';

export interface LineageTableDescriptionProps {
  description: string;
  entityPath: string;
}

/**
 * Two-line description cell. A full description would widen the auto-layout
 * table and push the remaining columns off screen, so the overflow links to
 * the asset page instead of expanding in place.
 */
const LineageTableDescription = ({
  description,
  entityPath,
}: LineageTableDescriptionProps) => {
  const { t } = useTranslation();
  const { ref, isClamped } = useIsTextClamped<HTMLElement>(description);

  return (
    <div className="tw:max-w-120 tw:whitespace-normal">
      <Typography
        as="span"
        className="tw:line-clamp-2 tw:break-words"
        data-testid="impact-description"
        ref={ref}
        size="text-sm">
        {description}
      </Typography>
      {isClamped && (
        <Link data-testid="impact-description-view-more" to={entityPath}>
          {t('label.view-more')}
        </Link>
      )}
    </div>
  );
};

export default LineageTableDescription;
