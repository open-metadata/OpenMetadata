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
import { DownOutlined } from '@ant-design/icons';
import { Button, Col, Dropdown, Row, Space, Tooltip, Typography } from 'antd';
import { ReactComponent as EditIcon } from 'assets/svg/edit-new.svg';
import { ReactComponent as ExportIcon } from 'assets/svg/ic-export.svg';
import { ReactComponent as ImportIcon } from 'assets/svg/ic-import.svg';
import { ReactComponent as IconDropdown } from 'assets/svg/menu.svg';
import { AssetSelectionModal } from 'components/Assets/AssetsSelectionModal/AssetSelectionModal';
import EntityDeleteModal from 'components/Modals/EntityDeleteModal/EntityDeleteModal';
import EntityNameModal from 'components/Modals/EntityNameModal/EntityNameModal.component';
import { OperationPermission } from 'components/PermissionProvider/PermissionProvider.interface';
import VersionButton from 'components/VersionButton/VersionButton.component';
import { FQN_SEPARATOR_CHAR } from 'constants/char.constants';
import { DE_ACTIVE_COLOR } from 'constants/constants';
import { EntityReference, Glossary } from 'generated/entity/data/glossary';
import { GlossaryTerm } from 'generated/entity/data/glossaryTerm';
import { cloneDeep, toString } from 'lodash';
import { LoadingState } from 'Models';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { getEntityDeleteMessage } from 'utils/CommonUtils';
import {
  getAddGlossaryTermsPath,
  getGlossaryPath,
  getGlossaryPathWithAction,
  getGlossaryTermsVersionsPath,
  getGlossaryVersionsPath,
} from 'utils/RouterUtils';
import SVGIcons, { Icons } from 'utils/SvgUtils';
import ExportGlossaryModal from '../ExportGlossaryModal/ExportGlossaryModal';
import { GlossaryAction } from '../GlossaryV1.interfaces';

interface GlossaryHeaderButtonsProps {
  deleteStatus: LoadingState;
  isGlossary: boolean;
  selectedData: Glossary | GlossaryTerm;
  permission: OperationPermission;
  onEntityDelete: (id: string) => void;
  onAssetsUpdate?: () => void;
  onUpdate: (data: GlossaryTerm | Glossary) => void;
}

