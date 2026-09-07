/*
 *  Copyright 2025 Collate.
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

import { Box, Typography } from '@openmetadata/ui-core-components';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import EntitySummaryPanel from '../../../../../components/Explore/EntitySummaryPanel/EntitySummaryPanel.component';
import { EntityDetailsObjectInterface } from '../../../../../components/Explore/ExplorePage.interface';
import AssetsTabs from '../../../../../components/Glossary/GlossaryTerms/tabs/AssetsTabs.component';
import { AssetsOfEntity } from '../../../../../components/Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import { ROUTES } from '../../../../../constants/constants';
import { User } from '../../../../../generated/entity/teams/user';
import { DEFAULT_ENTITY_PERMISSION } from '../../../../../utils/PermissionsUtils';
import { getTermQuery } from '../../../../../utils/SearchPureUtils';

interface MyDataAssetsListProps {
  userData?: User;
}

const MyDataAssetsList: React.FC<MyDataAssetsListProps> = ({ userData }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [previewAsset, setPreviewAsset] =
    useState<EntityDetailsObjectInterface>();

  // Stable key keeps queryFilter's ref steady so AssetsTabs doesn't refetch
  // when userData is replaced with identical content.
  const ownerIdsKey = useMemo(() => {
    const teamIds = (userData?.teams ?? []).map((tm) => tm.id);

    return [userData?.id, ...teamIds].filter(Boolean).sort().join(',');
  }, [userData?.id, userData?.teams]);

  const queryFilter = useMemo(
    () =>
      getTermQuery(
        { 'owners.id': ownerIdsKey.split(',').filter(Boolean) },
        'should',
        1
      ),
    [ownerIdsKey]
  );

  return (
    <Box
      className="ai-mydata-assets tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:overflow-hidden tw:rounded-[10px] tw:border tw:border-secondary"
      data-testid="my-data-assets"
      direction="col">
      <Box className="tw:grid tw:min-h-0 tw:flex-1 tw:grid-cols-[1fr_1fr]">
        <div className="tw:h-full tw:overflow-y-auto tw:border-r tw:border-utility-gray-blue-100 tw:[&_.assets-tab-container]:p-4">
          <AssetsTabs
            isSummaryPanelOpen={Boolean(previewAsset)}
            noDataPlaceholder={{
              message: t('label.no-entity-found', {
                entity: t('label.asset-plural'),
              }),
            }}
            permissions={{ ...DEFAULT_ENTITY_PERMISSION, Create: true }}
            queryFilter={queryFilter}
            type={AssetsOfEntity.MY_DATA}
            onAddAsset={() => navigate(ROUTES.EXPLORE)}
            onAssetClick={setPreviewAsset}
          />
        </div>

        <Box className="tw:h-full tw:w-full tw:overflow-y-auto" direction="col">
          {previewAsset ? (
            <EntitySummaryPanel
              entityDetails={previewAsset}
              handleClosePanel={() => setPreviewAsset(undefined)}
            />
          ) : (
            <Box
              align="center"
              className="tw:w-full tw:justify-center tw:py-16">
              <Typography className="tw:text-secondary">
                {t('label.no-entity-found', {
                  entity: t('label.asset-plural'),
                })}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default MyDataAssetsList;
