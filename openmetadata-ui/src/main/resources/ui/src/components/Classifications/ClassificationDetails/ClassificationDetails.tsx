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
import { Button, Card, Col, Row, Space, Tooltip, Typography } from 'antd';
import ButtonGroup from 'antd/lib/button/button-group';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { capitalize, isEmpty, isUndefined, toString } from 'lodash';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as IconTag } from '../../../assets/svg/classification.svg';
import { ReactComponent as LockIcon } from '../../../assets/svg/closed-lock.svg';
import { ReactComponent as VersionIcon } from '../../../assets/svg/ic-version.svg';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { CustomizeEntityType } from '../../../constants/Customize.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType, TabSpecificField } from '../../../enums/entity.enum';
import { Classification } from '../../../generated/entity/classification/classification';
import { Tag } from '../../../generated/entity/classification/tag';
import { Operation } from '../../../generated/entity/policies/policy';
import { Paging } from '../../../generated/type/paging';
import { usePaging } from '../../../hooks/paging/usePaging';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useFqn } from '../../../hooks/useFqn';
import { getTags } from '../../../rest/tagAPI';
import {
  getClassificationExtraDropdownContent,
  getClassificationInfo,
  getTagsTableColumn,
} from '../../../utils/ClassificationUtils';
import { getEntityName } from '../../../utils/EntityUtils';
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
import { NextPreviousProps } from '../../common/NextPrevious/NextPrevious.interface';
import Table from '../../common/Table/Table';
import { GenericProvider } from '../../Customization/GenericProvider/GenericProvider';
import { DomainLabelV2 } from '../../DataAssets/DomainLabelV2/DomainLabelV2';
import { OwnerLabelV2 } from '../../DataAssets/OwnerLabelV2/OwnerLabelV2';
import EntityHeaderTitle from '../../Entity/EntityHeaderTitle/EntityHeaderTitle.component';
import './classification-details.less';
import { ClassificationDetailsProps } from './ClassificationDetails.interface';

const ClassificationDetails = forwardRef(
  (
    {
      currentClassification,
      handleAfterDeleteAction,
      classificationPermissions,
      handleUpdateClassification,
      handleEditTagClick,
      deleteTags,
      isAddingTag,
      handleActionDeleteTag,
      handleAddNewTagClick,
      disableEditButton,
      isVersionView = false,
    }: Readonly<ClassificationDetailsProps>,
    ref
  ) => {
    const { theme } = useApplicationStore();
    const { permissions } = usePermissionProvider();
    const { t } = useTranslation();
    const { fqn: tagCategoryName } = useFqn();
    const navigate = useNavigate();
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
          fields: TabSpecificField.USAGE_COUNT,
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

    const {
      currentVersion,
      isClassificationDisabled,
      name,
      displayName,
      description,
      isTier,
      isSystemClassification,
    } = useMemo(
      () => getClassificationInfo(currentClassification, isVersionView),
      [currentClassification, isVersionView]
    );

    const versionHandler = useCallback(() => {
      isVersionView
        ? navigate(getClassificationDetailsPath(tagCategoryName))
        : navigate(
            getClassificationVersionsPath(
              tagCategoryName,
              toString(currentVersion)
            )
          );
    }, [currentVersion, tagCategoryName]);

    const {
      editClassificationPermission,
      editDescriptionPermission,
      createPermission,
      deletePermission,
      editDisplayNamePermission,
    } = useMemo(
      () => ({
        editClassificationPermission: classificationPermissions.EditAll,
        editDescriptionPermission:
          !isVersionView &&
          !isClassificationDisabled &&
          (classificationPermissions.EditAll ||
            classificationPermissions.EditDescription),
        createPermission:
          !isVersionView &&
          (checkPermission(Operation.Create, ResourceEntity.TAG, permissions) ||
            classificationPermissions.EditAll),
        deletePermission:
          classificationPermissions.Delete && !isSystemClassification,
        editDisplayNamePermission:
          classificationPermissions.EditAll ||
          classificationPermissions.EditDisplayName,
      }),
      [
        permissions,
        classificationPermissions,
        isVersionView,
        isClassificationDisabled,
        isSystemClassification,
      ]
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

    const handleUpdateDisplayName = async (data: {
      name: string;
      displayName?: string;
    }) => {
      if (!isUndefined(currentClassification)) {
        return handleUpdateClassification?.({
          ...currentClassification,
          ...data,
        });
      }
    };

    const handleUpdateDescription = async (updatedHTML: string) => {
      if (!isUndefined(currentClassification)) {
        handleUpdateClassification?.({
          ...currentClassification,
          description: updatedHTML,
        });
      }
    };

    const handleEnableDisableClassificationClick = useCallback(() => {
      if (!isUndefined(currentClassification)) {
        handleUpdateClassification?.({
          ...currentClassification,
          disabled: !isClassificationDisabled,
        });
      }
    }, [
      currentClassification,
      handleUpdateClassification,
      isClassificationDisabled,
    ]);

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
      <div className="h-full overflow-y-auto" data-testid="tags-container">
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
                          bgColor={theme.primaryColor}
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
              <Space size={12}>
                {createPermission && (
                  <Tooltip title={addTagButtonToolTip}>
                    <Button
                      className="h-10"
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

                <ButtonGroup className="spaced" size="small">
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
                      displayName={getEntityName(currentClassification)}
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

        <GenericProvider<Classification>
          data={currentClassification as Classification}
          isVersionView={isVersionView}
          permissions={classificationPermissions}
          type={EntityType.CLASSIFICATION as CustomizeEntityType}
          onUpdate={(updatedData: Classification) =>
            Promise.resolve(handleUpdateClassification?.(updatedData))
          }>
          <Row className="m-t-md" gutter={16}>
            <Col span={18}>
              <Card className="classification-details-card">
                <div className="m-b-sm" data-testid="description-container">
                  <DescriptionV1
                    wrapInCard
                    className={classNames({
                      'opacity-60': isClassificationDisabled,
                    })}
                    description={description}
                    entityName={getEntityName(currentClassification)}
                    entityType={EntityType.CLASSIFICATION}
                    hasEditAccess={editDescriptionPermission}
                    isDescriptionExpanded={isEmpty(tags)}
                    showCommentsIcon={false}
                    onDescriptionUpdate={handleUpdateDescription}
                  />
                </div>

                <Table
                  className={classNames({
                    'opacity-60': isClassificationDisabled,
                  })}
                  columns={tableColumn}
                  customPaginationProps={{
                    currentPage,
                    isLoading: isTagsLoading,
                    pageSize,
                    paging,
                    showPagination,
                    pagingHandler: handleTagsPageChange,
                    onShowSizeChange: handlePageSizeChange,
                  }}
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
                  rowClassName={(record) =>
                    record.disabled ? 'opacity-60' : ''
                  }
                  rowKey="id"
                  scroll={{ x: true }}
                  size="small"
                />
              </Card>
            </Col>
            <Col span={6}>
              <div className="d-flex flex-column gap-5">
                <DomainLabelV2 multiple showDomainHeading />
                <OwnerLabelV2 dataTestId="classification-owner-name" />
              </div>
            </Col>
          </Row>
        </GenericProvider>
      </div>
    );
  }
);

export default ClassificationDetails;
