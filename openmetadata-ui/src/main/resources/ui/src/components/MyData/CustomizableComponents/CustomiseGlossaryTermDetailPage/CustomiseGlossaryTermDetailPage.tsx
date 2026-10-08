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

import { Box } from '@openmetadata/ui-core-components';
import { compare } from 'fast-json-patch';
import { kebabCase } from 'lodash';
import { lazy, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Page } from '../../../../generated/system/ui/page';
import { useCustomizeStore } from '../../../../hooks/useCustomizeStore';
import { useGridLayoutDirection } from '../../../../hooks/useGridLayoutDirection';
import '../../../../pages/MyDataPage/my-data.less';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import withSuspenseFallback from '../../../AppRouter/withSuspenseFallback';
import { NavigationBlocker } from '../../../common/NavigationBlocker/NavigationBlocker';
import PageLayoutV1 from '../../../PageLayoutV1/PageLayoutV1';
import { CustomizeMyDataProps } from '../CustomizeMyData/CustomizeMyData.interface';

const CustomizablePageHeader = withSuspenseFallback(
  lazy(() =>
    import('../CustomizablePageHeader/CustomizablePageHeader').then(
      (module) => ({ default: module.CustomizablePageHeader })
    )
  )
);

const CustomizeTabWidget = withSuspenseFallback(
  lazy(() =>
    import('../../../Customization/CustomizeTabWidget/CustomizeTabWidget').then(
      (module) => ({ default: module.CustomizeTabWidget })
    )
  )
);

const GlossaryHeaderWidget = withSuspenseFallback(
  lazy(() =>
    import('../../../Glossary/GlossaryHeader/GlossaryHeaderWidget').then(
      (module) => ({ default: module.GlossaryHeaderWidget })
    )
  )
);

function CustomizeGlossaryTermDetailPage({
  personaDetails,
  onSaveLayout,
  isGlossary,
}: Readonly<CustomizeMyDataProps>) {
  const { t } = useTranslation();
  const { currentPage, currentPageType, getPage } = useCustomizeStore();

  const handleReset = useCallback(async () => {
    await onSaveLayout();
  }, []);

  const handleSave = async () => {
    await onSaveLayout({
      ...(currentPage ?? ({ pageType: currentPageType } as Page)),
    });
  };

  // call the hook to set the direction of the grid layout
  useGridLayoutDirection();

  const disableSave = useMemo(() => {
    if (!currentPageType) {
      return true;
    }

    const originalPage =
      getPage(currentPageType) ?? ({ pageType: currentPageType } as Page);

    const editedPage = (currentPage ??
      ({ pageType: currentPageType } as Page)) as Page;

    const jsonPatch = compare(originalPage, editedPage);

    return jsonPatch.length === 0;
  }, [currentPage, currentPageType, getPage]);

  if (!currentPageType) {
    return null;
  }

  return (
    <NavigationBlocker enabled={!disableSave} onConfirm={handleSave}>
      <PageLayoutV1
        mainContainerClassName="p-t-0"
        pageTitle={t('label.customize-entity', {
          entity: t('label.' + kebabCase(currentPageType)),
        })}>
        <Box className="customize-details-page" direction="col" gap={5}>
          <CustomizablePageHeader
            disableSave={disableSave}
            personaName={getEntityName(personaDetails)}
            onReset={handleReset}
            onSave={handleSave}
          />
          <GlossaryHeaderWidget isGlossary={isGlossary} />
          {/* CustomizeTabWidget renders its own cols internally */}
          <CustomizeTabWidget />
        </Box>
      </PageLayoutV1>
    </NavigationBlocker>
  );
}

export default CustomizeGlossaryTermDetailPage;
