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
import { ReactComponent as ExportIcon } from 'assets/svg/ic-export.svg';
import { ReactComponent as ImportIcon } from 'assets/svg/ic-import.svg';
import { ReactComponent as IconDropdown } from 'assets/svg/menu.svg';
import { AxiosError } from 'axios';
import EntityDeleteModal from 'components/Modals/EntityDeleteModal/EntityDeleteModal';
import { OperationPermission } from 'components/PermissionProvider/PermissionProvider.interface';
import VersionButton from 'components/VersionButton/VersionButton.component';
import { FQN_SEPARATOR_CHAR } from 'constants/char.constants';
import { NO_PERMISSION_FOR_ACTION } from 'constants/HelperTextUtil';
import { Glossary } from 'generated/entity/data/glossary';
import { GlossaryTerm } from 'generated/entity/data/glossaryTerm';
import { EntityHistory } from 'generated/type/entityHistory';
import { toString } from 'lodash';
import { LoadingState } from 'Models';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import {
  getGlossaryTermsVersions,
  getGlossaryVersions,
} from 'rest/glossaryAPI';
import { getEntityDeleteMessage } from 'utils/CommonUtils';
import {
  getAddGlossaryTermsPath,
  getGlossaryPath,
  getGlossaryPathWithAction,
} from 'utils/RouterUtils';
import SVGIcons, { Icons } from 'utils/SvgUtils';
import { showErrorToast } from 'utils/ToastUtils';
import ExportGlossaryModal from '../ExportGlossaryModal/ExportGlossaryModal';
import { GlossaryAction } from '../GlossaryV1.interfaces';

interface GlossaryHeaderButtonsProps {
  deleteStatus: LoadingState;
  isGlossary: boolean;
  selectedData: Glossary | GlossaryTerm;
  permission: OperationPermission;
  onEntityDelete: (id: string) => void;
}

const GlossaryHeaderButtons = ({
  deleteStatus = 'initial',
  isGlossary,
  selectedData,
  permission,
  onEntityDelete,
}: GlossaryHeaderButtonsProps) => {
  const { t } = useTranslation();
  const { action, glossaryName: glossaryFqn } =
    useParams<{ action: GlossaryAction; glossaryName: string }>();
  const history = useHistory();
  const [showActions, setShowActions] = useState(false);
  const [isDelete, setIsDelete] = useState<boolean>(false);
  const [, setVersionList] = useState<EntityHistory>({} as EntityHistory);

  const isExportAction = useMemo(
    () => action === GlossaryAction.EXPORT,
    [action]
  );

  const handleAddGlossaryTermClick = (glossaryFQN: string) => {
    if (glossaryFQN) {
      const activeTerm = glossaryFQN.split(FQN_SEPARATOR_CHAR);
      const glossary = activeTerm[0];
      if (activeTerm.length > 1) {
        history.push(getAddGlossaryTermsPath(glossary, glossaryFQN));
      } else {
        history.push(getAddGlossaryTermsPath(glossary));
      }
    }
  };

  const handleGlossaryExport = () =>
    history.push(
      getGlossaryPathWithAction(selectedData.name, GlossaryAction.EXPORT)
    );

  const handleGlossaryImport = () =>
    history.push(
      getGlossaryPathWithAction(selectedData.name, GlossaryAction.IMPORT)
    );

  const handleVersionClick = async () => {
    const { id } = selectedData;
    try {
      const res = isGlossary
        ? await getGlossaryVersions(id)
        : await getGlossaryTermsVersions(id);
      setVersionList(res);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleCancelGlossaryExport = () =>
    history.push(getGlossaryPath(selectedData.name));

  const handleDelete = () => {
    const { id } = selectedData;
    onEntityDelete(id);
    setIsDelete(false);
  };

  const addButtonContent = [
    {
      label: t('label.glossary-term'),
      key: '1',
      onClick: () => handleAddGlossaryTermClick(glossaryFqn),
    },
    {
      label: t('label.asset-plural'),
      key: '2',
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
                  <ExportIcon width="20px" />
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
                        {t('label.export-glossary-terms')}
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
                        {t('label.import-glossary-term-plural')}
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
    {
      label: (
        <Row
          className="tw-cursor-pointer manage-button"
          onClick={(e) => {
            e.stopPropagation();
            setIsDelete(true);
            setShowActions(false);
          }}>
          <Col span={3}>
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

  return (
    <>
      <div>
        {isGlossary ? (
          <Button
            className="m-r-xs"
            data-testid="add-new-tag-button-header"
            size="middle"
            type="primary"
            onClick={() => handleAddGlossaryTermClick(glossaryFqn)}>
            {t('label.add-entity', { entity: t('label.term-lowercase') })}
          </Button>
        ) : (
          <Dropdown
            className="m-r-xs"
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
        )}

        {selectedData && selectedData.version && (
          <VersionButton
            className="m-r-xs tw-px-1.5"
            selected={false}
            version={toString(selectedData.version)}
            onClick={handleVersionClick}
          />
        )}

        <Dropdown
          align={{ targetOffset: [-12, 0] }}
          disabled={!permission.Delete}
          menu={{
            items: manageButtonContent,
          }}
          open={showActions}
          overlayStyle={{ width: '350px' }}
          placement="bottomRight"
          trigger={['click']}
          onOpenChange={setShowActions}>
          <Tooltip
            placement="right"
            title={
              permission.Delete
                ? isGlossary
                  ? t('label.manage-entity', { entity: t('label.glossary') })
                  : t('label.manage-entity', {
                      entity: t('label.glossary-term'),
                    })
                : NO_PERMISSION_FOR_ACTION
            }>
            <Button
              className="glossary-manage-dropdown-button tw-px-1.5"
              data-testid="manage-button"
              disabled={!permission.Delete}
              onClick={() => setShowActions(true)}>
              <IconDropdown className="anticon self-center manage-dropdown-icon" />
            </Button>
          </Tooltip>
        </Dropdown>
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
    </>
  );
};

export default GlossaryHeaderButtons;