const GlossaryHeaderButtons = ({
  deleteStatus = 'initial',
  isGlossary,
  selectedData,
  permission,
  onEntityDelete,
  onAssetsUpdate,
  onUpdate,
}: GlossaryHeaderButtonsProps) => {
  const { t } = useTranslation();
  const {
    action,
    glossaryName: glossaryFqn,
    version,
  } = useParams<{
    action: GlossaryAction;
    glossaryName: string;
    version: string;
  }>();

  const history = useHistory();
  const [showActions, setShowActions] = useState(false);
  const [isDelete, setIsDelete] = useState<boolean>(false);
  const [showAddAssets, setShowAddAssets] = useState(false);
  const [isNameEditing, setIsNameEditing] = useState<boolean>(false);

  const editDisplayNamePermission = useMemo(() => {
    return permission.EditAll || permission.EditDisplayName;
  }, [permission]);

  const isExportAction = useMemo(
    () => action === GlossaryAction.EXPORT,
    [action]
  );

  const handleAddGlossaryTermClick = useCallback(() => {
    if (glossaryFqn) {
      const activeTerm = glossaryFqn.split(FQN_SEPARATOR_CHAR);
      const glossary = activeTerm[0];
      if (activeTerm.length > 1) {
        history.push(getAddGlossaryTermsPath(glossary, glossaryFqn));
      } else {
        history.push(getAddGlossaryTermsPath(glossary));
      }
    } else {
      history.push(
        getAddGlossaryTermsPath(selectedData.fullyQualifiedName ?? '')
      );
    }
  }, [glossaryFqn]);

  const handleGlossaryExport = () =>
    history.push(
      getGlossaryPathWithAction(selectedData.name, GlossaryAction.EXPORT)
    );

  const handleGlossaryImport = () =>
    history.push(
      getGlossaryPathWithAction(selectedData.name, GlossaryAction.IMPORT)
    );

  const handleVersionClick = async () => {
    const path = isGlossary
      ? getGlossaryVersionsPath(selectedData.id, toString(selectedData.version))
      : getGlossaryTermsVersionsPath(
          selectedData.id,
          toString(selectedData.version)
        );

    history.push(path);
  };

  const handleCancelGlossaryExport = () =>
    history.push(getGlossaryPath(selectedData.name));

  const handleDelete = () => {
    const { id } = selectedData;
    onEntityDelete(id);
    setIsDelete(false);
  };

  const handleAddAssetsClick = () => {
    setShowAddAssets(true);
  };

  const onNameSave = (obj: { name: string; displayName: string }) => {
    const { name, displayName } = obj;
    let updatedDetails = cloneDeep(selectedData);

    updatedDetails = {
      ...selectedData,
      name: name?.trim() || selectedData.name,
      displayName: displayName?.trim(),
    };

    onUpdate(updatedDetails);

    setIsNameEditing(false);
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
      onClick: () => handleAddAssetsClick(),
    },
  ];

  const manageButtonContent = [
    ...(isGlossary
      ? [
          {
            label: (
              <Row
                className="tw-cursor-pointer manage-button"
                data-testid="export-button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleGlossaryExport();
                  setShowActions(false);
                }}>
                <Col className="self-center" span={3}>
                  <ExportIcon width="18px" />
                </Col>
                <Col span={21}>
                  <Row>
                    <Col span={21}>
                      <Typography.Text
                        className="font-medium"
                        data-testid="export-button-title">
                        {t('label.export')}
                      </Typography.Text>
                    </Col>
                    <Col className="p-t-xss">
                      <Typography.Paragraph className="text-grey-muted text-xs m-b-0 line-height-16">
                        {t('message.export-glossary-help')}
                      </Typography.Paragraph>
                    </Col>
                  </Row>
                </Col>
              </Row>
            ),
            key: 'export-button',
          },
          {
            label: (
              <Row
                className="tw-cursor-pointer manage-button"
                data-testid="import-button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleGlossaryImport();
                  setShowActions(false);
                }}>
                <Col className="self-center" span={3}>
                  <ImportIcon width="20px" />
                </Col>
                <Col span={21}>
                  <Row>
                    <Col span={21}>
                      <Typography.Text
                        className="font-medium"
                        data-testid="import-button-title">
                        {t('label.import')}
                      </Typography.Text>
                    </Col>
                    <Col className="p-t-xss">
                      <Typography.Paragraph className="text-grey-muted text-xs m-b-0 line-height-16">
                        {t('message.import-glossary-help')}
                      </Typography.Paragraph>
                    </Col>
                  </Row>
                </Col>
              </Row>
            ),
            key: 'import-button',
          },
        ]
      : []),
    ...(editDisplayNamePermission
      ? [
          {
            label: (
              <Row
                className="tw-cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsNameEditing(true);
                  setShowActions(false);
                }}>
                <Col className="self-center" span={3}>
                  <EditIcon color={DE_ACTIVE_COLOR} width="20px" />
                </Col>
                <Col
                  className="tw-text-left"
                  data-testid="edit-button"
                  span={21}>
                  <p className="tw-font-medium" data-testid="edit-button-title">
                    {t('label.rename')}
                  </p>
                  <p className="tw-text-grey-muted tw-text-xs">
                    {t('message.rename-glossary-entity', {
                      entity: isGlossary
                        ? t('label.glossary')
                        : t('label.glossary-term'),
                    })}
                  </p>
                </Col>
              </Row>
            ),
            key: 'rename-button',
          },
        ]
      : []),
    {
      label: (
        <Row
          className="tw-cursor-pointer manage-button"
          onClick={(e) => {
            e.stopPropagation();
            setIsDelete(true);
            setShowActions(false);
          }}>
          <Col className="self-center" span={3}>
            <SVGIcons alt="Delete" icon={Icons.DELETE} />
          </Col>
          <Col className="tw-text-left" data-testid="delete-button" span={21}>
            <p className="tw-font-medium" data-testid="delete-button-title">
              {t('label.delete')}
            </p>
            <p className="tw-text-grey-muted tw-text-xs">
              {t('message.delete-entity-type-action-description', {
                entityType: isGlossary
                  ? t('label.glossary')
                  : t('label.glossary-term'),
              })}
            </p>
          </Col>
        </Row>
      ),
      key: 'delete-button',
    },
  ];

  const createButtons = useMemo(() => {
    if (permission.Create) {
      return isGlossary ? (
        <Button
          className="m-l-xs"
          data-testid="add-new-tag-button-header"
          size="middle"
          type="primary"
          onClick={handleAddGlossaryTermClick}>
          {t('label.add-entity', { entity: t('label.term-lowercase') })}
        </Button>
      ) : (
        <Dropdown
          className="m-l-xs"
          menu={{
            items: addButtonContent,
          }}
          placement="bottomRight"
          trigger={['click']}>
          <Button type="primary">
            <Space>
              {t('label.add')}
              <DownOutlined />
            </Space>
          </Button>
        </Dropdown>
      );
    }

    return null;
  }, [isGlossary, permission, addButtonContent]);

  return (
    <>
      <div>
        {createButtons}
        {selectedData && selectedData.version && (
          <VersionButton
            className="m-l-xs tw-px-1.5"
            selected={Boolean(version)}
            version={toString(selectedData.version)}
            onClick={handleVersionClick}
          />
        )}

        {permission.Delete && (
          <Dropdown
            align={{ targetOffset: [-12, 0] }}
            className="m-l-xs"
            menu={{
              items: manageButtonContent,
            }}
            open={showActions}
            overlayStyle={{ width: '350px' }}
            placement="bottomRight"
            trigger={['click']}
            onOpenChange={setShowActions}>
            <Tooltip placement="right">
              <Button
                className="glossary-manage-dropdown-button tw-px-1.5"
                data-testid="manage-button"
                onClick={() => setShowActions(true)}>
                <IconDropdown className="anticon self-center manage-dropdown-icon" />
              </Button>
            </Tooltip>
          </Dropdown>
        )}
      </div>
      {selectedData && (
        <EntityDeleteModal
          bodyText={getEntityDeleteMessage(selectedData.name, '')}
          entityName={selectedData.name}
          entityType="Glossary"
          loadingState={deleteStatus}
          visible={isDelete}
          onCancel={() => setIsDelete(false)}
          onConfirm={handleDelete}
        />
      )}
      {isExportAction && (
        <ExportGlossaryModal
          glossaryName={selectedData.name}
          isModalOpen={isExportAction}
          onCancel={handleCancelGlossaryExport}
          onOk={handleCancelGlossaryExport}
        />
      )}
      {selectedData.fullyQualifiedName && !isGlossary && (
        <AssetSelectionModal
          glossaryFQN={selectedData.fullyQualifiedName}
          open={showAddAssets}
          onCancel={() => setShowAddAssets(false)}
          onSave={onAssetsUpdate}
        />
      )}
      <EntityNameModal
        entity={selectedData as EntityReference}
        visible={isNameEditing}
        onCancel={() => setIsNameEditing(false)}
        onSave={onNameSave}
      />
    </>
  );
};

export default GlossaryHeaderButtons;
