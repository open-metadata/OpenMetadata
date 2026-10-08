/*
 *  Copyright 2022 Collate.
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
  Divider,
  Grid,
  Typography,
} from '@openmetadata/ui-core-components';
import { Card } from 'antd';
import { isEmpty } from 'lodash';
import { EntityTags } from 'Models';
import {
  Fragment,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../enums/entity.enum';
import { MlFeature, Mlmodel } from '../../../generated/entity/data/mlmodel';
import { TagSource } from '../../../generated/type/schema';
import { useFqn } from '../../../hooks/useFqn';
import { useFqnDeepLink } from '../../../hooks/useFqnDeepLink';
import { getLayoutGutter } from '../../../utils/common/layout.utils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getDerivedPermissionFlags } from '../../../utils/PermissionDerivation';
import { createTagObject } from '../../../utils/TagsPureUtils';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import { EntityAttachmentProvider } from '../../common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import TableDescription from '../../Database/TableDescription/TableDescription.component';
import TableTags from '../../Database/TableTags/TableTags.component';
import SourceList from './SourceList.component';
const ModalWithMarkdownEditor = withSuspenseFallback(
  lazy(() =>
    import('../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor').then(
      (m) => ({ default: m.ModalWithMarkdownEditor })
    )
  )
);

const MlModelFeaturesList = () => {
  const { t } = useTranslation();
  const [selectedFeature, setSelectedFeature] = useState<MlFeature>(
    {} as MlFeature
  );
  const [editDescription, setEditDescription] = useState<boolean>(false);
  const [_expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const {
    data,
    onUpdate,
    permissions,
    openColumnDetailPanel,
    selectedColumn,
    setDisplayedColumns,
  } = useGenericContext<Mlmodel>();

  // Extract base FQN and column part from URL
  const { columnFqn: columnPart, fqn } = useFqn({
    type: EntityType.MLMODEL,
  });
  const { mlFeatures, isDeleted, entityFqn } = useMemo(() => {
    return {
      mlFeatures: data?.mlFeatures,
      isDeleted: data?.deleted,
      entityFqn: data?.fullyQualifiedName ?? '',
    };
  }, [data]);

  // Use deep link hook to handle URL-based column selection
  useFqnDeepLink({
    data: mlFeatures || [],
    columnPart,
    fqn,
    setExpandedRowKeys: setExpandedRowKeys,
    openColumnDetailPanel,
    selectedColumn: selectedColumn as MlFeature | null,
  });

  // Sync displayed columns with GenericProvider for ColumnDetailPanel navigation
  useEffect(() => {
    setDisplayedColumns(mlFeatures || []);
  }, [mlFeatures, setDisplayedColumns]);

  // Ungated: isDeleted is threaded separately to each TableTags/TableDescription call as
  // `isReadOnly` below (SearchIndexFieldsTab.tsx/TopicSchema.tsx precedent), never folded
  // into these edit flags. Also an explicit-deny-wins fix, same precedent as canViewBasic
  // (Task 6 Finding 1): a field-specific deny now wins over a broader EditAll grant.
  const { canEditTags, canEditGlossaryTerms, canEditDescription } = useMemo(
    () => getDerivedPermissionFlags(permissions),
    [permissions]
  );

  const handleFeaturesUpdate = useCallback(
    async (features: MlFeature[]) => {
      await onUpdate({ ...data, mlFeatures: features });
    },
    [data, onUpdate]
  );

  const handleCancelEditDescription = () => {
    setSelectedFeature({});
    setEditDescription(false);
  };

  const handleDescriptionChange = async (value: string) => {
    if (!isEmpty(selectedFeature) && editDescription) {
      const updatedFeatures =
        mlFeatures?.map((feature) => {
          if (feature.name === selectedFeature.name) {
            return {
              ...selectedFeature,
              description: value,
            };
          } else {
            return feature;
          }
        }) ?? [];
      await handleFeaturesUpdate(updatedFeatures);
      handleCancelEditDescription();
    }
  };

  const handleTagsChange = async (
    selectedTags: EntityTags[],
    targetFeature: MlFeature
  ) => {
    const newSelectedTags = createTagObject(selectedTags);

    if (newSelectedTags && targetFeature) {
      const updatedFeatures =
        mlFeatures?.map((feature) => {
          if (feature.name === targetFeature?.name) {
            return {
              ...targetFeature,
              tags: newSelectedTags,
            };
          } else {
            return feature;
          }
        }) ?? [];
      await handleFeaturesUpdate(updatedFeatures);
    }
  };

  const handleColumnClick = useCallback(
    (feature: MlFeature, event: React.MouseEvent) => {
      const target = event.target as HTMLElement;
      const isExpandIcon = target.closest('.table-expand-icon') !== null;
      const isButton = target.closest('button') !== null;

      if (!isExpandIcon && !isButton) {
        openColumnDetailPanel(feature);
      }
    },
    [openColumnDetailPanel]
  );

  if (!isEmpty(mlFeatures)) {
    return (
      <Fragment>
        <Grid className="layout-row layout-grid" data-testid="feature-list">
          <Grid.Item className="layout-column" span={24}>
            <Divider className="m-y-md" />
          </Grid.Item>
          <Grid.Item className="layout-column" span={24}>
            <Typography
              as="h5"
              className="tw:mb-2!"
              size="text-md"
              weight="semibold">
              {t('label.feature-plural-used')}
            </Typography>
          </Grid.Item>

          {mlFeatures?.map((feature: MlFeature, index) => {
            return (
              <Grid.Item
                className="layout-column"
                key={feature.fullyQualifiedName}
                span={24}>
                <Card
                  className="m-b-lg shadow-none"
                  data-testid={`feature-card-${feature.name ?? ''}`}
                  key={feature.fullyQualifiedName}>
                  <Grid
                    className="layout-row layout-grid"
                    style={{ ...getLayoutGutter(0, 8) }}>
                    <Grid.Item className="layout-column" span={24}>
                      <Typography
                        className="font-semibold"
                        data-testid="column-name"
                        style={{
                          cursor: isDeleted ? 'default' : 'pointer',
                        }}
                        onClick={(event) => handleColumnClick(feature, event)}>
                        {feature.name}
                      </Typography>
                    </Grid.Item>
                    <Grid.Item className="layout-column" span={24}>
                      <Box
                        inline
                        align="start"
                        className="layout-space layout-space-horizontal"
                        gap={2}
                        itemClassName="layout-space-item">
                        <Box
                          inline
                          align="center"
                          className="layout-space layout-space-horizontal"
                          gap={2}
                          itemClassName="layout-space-item">
                          <Typography color="secondary">
                            {`${t('label.type')} :`}
                          </Typography>{' '}
                          <Typography>{feature.dataType || '--'}</Typography>
                        </Box>
                        <Divider
                          className="tw:mx-2 tw:mt-1 tw:h-[0.9em] tw:min-h-0"
                          orientation="vertical"
                        />
                        <Box
                          inline
                          align="center"
                          className="layout-space layout-space-horizontal"
                          gap={2}
                          itemClassName="layout-space-item">
                          <Typography color="secondary">
                            {`${t('label.algorithm')} :`}
                          </Typography>{' '}
                          <Typography>
                            {feature.featureAlgorithm || '--'}
                          </Typography>
                        </Box>
                      </Box>
                    </Grid.Item>

                    <Grid.Item className="layout-column" span={24}>
                      <Box
                        className="layout-row"
                        style={{ ...getLayoutGutter(8) }}
                        wrap="nowrap">
                        <Box
                          className="layout-column tw:block"
                          style={{ flex: '0 0 130px' }}>
                          <Typography color="secondary">
                            {`${t('label.glossary-term-plural')} :`}
                          </Typography>
                        </Box>

                        <Box
                          className="layout-column tw:block"
                          style={{ flex: 'auto' }}>
                          <TableTags<MlFeature>
                            entityFqn={entityFqn}
                            entityType={EntityType.MLMODEL}
                            handleTagSelection={handleTagsChange}
                            hasTagEditAccess={canEditTags}
                            index={index}
                            isReadOnly={isDeleted}
                            record={feature}
                            tags={feature.tags ?? []}
                            type={TagSource.Glossary}
                          />
                        </Box>
                      </Box>
                    </Grid.Item>

                    <Grid.Item className="layout-column" span={24}>
                      <Box
                        className="layout-row"
                        style={{ ...getLayoutGutter(8) }}
                        wrap="nowrap">
                        <Box
                          className="layout-column tw:block"
                          style={{ flex: '0 0 130px' }}>
                          <Typography color="secondary">
                            {`${t('label.tag-plural')} :`}
                          </Typography>
                        </Box>
                        <Box
                          className="layout-column tw:block"
                          style={{ flex: 'auto' }}>
                          <TableTags<MlFeature>
                            entityFqn={entityFqn}
                            entityType={EntityType.MLMODEL}
                            handleTagSelection={handleTagsChange}
                            hasTagEditAccess={canEditGlossaryTerms}
                            index={index}
                            isReadOnly={isDeleted}
                            record={feature}
                            tags={feature.tags ?? []}
                            type={TagSource.Classification}
                          />
                        </Box>
                      </Box>
                    </Grid.Item>

                    <Grid.Item className="layout-column m-t-xs" span={24}>
                      <Box
                        className="layout-row"
                        style={{ ...getLayoutGutter(8) }}
                        wrap="nowrap">
                        <Box
                          className="layout-column tw:block"
                          style={{ flex: '0 0 130px' }}>
                          <Typography color="secondary">
                            {`${t('label.description')} :`}
                          </Typography>
                        </Box>
                        <Box
                          className="layout-column tw:block"
                          style={{ flex: 'auto' }}>
                          <TableDescription
                            columnData={{
                              fqn: feature.fullyQualifiedName ?? '',
                              field: feature.description,
                            }}
                            entityFqn={entityFqn}
                            entityType={EntityType.MLMODEL}
                            hasEditPermission={canEditDescription}
                            index={index}
                            isReadOnly={isDeleted}
                            onClick={() => {
                              setSelectedFeature(feature);
                              setEditDescription(true);
                            }}
                          />
                        </Box>
                      </Box>
                    </Grid.Item>
                    <Grid.Item className="layout-column" span={24}>
                      <SourceList feature={feature} />
                    </Grid.Item>
                  </Grid>
                </Card>
              </Grid.Item>
            );
          })}
        </Grid>
        {!isEmpty(selectedFeature) && (
          <EntityAttachmentProvider
            entityFqn={selectedFeature.fullyQualifiedName}
            entityType={EntityType.MLMODEL}>
            <ModalWithMarkdownEditor
              header={t('label.edit-entity-name', {
                entityType: t('label.feature'),
                entityName: getEntityName(selectedFeature),
              })}
              placeholder={t('label.enter-field-description', {
                field: t('label.feature-lowercase'),
              })}
              value={selectedFeature.description as string}
              visible={editDescription}
              onCancel={handleCancelEditDescription}
              onSave={handleDescriptionChange}
            />
          </EntityAttachmentProvider>
        )}
      </Fragment>
    );
  } else {
    return (
      <ErrorPlaceHolder
        placeholderText={t('message.no-features-data-available')}
      />
    );
  }
};

export default MlModelFeaturesList;
