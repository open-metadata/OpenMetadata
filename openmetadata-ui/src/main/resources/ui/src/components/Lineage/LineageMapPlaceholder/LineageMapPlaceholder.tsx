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
import { PlatformLineage } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import { LineageScene } from '../../../generated/api/lineage/lineageScene';
import NoDataPlaceholder from '../../common/EmptyPlaceholder/NoDataPlaceholder';
import SomethingWentWrongPlaceholder from '../../common/EmptyPlaceholder/SomethingWentWrongPlaceholder';
import LineageSkeleton from '../LineageSkeleton.component';

interface LineageMapPlaceholderProps {
  scene?: LineageScene;
  loading: boolean;
  error?: AxiosError;
  onRetry: () => void;
}

const LineageMapPlaceholder = ({
  scene,
  loading,
  error,
  onRetry,
}: LineageMapPlaceholderProps) => {
  const { t } = useTranslation();
  if (loading && !scene) {
    return <LineageSkeleton />;
  }

  // EmptyPlaceholder fills its nearest positioned ancestor; this wrapper keeps
  // it to the canvas rather than the card that also holds the toolbar.
  return (
    <div className="tw:relative tw:h-full tw:w-full">
      {error && !scene ? (
        <SomethingWentWrongPlaceholder onReload={onRetry} />
      ) : (
        <NoDataPlaceholder
          description={t('message.no-lineage-data-available')}
          icon={<PlatformLineage className="tw:text-secondary" />}
        />
      )}
    </div>
  );
};

export default LineageMapPlaceholder;
