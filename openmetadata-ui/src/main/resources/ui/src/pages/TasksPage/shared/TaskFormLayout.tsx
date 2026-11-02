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

import {
  Box,
  Button,
  Card,
  HookForm,
  Typography,
} from '@openmetadata/ui-core-components';
import { FormEvent, ReactNode } from 'react';
import { FieldValues, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import ExploreSearchCard from '../../../components/ExploreV1/ExploreSearchCard/ExploreSearchCard';
import { SearchedDataProps } from '../../../components/SearchedData/SearchedData.interface';
import { EntityType } from '../../../enums/entity.enum';
import { getBreadCrumbList } from '../../../utils/TaskEntityFetchUtils';
import { EntityData } from '../TasksPage.interface';

interface TaskFormLayoutProps<T extends FieldValues> {
  entityData: EntityData;
  entityType: EntityType;
  form: UseFormReturn<T>;
  onSubmit: (e?: FormEvent) => void;
  isLoading: boolean;
  submitLabel: string;
  submitTestId: string;
  children: ReactNode;
}

const TaskFormLayout = <T extends FieldValues>({
  entityData,
  entityType,
  form,
  onSubmit,
  isLoading,
  submitLabel,
  submitTestId,
  children,
}: TaskFormLayoutProps<T>) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createTaskLabel = t('label.create-entity', { entity: t('label.task') });

  return (
    <Box className="tw:mx-auto tw:w-full tw:max-w-7xl" direction="col" gap={6}>
      <Box direction="col" gap={1}>
        <TitleBreadcrumb
          titleLinks={[
            ...getBreadCrumbList(entityData, entityType),
            { name: createTaskLabel, activeTitle: true, url: '' },
          ]}
        />
        {/* not-prose: Typography wraps headings in .prose, whose h1 style
            (30px, margins) would otherwise outrank the size prop. */}
        <Typography
          as="h1"
          className="not-prose tw:m-0"
          data-testid="form-title"
          size="text-lg"
          weight="semibold">
          {createTaskLabel}
        </Typography>
      </Box>

      <div className="tw:grid tw:grid-cols-1 tw:items-start tw:gap-6 tw:lg:grid-cols-3">
        <HookForm
          className="tw:lg:col-span-2"
          data-testid="form-container"
          form={form}
          onSubmit={onSubmit}>
          <Card>
            <Card.Header
              title={t('label.task-entity', { entity: t('label.details') })}
            />
            <Card.Content className="tw:flex tw:flex-col tw:gap-6">
              {children}
            </Card.Content>
            <Card.Footer>
              <Box data-testid="cta-buttons" gap={3} justify="end">
                <Button
                  color="secondary"
                  data-testid="cancel-btn"
                  onPress={() => navigate(-1)}>
                  {t('label.back')}
                </Button>
                <Button
                  data-testid={submitTestId}
                  isLoading={isLoading}
                  type="submit">
                  {submitLabel}
                </Button>
              </Box>
            </Card.Footer>
          </Card>
        </HookForm>

        <aside className="tw:lg:sticky tw:lg:top-0">
          <ExploreSearchCard
            hideBreadcrumbs
            showTags
            id={entityData.id ?? ''}
            source={
              {
                ...entityData,
                entityType,
              } as SearchedDataProps['data'][number]['_source']
            }
          />
        </aside>
      </div>
    </Box>
  );
};

export default TaskFormLayout;
