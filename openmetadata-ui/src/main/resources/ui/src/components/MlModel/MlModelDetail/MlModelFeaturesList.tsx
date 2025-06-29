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

import { Card, Col, Divider, Row, Space, Typography } from 'antd';
import { isEmpty } from 'lodash';
import { EntityTags } from 'Models';
import { Fragment, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../enums/entity.enum';
import { MlFeature, Mlmodel } from '../../../generated/entity/data/mlmodel';
import { TagSource } from '../../../generated/type/schema';
import { getEntityName } from '../../../utils/EntityUtils';
import { createTagObject } from '../../../utils/TagsUtils';
import { EntityAttachmentProvider } from '../../common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import TableDescription from '../../Database/TableDescription/TableDescription.component';
import TableTags from '../../Database/TableTags/TableTags.component';
import { ModalWithMarkdownEditor } from '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import SourceList from './SourceList.component';

const MlModelFeaturesList = () => {
  const { t } = useTranslation();
  const [selectedFeature, setSelectedFeature] = useState<MlFeature>(
    {} as MlFeature
  );
  const [editDescription, setEditDescription] = useState<boolean>(false);
  const { data, onUpdate, permissions } = useGenericContext<Mlmodel>();

  const { mlFeatures, isDeleted, entityFqn } = useMemo(() => {
    return {
      mlFeatures: data?.mlFeatures,
      isDeleted: data?.deleted,
      entityFqn: data?.fullyQualifiedName ?? '',
    };
  }, [data]);

  const hasEditPermission = useMemo(
    () => permissions.EditTags || permissions.EditAll,
    [permissions]
  );

  const hasEditGlossaryTermPermission = useMemo(
    () => permissions.EditGlossaryTerms || permissions.EditAll,
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

  if (!isEmpty(mlFeatures)) {
    return (
      <Fragment>
        <Row data-testid="feature-list">
          <Col span={24}>
            <Divider className="m-y-md" />
          </Col>
          <Col span={24}>
            <Typography.Title level={5}>
              {t('label.feature-plural-used')}
            </Typography.Title>
          </Col>

          {mlFeatures?.map((feature: MlFeature, index) => {
            return (
              <Col key={feature.fullyQualifiedName} span={24}>
                <Card
                  className="m-b-lg shadow-none"
                  data-testid={`feature-card-${feature.name ?? ''}`}
                  key={feature.fullyQualifiedName}>
                  <Row gutter={[0, 8]}>
                    <Col span={24}>
                      <Typography.Text className="font-semibold">
                        {feature.name}
                      </Typography.Text>
                    </Col>
                    <Col span={24}>
                      <Space align="start">
                        <Space>
                          <Typography.Text className="text-grey-muted">
                            {`${t('label.type')} :`}
                          </Typography.Text>{' '}
                          <Typography.Text>
                            {feature.dataType || '--'}
                          </Typography.Text>
                        </Space>
                        <Divider className="border-gray" type="vertical" />
                        <Space>
                          <Typography.Text className="text-grey-muted">
                            {`${t('label.algorithm')} :`}
                          </Typography.Text>{' '}
                          <Typography.Text>
                            {feature.featureAlgorithm || '--'}
                          </Typography.Text>
                        </Space>
                      </Space>
                    </Col>

                    <Col span={24}>
                      <Row gutter={8} wrap={false}>
                        <Col flex="130px">
                          <Typography.Text className="text-grey-muted">
                            {`${t('label.glossary-term-plural')} :`}
                          </Typography.Text>
                        </Col>

                        <Col flex="auto">
                          <TableTags<MlFeature>
                            entityFqn={entityFqn}
                            entityType={EntityType.MLMODEL}
                            handleTagSelection={handleTagsChange}
                            hasTagEditAccess={hasEditPermission}
                            index={index}
                            isReadOnly={isDeleted}
                            record={feature}
                            tags={feature.tags ?? []}
                            type={TagSource.Glossary}
                          />
                        </Col>
                      </Row>
                    </Col>

                    <Col span={24}>
                      <Row gutter={8} wrap={false}>
                        <Col flex="130px">
                          <Typography.Text className="text-grey-muted">
                            {`${t('label.tag-plural')} :`}
                          </Typography.Text>
                        </Col>
                        <Col flex="auto">
                          <TableTags<MlFeature>
                            entityFqn={entityFqn}
                            entityType={EntityType.MLMODEL}
                            handleTagSelection={handleTagsChange}
                            hasTagEditAccess={hasEditGlossaryTermPermission}
                            index={index}
                            isReadOnly={isDeleted}
                            record={feature}
                            tags={feature.tags ?? []}
                            type={TagSource.Classification}
                          />
                        </Col>
                      </Row>
                    </Col>

                    <Col className="m-t-xs" span={24}>
                      <Row gutter={8} wrap={false}>
                        <Col flex="130px">
                          <Typography.Text className="text-grey-muted">
                            {`${t('label.description')} :`}
                          </Typography.Text>
                        </Col>
                        <Col flex="auto">
                          <TableDescription
                            columnData={{
                              fqn: feature.fullyQualifiedName ?? '',
                              field: feature.description,
                            }}
                            entityFqn={entityFqn}
                            entityType={EntityType.MLMODEL}
                            hasEditPermission={
                              permissions.EditAll || permissions.EditDescription
                            }
                            index={index}
                            isReadOnly={isDeleted}
                            onClick={() => {
                              setSelectedFeature(feature);
                              setEditDescription(true);
                            }}
                          />
                        </Col>
                      </Row>
                    </Col>
                    <Col span={24}>
                      <SourceList feature={feature} />
                    </Col>
                  </Row>
                </Card>
              </Col>
            );
          })}
        </Row>
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
