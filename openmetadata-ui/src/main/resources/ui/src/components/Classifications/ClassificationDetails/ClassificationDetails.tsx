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
import Icon from '@ant-design/icons/lib/components/Icon';
import { Button, Col, Row, Space, Tooltip, Typography } from 'antd';
import ButtonGroup from 'antd/lib/button/button-group';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { capitalize, isUndefined, toString } from 'lodash';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { ReactComponent as IconTag } from '../../../assets/svg/classification.svg';
import { ReactComponent as LockIcon } from '../../../assets/svg/closed-lock.svg';
import { ReactComponent as VersionIcon } from '../../../assets/svg/ic-version.svg';
import { DE_ACTIVE_COLOR, PRIMERY_COLOR } from '../../../constants/constants';
import { EntityField } from '../../../constants/Feeds.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../../enums/entity.enum';
import { ProviderType } from '../../../generated/api/classification/createClassification';
import { ChangeDescription } from '../../../generated/entity/classification/classification';
import { Tag } from '../../../generated/entity/classification/tag';
import { Operation } from '../../../generated/entity/policies/policy';
import { Paging } from '../../../generated/type/paging';
import { usePaging } from '../../../hooks/paging/usePaging';
import { useFqn } from '../../../hooks/useFqn';
import { getTags } from '../../../rest/tagAPI';
import {
  getClassificationExtraDropdownContent,
  getTagsTableColumn,
} from '../../../utils/ClassificationUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { getEntityVersionByField } from '../../../utils/EntityVersionUtils';
import { checkPermission } from '../../../utils/PermissionsUtils';
import {
  getClassificationDetailsPath,
  getClassificationVersionsPath,
} from '../../../utils/RouterUtils';
import { getErrorText } from '../../../utils/StringsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import AppBadge from '../../common/Badge/Badge.component';
import DescriptionV1 from '../../common/EntityDescription/DescriptionV1';
import ManageButton from '../../common/EntityPageInfos/ManageButton/ManageButton';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import NextPrevious from '../../common/NextPrevious/NextPrevious';
import { NextPreviousProps } from '../../common/NextPrevious/NextPrevious.interface';
import Table from '../../common/Table/Table';
import EntityHeaderTitle from '../../Entity/EntityHeaderTitle/EntityHeaderTitle.component';
import { ClassificationDetailsProps } from './ClassificationDetails.interface';

