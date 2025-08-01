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
import Icon, { DownOutlined } from '@ant-design/icons';
import { Button, Dropdown, Space, Tooltip, Typography } from 'antd';
import ButtonGroup from 'antd/lib/button/button-group';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { cloneDeep, isEmpty, toString } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as IconTerm } from '../../../assets/svg/book.svg';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as GlossaryIcon } from '../../../assets/svg/glossary.svg';
import { ReactComponent as ChangeHierarchyIcon } from '../../../assets/svg/ic-change-hierarchy.svg';
import { ReactComponent as IconDelete } from '../../../assets/svg/ic-delete.svg';
import { ReactComponent as ExportIcon } from '../../../assets/svg/ic-export.svg';
import { ReactComponent as ImportIcon } from '../../../assets/svg/ic-import.svg';
import { ReactComponent as VersionIcon } from '../../../assets/svg/ic-version.svg';
import { ReactComponent as IconDropdown } from '../../../assets/svg/menu.svg';
import { ReactComponent as StyleIcon } from '../../../assets/svg/style.svg';
import { ManageButtonItemLabel } from '../../../components/common/ManageButtonContentItem/ManageButtonContentItem.component';
import { useEntityExportModalProvider } from '../../../components/Entity/EntityExportModalProvider/EntityExportModalProvider.component';
import { EntityHeader } from '../../../components/Entity/EntityHeader/EntityHeader.component';
import EntityDeleteModal from '../../../components/Modals/EntityDeleteModal/EntityDeleteModal';
import EntityNameModal from '../../../components/Modals/EntityNameModal/EntityNameModal.component';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { ExportTypes } from '../../../constants/Export.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../../enums/entity.enum';
import { Glossary } from '../../../generated/entity/data/glossary';
import {
  GlossaryTerm,
  Status,
} from '../../../generated/entity/data/glossaryTerm';
import { Operation } from '../../../generated/entity/policies/policy';
import { Style } from '../../../generated/type/tagLabel';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useFqn } from '../../../hooks/useFqn';
import {
  exportGlossaryInCSVFormat,
  getGlossariesById,
  getGlossaryTermsById,
} from '../../../rest/glossaryAPI';
import { getEntityDeleteMessage } from '../../../utils/CommonUtils';
import {
  getEntityImportPath,
  getEntityVoteStatus,
} from '../../../utils/EntityUtils';
import Fqn from '../../../utils/Fqn';
import { checkPermission } from '../../../utils/PermissionsUtils';
import {
  getGlossaryPath,
  getGlossaryTermsVersionsPath,
  getGlossaryVersionsPath,
} from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import { TitleBreadcrumbProps } from '../../common/TitleBreadcrumb/TitleBreadcrumb.interface';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import Voting from '../../Entity/Voting/Voting.component';
import ChangeParentHierarchy from '../../Modals/ChangeParentHierarchy/ChangeParentHierarchy.component';
import StyleModal from '../../Modals/StyleModal/StyleModal.component';
import { GlossaryStatusBadge } from '../GlossaryStatusBadge/GlossaryStatusBadge.component';
import { GlossaryHeaderProps } from './GlossaryHeader.interface';
import './glossery-header.less';
const GlossaryHeader = ({
  onDelete,
  onAssetAdd,
  onAddGlossaryTerm,
  updateVote,
}: GlossaryHeaderProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { fqn } = useFqn();
  const { currentUser } = useApplicationStore();
  const {
    onUpdate,
    data: selectedData,
    isVersionView,
    permissions,
    type: entityType,
  } = useGenericContext<GlossaryTerm>();

  const { version, id } = useRequiredParams<{
    version: string;
    id: string;
  }>();
  const { showModal } = useEntityExportModalProvider();
  const [breadcrumb, setBreadcrumb] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);
  const [showActions, setShowActions] = useState(false);
  const [isDelete, setIsDelete] = useState<boolean>(false);
  const [isNameEditing, setIsNameEditing] = useState<boolean>(false);
  const [latestGlossaryData, setLatestGlossaryData] = useState<
    Glossary | GlossaryTerm
  >();
  const [isStyleEditing, setIsStyleEditing] = useState(false);
  const [openChangeParentHierarchyModal, setOpenChangeParentHierarchyModal] =
    useState(false);
  const isGlossary = entityType === EntityType.GLOSSARY;
  const { permissions: globalPermissions } = usePermissionProvider();

  const createGlossaryTermPermission = useMemo(
    () =>
      checkPermission(
        Operation.Create,
        ResourceEntity.GLOSSARY_TERM,
        globalPermissions
      ),
    [globalPermissions]
  );

  const importExportPermissions = useMemo(
    () =>
      checkPermission(
        Operation.All,
        ResourceEntity.GLOSSARY_TERM,
        globalPermissions
      ) ||
      checkPermission(
        Operation.EditAll,
        ResourceEntity.GLOSSARY_TERM,
        globalPermissions
      ),
    [globalPermissions]
  );

  // To fetch the latest glossary data
  // necessary to handle back click functionality to work properly in version page
  const fetchCurrentGlossaryInfo = async () => {
    try {
      const res = isGlossary
        ? await getGlossariesById(id)
        : await getGlossaryTermsById(id);

      setLatestGlossaryData(res);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const glossaryTermStatus: Status | null = useMemo(() => {
    if (!isGlossary) {
      return selectedData.status ?? Status.Approved;
    }

    return null;
  }, [isGlossary, selectedData]);

  const editDisplayNamePermission = useMemo(() => {
    return permissions.EditAll || permissions.EditDisplayName;
  }, [permissions]);

  const voteStatus = useMemo(
    () => getEntityVoteStatus(currentUser?.id ?? '', selectedData.votes),
    [selectedData.votes, currentUser]
  );

  const icon = useMemo(() => {
    if (isGlossary) {
      return (
        <GlossaryIcon
          className="align-middle"
          color={DE_ACTIVE_COLOR}
          height={36}
          name="folder"
          width={32}
        />
      );
    }

    if (selectedData.style?.iconURL) {
      return (
        <img
          className="align-middle object-contain"
          data-testid="icon"
          height={36}
          src={selectedData.style?.iconURL}
          width={32}
        />
      );
    }

    return (
      <IconTerm
        className="align-middle"
        color={DE_ACTIVE_COLOR}
        height={36}
        name="doc"
        width={32}
      />
    );
  }, [selectedData, isGlossary]);

  const handleAddGlossaryTermClick = useCallback(() => {
    onAddGlossaryTerm(!isGlossary ? selectedData : undefined);
  }, [fqn]);

  const handleGlossaryImport = () =>
    navigate(getEntityImportPath(EntityType.GLOSSARY_TERM, fqn));

  const handleVersionClick = async () => {
    let path: string;
    if (isVersionView) {
      path = getGlossaryPath(latestGlossaryData?.fullyQualifiedName);
    } else {
      path = isGlossary
        ? getGlossaryVersionsPath(
            selectedData.id,
            toString(selectedData.version)
          )
        : getGlossaryTermsVersionsPath(
            selectedData.id,
            toString(selectedData.version)
          );
    }

    navigate(path);
  };

  const handleDelete = async () => {
    const { id } = selectedData;
    await onDelete(id);
    setIsDelete(false);
  };

  const onNameSave = async (obj: { name: string; displayName?: string }) => {
    const { name, displayName } = obj;
    let updatedDetails = cloneDeep(selectedData);

    updatedDetails = {
      ...selectedData,
      name: name?.trim() || selectedData.name,
      displayName: displayName?.trim(),
    };

    await onUpdate(updatedDetails);
    setIsNameEditing(false);
  };

  const onStyleSave = async (data: Style) => {
    const style: Style = {
      // if color/iconURL is empty or undefined send undefined
      color: !isEmpty(data.color) ? data.color : undefined,
      iconURL: !isEmpty(data.iconURL) ? data.iconURL : undefined,
    };
    const updatedDetails = {
      ...selectedData,
      style,
    };

    await onUpdate(updatedDetails);
    setIsStyleEditing(false);
  };

  const addButtonContent = [
    {
      label: t('label.glossary-term'),
      key: '1',
      onClick: handleAddGlossaryTermClick,
    },
    {
      label: t('label.asset-plural'),
      key: '2',
      onClick: onAssetAdd,
    },
  ];

  const handleGlossaryExportClick = useCallback(async () => {
    if (selectedData) {
      showModal({
        name: selectedData?.fullyQualifiedName || '',
        onExport: exportGlossaryInCSVFormat,
        exportTypes: [ExportTypes.CSV],
      });
    }
  }, [selectedData]);

  const manageButtonContent: ItemType[] = [
    ...(isGlossary && importExportPermissions
      ? ([
          {
            label: (
              <ManageButtonItemLabel
                description={t('message.export-entity-help', {
                  entity: t('label.glossary-term-lowercase-plural'),
                })}
                icon={ExportIcon}
                id="export-button"
                name={t('label.export')}
              />
            ),
            key: 'export-button',
            onClick: (e) => {
              e.domEvent.stopPropagation();
              handleGlossaryExportClick();
              setShowActions(false);
            },
          },
          {
            label: (
              <ManageButtonItemLabel
                description={t('message.import-entity-help', {
                  entity: t('label.glossary-term-lowercase'),
                })}
                icon={ImportIcon}
                id="import-button"
                name={t('label.import')}
              />
            ),
            key: 'import-button',
            onClick: (e) => {
              e.domEvent.stopPropagation();
              handleGlossaryImport();
              setShowActions(false);
            },
          },
        ] as ItemType[])
      : []),
    ...(editDisplayNamePermission
      ? ([
          {
            label: (
              <ManageButtonItemLabel
                description={t('message.rename-entity', {
                  entity: isGlossary
                    ? t('label.glossary')
                    : t('label.glossary-term'),
                })}
                icon={EditIcon}
                id="rename-button"
                name={t('label.rename')}
              />
            ),
            key: 'rename-button',
            onClick: (e) => {
              e.domEvent.stopPropagation();
              setIsNameEditing(true);
              setShowActions(false);
            },
          },
        ] as ItemType[])
      : []),
    ...(permissions?.EditAll && !isGlossary
      ? ([
          {
            label: (
              <ManageButtonItemLabel
                description={t('message.edit-entity-style-description', {
                  entity: t('label.glossary-term'),
                })}
                icon={StyleIcon}
                id="rename-button"
                name={t('label.style')}
              />
            ),
            key: 'edit-style-button',
            onClick: (e) => {
              e.domEvent.stopPropagation();
              setIsStyleEditing(true);
              setShowActions(false);
            },
          },
          {
            label: (
              <ManageButtonItemLabel
                description={t('message.modify-hierarchy-entity-description', {
                  entity: t('label.term'),
                })}
                icon={ChangeHierarchyIcon}
                id="change-parent-button"
                name={t('label.change-parent-entity', {
                  entity: t('label.term'),
                })}
              />
            ),
            key: 'change-parent-button',
            onClick: (e) => {
              e.domEvent.stopPropagation();
              setOpenChangeParentHierarchyModal(true);
              setShowActions(false);
            },
          },
        ] as ItemType[])
      : []),

    ...(permissions.Delete
      ? ([
          {
            label: (
              <ManageButtonItemLabel
                description={t(
                  'message.delete-entity-type-action-description',
                  {
                    entityType: isGlossary
                      ? t('label.glossary')
                      : t('label.glossary-term'),
                  }
                )}
                icon={IconDelete}
                id="delete-button"
                name={t('label.delete')}
              />
            ),
            key: 'delete-button',
            onClick: (e) => {
              e.domEvent.stopPropagation();
              setIsDelete(true);
              setShowActions(false);
            },
          },
        ] as ItemType[])
      : []),
  ];

  const statusBadge = useMemo(() => {
    if (!isGlossary) {
      const entityStatus = selectedData.status ?? Status.Approved;

      return <GlossaryStatusBadge status={entityStatus} />;
    }

    return null;
  }, [isGlossary, selectedData]);

  const createButtons = useMemo(() => {
    if (permissions.Create || createGlossaryTermPermission) {
      return isGlossary ? (
        <Button
          className="m-l-xs h-10"
          data-testid="add-new-tag-button-header"
          size="middle"
          type="primary"
          onClick={handleAddGlossaryTermClick}>
          {t('label.add-entity', { entity: t('label.term-lowercase') })}
        </Button>
      ) : (
        <>
          {glossaryTermStatus && glossaryTermStatus === Status.Approved && (
            <Dropdown
              className="m-l-xs h-10"
              menu={{
                items: addButtonContent,
              }}
              placement="bottomRight"
              trigger={['click']}>
              <Button
                data-testid="glossary-term-add-button-menu"
                type="primary">
                <Space>
                  {t('label.add')}
                  <DownOutlined />
                </Space>
              </Button>
            </Dropdown>
          )}
        </>
      );
    }

    return null;
  }, [
    isGlossary,
    permissions,
    createGlossaryTermPermission,
    addButtonContent,
    glossaryTermStatus,
  ]);

  /**
   * To create breadcrumb from the fqn
   * @param fqn fqn of glossary or glossary term
   */
  const handleBreadcrumb = (fqn: string) => {
    if (!fqn) {
      return;
    }

    const arr = !isGlossary ? Fqn.split(fqn) : [];
    const dataFQN: Array<string> = [];
    const newData = [
      {
        name: 'Glossaries',
        url: getGlossaryPath(arr[0]),
        activeTitle: false,
      },
      ...arr.slice(0, -1).map((d) => {
        dataFQN.push(d);

        return {
          name: d,
          url: getGlossaryPath(dataFQN.join(FQN_SEPARATOR_CHAR)),
          activeTitle: false,
        };
      }),
    ];

    setBreadcrumb(newData);
  };

  useEffect(() => {
    const { fullyQualifiedName, name } = selectedData;
    handleBreadcrumb(fullyQualifiedName ?? name);
  }, [selectedData]);

  useEffect(() => {
    if (isVersionView) {
      fetchCurrentGlossaryInfo();
    }
  }, [id]);

  return (
    <>
      <div className="glossary-header flex gap-4 justify-between no-wrap ">
        <div className="flex w-min-0 flex-auto">
          <EntityHeader
            badge={statusBadge}
            breadcrumb={breadcrumb}
            entityData={selectedData}
            entityType={EntityType.GLOSSARY_TERM}
            icon={icon}
            serviceName=""
            titleColor={isGlossary ? undefined : selectedData.style?.color}
          />
        </div>
        <div className="flex items-center">
          <div className="d-flex gap-3 justify-end">
            {!isVersionView && createButtons}

            <ButtonGroup className="spaced" size="small">
              {updateVote && (
                <Voting
                  voteStatus={voteStatus}
                  votes={selectedData.votes}
                  onUpdateVote={updateVote}
                />
              )}

              {selectedData?.version && (
                <Tooltip
                  title={t(
                    `label.${
                      isVersionView
                        ? 'exit-version-history'
                        : 'version-plural-history'
                    }`
                  )}>
                  <Button
                    className={classNames('', {
                      'text-primary border-primary': version,
                    })}
                    data-testid="version-button"
                    icon={<Icon component={VersionIcon} />}
                    onClick={handleVersionClick}>
                    <Typography.Text
                      className={classNames('', {
                        'text-primary': version,
                      })}>
                      {toString(selectedData.version)}
                    </Typography.Text>
                  </Button>
                </Tooltip>
              )}

              {!isVersionView && manageButtonContent.length > 0 && (
                <Dropdown
                  align={{ targetOffset: [-12, 0] }}
                  className="m-l-xs"
                  menu={{
                    items: manageButtonContent,
                  }}
                  open={showActions}
                  overlayClassName="glossary-manage-dropdown-list-container"
                  overlayStyle={{ width: '350px' }}
                  placement="bottomRight"
                  trigger={['click']}
                  onOpenChange={setShowActions}>
                  <Tooltip
                    placement="topRight"
                    title={t('label.manage-entity', {
                      entity: isGlossary
                        ? t('label.glossary')
                        : t('label.glossary-term'),
                    })}>
                    <Button
                      className="glossary-manage-dropdown-button"
                      data-testid="manage-button"
                      icon={
                        <IconDropdown
                          className="vertical-align-inherit manage-dropdown-icon"
                          height={16}
                          width={16}
                        />
                      }
                      onClick={() => setShowActions(true)}
                    />
                  </Tooltip>
                </Dropdown>
              )}
            </ButtonGroup>
          </div>
        </div>
      </div>
      {selectedData && (
        <EntityDeleteModal
          bodyText={getEntityDeleteMessage(selectedData.name, '')}
          entityName={selectedData.name}
          entityType="Glossary"
          visible={isDelete}
          onCancel={() => setIsDelete(false)}
          onConfirm={handleDelete}
        />
      )}

      <EntityNameModal<GlossaryTerm>
        allowRename
        entity={selectedData}
        nameValidationRules={[
          {
            min: 1,
            max: 128,
            message: t('message.entity-size-in-between', {
              entity: t('label.name'),
              min: 1,
              max: 128,
            }),
          },
        ]}
        title={t('label.edit-entity', {
          entity: t('label.name'),
        })}
        visible={isNameEditing}
        onCancel={() => setIsNameEditing(false)}
        onSave={onNameSave}
      />

      <StyleModal
        open={isStyleEditing}
        style={selectedData.style}
        onCancel={() => setIsStyleEditing(false)}
        onSubmit={onStyleSave}
      />

      {openChangeParentHierarchyModal && (
        <ChangeParentHierarchy
          selectedData={selectedData}
          onCancel={() => setOpenChangeParentHierarchyModal(false)}
        />
      )}
    </>
  );
};

export default GlossaryHeader;
