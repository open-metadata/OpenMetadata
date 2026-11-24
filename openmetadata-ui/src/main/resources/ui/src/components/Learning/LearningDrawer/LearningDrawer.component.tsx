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

import {
  Box,
  CloseButton,
  SlideoutMenu,
  Typography,
} from '@openmetadata/ui-core-components';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getLearningResourcesByContext,
  LearningResource,
} from '../../../rest/learningResourceAPI';
import {
  opensInNewTab,
  openUrlInNewTab,
} from '../../../utils/platform/learning.utils';
import NoDataPlaceholder from '../../common/EmptyPlaceholder/NoDataPlaceholder';
import SomethingWentWrongPlaceholder from '../../common/EmptyPlaceholder/SomethingWentWrongPlaceholder';
import Loader from '../../common/Loader/Loader';
import { LearningResourceCard } from '../LearningResourceCard/LearningResourceCard.component';
import { ResourcePlayerModal } from '../ResourcePlayer/ResourcePlayerModal.component';
import { LearningDrawerProps } from './LearningDrawer.interface';

export const LearningDrawer: React.FC<LearningDrawerProps> = ({
  open,
  pageId,
  title,
  onClose,
}) => {
  const { t } = useTranslation();
  const [resources, setResources] = useState<LearningResource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [selectedResource, setSelectedResource] =
    useState<LearningResource | null>(null);
  const [playerOpen, setPlayerOpen] = useState(false);

  const fetchResources = useCallback(async () => {
    if (!open || !pageId) {
      return;
    }

    setIsLoading(true);
    setHasError(false);
    try {
      const response = await getLearningResourcesByContext(pageId, {
        limit: 50,
        fields: 'categories,contexts,difficulty,estimatedDuration',
      });
      setResources(response.data || []);
    } catch {
      setHasError(true);
      setResources([]);
    } finally {
      setIsLoading(false);
    }
  }, [open, pageId]);

  useEffect(() => {
    if (open) {
      fetchResources();
    }
  }, [open, fetchResources]);

  const handleResourceClick = useCallback(
    (resource: LearningResource) => {
      if (opensInNewTab(resource.resourceType)) {
        openUrlInNewTab(resource.source.url);

        return;
      }
      setSelectedResource(resource);
      setPlayerOpen(true);
      onClose();
    },
    [onClose]
  );

  const handlePlayerClose = useCallback(() => {
    setPlayerOpen(false);
    setSelectedResource(null);
  }, []);

  const getPageTitle = useCallback(() => {
    if (title) {
      return title;
    }

    const titleMap: Record<string, string> = {
      glossary: t('label.glossary'),
      glossaryTerm: t('label.glossary-term'),
      domain: t('label.domain'),
      dataProduct: t('label.data-product'),
      dataQuality: t('label.data-quality'),
    };

    return titleMap[pageId] || pageId;
  }, [pageId, title, t]);

  let drawerContent: React.ReactNode;
  if (isLoading) {
    drawerContent = (
      <Box align="center" className="tw:h-50" justify="center">
        <Loader />
      </Box>
    );
  } else if (hasError) {
    drawerContent = (
      <Box className="tw:relative tw:min-h-80">
        <SomethingWentWrongPlaceholder
          description={t('message.failed-to-load-learning-resources')}
        />
      </Box>
    );
  } else if (resources.length === 0) {
    drawerContent = (
      <Box className="tw:relative tw:min-h-80">
        <NoDataPlaceholder
          description={t('message.no-learning-resources-available')}
        />
      </Box>
    );
  } else {
    drawerContent = (
      <Box direction="col" gap={3}>
        {resources.map((resource) => (
          <LearningResourceCard
            key={resource.id}
            resource={resource}
            onClick={handleResourceClick}
          />
        ))}
      </Box>
    );
  }

  return (
    <>
      <SlideoutMenu
        isDismissable
        data-testid="learning-drawer"
        dialogClassName="tw:gap-0"
        isOpen={open}
        width={576}
        onOpenChange={(isOpen) => !isOpen && onClose()}>
        <header className="tw:w-full tw:border-b tw:border-secondary tw:px-6 tw:py-4">
          <Box align="center" justify="between">
            <Typography
              as="h5"
              className="tw:m-0 tw:text-primary"
              size="text-md"
              weight="semibold">
              {t('label.entity-resource', { entity: getPageTitle() })}
            </Typography>
            <CloseButton
              data-testid="close-drawer"
              size="sm"
              onPress={onClose}
            />
          </Box>
        </header>
        <SlideoutMenu.Content className="tw:h-auto tw:min-h-0 tw:flex-1 tw:gap-0 tw:bg-secondary tw:p-4 tw:md:px-4">
          {drawerContent}
        </SlideoutMenu.Content>
      </SlideoutMenu>

      {selectedResource && (
        <ResourcePlayerModal
          open={playerOpen}
          resource={selectedResource}
          onClose={handlePlayerClose}
        />
      )}
    </>
  );
};