const ClassificationDetails = forwardRef(
  (
    {
      currentClassification,
      handleAfterDeleteAction,
      isEditClassification,
      classificationPermissions,
      handleUpdateClassification,
      handleEditTagClick,
      deleteTags,
      isAddingTag,
      handleActionDeleteTag,
      handleAddNewTagClick,
      handleEditDescriptionClick,
      handleCancelEditDescription,
      disableEditButton,

      isVersionView = false,
    }: Readonly<ClassificationDetailsProps>,
    ref
  ) => {
    const { permissions } = usePermissionProvider();
    const { t } = useTranslation();
    const { fqn: tagCategoryName } = useFqn();
    const history = useHistory();
    const [tags, setTags] = useState<Tag[]>([]);
    const [isTagsLoading, setIsTagsLoading] = useState(false);

    const {
      currentPage,
      paging,
      pageSize,
      handlePageChange,
      handlePageSizeChange,
      handlePagingChange,
      showPagination,
    } = usePaging();

    const fetchClassificationChildren = async (
      currentClassificationName: string,
      paging?: Partial<Paging>
    ) => {
      setIsTagsLoading(true);
      setTags([]);
      try {
        const { data, paging: tagPaging } = await getTags({
          fields: 'usageCount',
          parent: currentClassificationName,
          after: paging?.after,
          before: paging?.before,
          limit: pageSize,
        });
        setTags(data);
        handlePagingChange(tagPaging);
      } catch (error) {
        const errMsg = getErrorText(
          error as AxiosError,
          t('server.entity-fetch-error', { entity: t('label.tag-plural') })
        );
        showErrorToast(errMsg);
        setTags([]);
      } finally {
        setIsTagsLoading(false);
      }
    };

    const handleTagsPageChange: NextPreviousProps['pagingHandler'] = ({
      currentPage,
      cursorType,
    }) => {
      if (cursorType) {
        fetchClassificationChildren(
          currentClassification?.fullyQualifiedName ?? '',
          {
            [cursorType]: paging[cursorType],
          }
        );
      }
      handlePageChange(currentPage);
    };

    const currentVersion = useMemo(
      () => currentClassification?.version ?? '0.1',
      [currentClassification]
    );

    const changeDescription = useMemo(
      () =>
        currentClassification?.changeDescription ?? ({} as ChangeDescription),
      [currentClassification]
    );

    const versionHandler = useCallback(() => {
      isVersionView
        ? history.push(getClassificationDetailsPath(tagCategoryName))
        : history.push(
            getClassificationVersionsPath(
              tagCategoryName,
              toString(currentVersion)
            )
          );
    }, [currentVersion, tagCategoryName]);

    const isTier = useMemo(
      () => currentClassification?.name === 'Tier',
      [currentClassification]
    );

    const createTagPermission = useMemo(
      () =>
        checkPermission(Operation.Create, ResourceEntity.TAG, permissions) ||
        classificationPermissions.EditAll,
      [permissions, classificationPermissions]
    );

    const editClassificationPermission = useMemo(
      () => classificationPermissions.EditAll,
      [classificationPermissions]
    );

    const isClassificationDisabled = useMemo(
      () => currentClassification?.disabled ?? false,
      [currentClassification?.disabled]
    );

    const handleUpdateDisplayName = async (data: {
      name: string;
      displayName: string;
    }) => {
      if (
        !isUndefined(currentClassification) &&
        !isUndefined(handleUpdateClassification)
      ) {
        return handleUpdateClassification({
          ...currentClassification,
          ...data,
        });
      }
    };

    const handleUpdateDescription = async (updatedHTML: string) => {
      if (
        !isUndefined(currentClassification) &&
        !isUndefined(handleUpdateClassification)
      ) {
        handleUpdateClassification({
          ...currentClassification,
          description: updatedHTML,
        });
      }
    };

    const handleEnableDisableClassificationClick = useCallback(() => {
      if (
        !isUndefined(currentClassification) &&
        !isUndefined(handleUpdateClassification)
      ) {
        handleUpdateClassification({
          ...currentClassification,
          disabled: !isClassificationDisabled,
        });
      }
    }, [
      currentClassification,
      handleUpdateClassification,
      isClassificationDisabled,
    ]);

    const editDescriptionPermission = useMemo(
      () =>
        !isVersionView &&
        !isClassificationDisabled &&
        (classificationPermissions.EditAll ||
          classificationPermissions.EditDescription),
      [classificationPermissions, isVersionView]
    );

    const isSystemClassification = useMemo(
      () => currentClassification?.provider === ProviderType.System,
      [currentClassification]
    );

    const headerBadge = useMemo(
      () =>
        isSystemClassification ? (
          <AppBadge
            icon={<LockIcon height={12} />}
            label={capitalize(currentClassification?.provider)}
          />
        ) : null,
      [isSystemClassification, currentClassification]
    );

    const createPermission = useMemo(
      () =>
        !isVersionView &&
        (createTagPermission || classificationPermissions.EditAll),
      [classificationPermissions, createTagPermission, isVersionView]
    );

    const deletePermission = useMemo(
      () => classificationPermissions.Delete && !isSystemClassification,
      [classificationPermissions, isSystemClassification]
    );

    const editDisplayNamePermission = useMemo(
      () =>
        classificationPermissions.EditAll ||
        classificationPermissions.EditDisplayName,
      [classificationPermissions]
    );

    const showDisableOption = useMemo(
      () => !isTier && isSystemClassification && editClassificationPermission,
      [isTier, isSystemClassification, editClassificationPermission]
    );

    const showManageButton = useMemo(
      () =>
        !isVersionView &&
        (editDisplayNamePermission || deletePermission || showDisableOption),
      [
        editDisplayNamePermission,
        deletePermission,
        showDisableOption,
        isVersionView,
      ]
    );

    const addTagButtonToolTip = useMemo(() => {
      if (isClassificationDisabled) {
        return t('message.disabled-classification-actions-message');
      }
      if (!createPermission) {
        return t('message.no-permission-for-action');
      }

      return null;
    }, [createPermission, isClassificationDisabled]);

    const tableColumn: ColumnsType<Tag> = useMemo(
      () =>
        getTagsTableColumn({
          isClassificationDisabled,
          classificationPermissions,
          deleteTags,
          disableEditButton,
          handleEditTagClick,
          handleActionDeleteTag,
          isVersionView,
        }),
      [
        isClassificationDisabled,
        classificationPermissions,
        deleteTags,
        disableEditButton,
        handleEditTagClick,
        handleActionDeleteTag,
        isVersionView,
      ]
    );

    const extraDropdownContent = useMemo(
      () =>
        getClassificationExtraDropdownContent(
          showDisableOption,
          isClassificationDisabled,
          handleEnableDisableClassificationClick
        ),
      [
        isClassificationDisabled,
        showDisableOption,
        handleEnableDisableClassificationClick,
      ]
    );

    const name = useMemo(() => {
      return isVersionView
        ? getEntityVersionByField(
            changeDescription,
            EntityField.NAME,
            currentClassification?.name
          )
        : currentClassification?.name;
    }, [currentClassification, changeDescription]);

    const displayName = useMemo(() => {
      return isVersionView
        ? getEntityVersionByField(
            changeDescription,
            EntityField.DISPLAYNAME,
            currentClassification?.displayName
          )
        : currentClassification?.displayName;
    }, [currentClassification, changeDescription]);

    const description = useMemo(() => {
      return isVersionView
        ? getEntityVersionByField(
            changeDescription,
            EntityField.DESCRIPTION,
            currentClassification?.description
          )
        : currentClassification?.description;
    }, [currentClassification, changeDescription]);

    useEffect(() => {
      if (currentClassification?.fullyQualifiedName && !isAddingTag) {
        fetchClassificationChildren(currentClassification.fullyQualifiedName);
      }
    }, [currentClassification?.fullyQualifiedName, pageSize]);

    useImperativeHandle(ref, () => ({
      refreshClassificationTags() {
        if (currentClassification?.fullyQualifiedName) {
          fetchClassificationChildren(currentClassification.fullyQualifiedName);
        }
      },
    }));

    return (
      <div className="p-x-md" data-testid="tags-container">
        {currentClassification && (
          <Row data-testid="header" wrap={false}>
            <Col flex="auto">
              <EntityHeaderTitle
                badge={
                  <div className="d-flex gap-1">
                    {headerBadge}
                    {currentClassification?.mutuallyExclusive && (
                      <div data-testid="mutually-exclusive-container">
                        <AppBadge
                          bgColor={PRIMERY_COLOR}
                          label={t('label.mutually-exclusive')}
                        />
                      </div>
                    )}
                  </div>
                }
                className={classNames({
                  'opacity-60': isClassificationDisabled,
                })}
                displayName={displayName}
                icon={
                  <IconTag className="h-9" style={{ color: DE_ACTIVE_COLOR }} />
                }
                isDisabled={isClassificationDisabled}
                name={name ?? currentClassification.name}
                serviceName="classification"
              />
            </Col>

            <Col className="d-flex justify-end items-start" flex="270px">
              <Space>
                {createPermission && (
                  <Tooltip title={addTagButtonToolTip}>
                    <Button
                      data-testid="add-new-tag-button"
                      disabled={isClassificationDisabled}
                      type="primary"
                      onClick={handleAddNewTagClick}>
                      {t('label.add-entity', {
                        entity: t('label.tag'),
                      })}
                    </Button>
                  </Tooltip>
                )}

                <ButtonGroup size="small">
                  <Tooltip
                    title={t(
                      `label.${
                        isVersionView
                          ? 'exit-version-history'
                          : 'version-plural-history'
                      }`
                    )}>
                    <Button
                      className="w-16 p-0"
                      data-testid="version-button"
                      icon={<Icon component={VersionIcon} />}
                      onClick={versionHandler}>
                      <Typography.Text>{currentVersion}</Typography.Text>
                    </Button>
                  </Tooltip>
                  {showManageButton && (
                    <ManageButton
                      isRecursiveDelete
                      afterDeleteAction={handleAfterDeleteAction}
                      allowRename={!isSystemClassification}
                      allowSoftDelete={false}
                      canDelete={deletePermission && !isClassificationDisabled}
                      displayName={
                        currentClassification.displayName ??
                        currentClassification.name
                      }
                      editDisplayNamePermission={
                        editDisplayNamePermission && !isClassificationDisabled
                      }
                      entityFQN={currentClassification.fullyQualifiedName}
                      entityId={currentClassification.id}
                      entityName={currentClassification.name}
                      entityType={EntityType.CLASSIFICATION}
                      extraDropdownContent={extraDropdownContent}
                      onEditDisplayName={handleUpdateDisplayName}
                    />
                  )}
                </ButtonGroup>
              </Space>
            </Col>
          </Row>
        )}

        <div className="m-b-sm m-t-xs" data-testid="description-container">
          <DescriptionV1
            className={classNames({
              'opacity-60': isClassificationDisabled,
            })}
            description={description}
            entityName={getEntityName(currentClassification)}
            entityType={EntityType.CLASSIFICATION}
            hasEditAccess={editDescriptionPermission}
            isEdit={isEditClassification}
            showCommentsIcon={false}
            onCancel={handleCancelEditDescription}
            onDescriptionEdit={handleEditDescriptionClick}
            onDescriptionUpdate={handleUpdateDescription}
          />
        </div>

        <Space className="w-full m-b-md" direction="vertical" size="large">
          <Table
            bordered
            className={classNames({
              'opacity-60': isClassificationDisabled,
            })}
            columns={tableColumn}
            data-testid="table"
            dataSource={tags}
            loading={isTagsLoading}
            locale={{
              emptyText: (
                <ErrorPlaceHolder
                  className="m-y-md"
                  placeholderText={t('message.no-tags-description')}
                />
              ),
            }}
            pagination={false}
            rowClassName={(record) => (record.disabled ? 'opacity-60' : '')}
            rowKey="id"
            size="small"
          />

          {showPagination && !isTagsLoading && (
            <NextPrevious
              currentPage={currentPage}
              pageSize={pageSize}
              paging={paging}
              pagingHandler={handleTagsPageChange}
              onShowSizeChange={handlePageSizeChange}
            />
          )}
        </Space>
      </div>
    );
  }
);

export default ClassificationDetails;
