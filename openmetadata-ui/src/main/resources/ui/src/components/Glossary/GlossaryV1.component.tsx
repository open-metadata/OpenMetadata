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

import { DownOutlined } from '@ant-design/icons';
import { Button, Col, Dropdown, Row, Space, Tooltip, Typography } from 'antd';
import { ReactComponent as ExportIcon } from 'assets/svg/ic-export.svg';
import { ReactComponent as ImportIcon } from 'assets/svg/ic-import.svg';
import { AxiosError } from 'axios';
import VersionButton from 'components/VersionButton/VersionButton.component';
import { API_RES_MAX_SIZE } from 'constants/constants';
import { isEmpty, toString } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { getGlossaryTerms, ListGlossaryTermsParams } from 'rest/glossaryAPI';
import { ReactComponent as IconDropdown } from '../../assets/svg/menu.svg';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { NO_PERMISSION_FOR_ACTION } from '../../constants/HelperTextUtil';
import { Glossary } from '../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { useAfterMount } from '../../hooks/useAfterMount';
import { getEntityDeleteMessage } from '../../utils/CommonUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import {
  getAddGlossaryTermsPath,
  getGlossaryPath,
  getGlossaryPathWithAction,
} from '../../utils/RouterUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import '../common/entityPageInfo/ManageButton/ManageButton.less';
import TitleBreadcrumb from '../common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from '../common/title-breadcrumb/title-breadcrumb.interface';
import GlossaryDetails from '../GlossaryDetails/GlossaryDetails.component';
import GlossaryTermsV1 from '../GlossaryTerms/GlossaryTermsV1.component';
import EntityDeleteModal from '../Modals/EntityDeleteModal/EntityDeleteModal';
import { usePermissionProvider } from '../PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../PermissionProvider/PermissionProvider.interface';
import ExportGlossaryModal from './ExportGlossaryModal/ExportGlossaryModal';
import { GlossaryAction, GlossaryV1Props } from './GlossaryV1.interfaces';
import './GlossaryV1.style.less';
import ImportGlossary from './ImportGlossary/ImportGlossary';

const GlossaryV1 = ({
  isGlossaryActive,
  deleteStatus = 'initial',
  selectedData,
  onGlossaryTermUpdate,
  updateGlossary,
  onGlossaryDelete,
  onGlossaryTermDelete,
}: GlossaryV1Props) => {
  const { action, glossaryName: glossaryFqn } =
    useParams<{ action: GlossaryAction; glossaryName: string }>();
  const history = useHistory();
  const { t } = useTranslation();

  const { getEntityPermission } = usePermissionProvider();
  const [breadcrumb, setBreadcrumb] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);
  const [showActions, setShowActions] = useState(false);
  const [isDelete, setIsDelete] = useState<boolean>(false);
  const [addTermButtonWidth, setAddTermButtonWidth] = useState(
    document.getElementById('add-term-button')?.offsetWidth || 0
  );
  const [manageButtonWidth, setManageButtonWidth] = useState(
    document.getElementById('manage-button')?.offsetWidth || 0
  );
  const [leftPanelWidth, setLeftPanelWidth] = useState(
    document.getElementById('glossary-left-panel')?.offsetWidth || 0
  );

  const [glossaryPermission, setGlossaryPermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const [glossaryTermPermission, setGlossaryTermPermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const [glossaryTerms, setGlossaryTerms] = useState<GlossaryTerm[]>([]);

  const handleGlossaryExport = () =>
    history.push(
      getGlossaryPathWithAction(selectedData.name, GlossaryAction.EXPORT)
    );

  const handleCancelGlossaryExport = () =>
    history.push(getGlossaryPath(selectedData.name));

  const handleGlossaryImport = () =>
    history.push(
      getGlossaryPathWithAction(selectedData.name, GlossaryAction.IMPORT)
    );

  const isImportAction = useMemo(
    () => action === GlossaryAction.IMPORT,
    [action]
  );
  const isExportAction = useMemo(
    () => action === GlossaryAction.EXPORT,
    [action]
  );

  const isGlossaryDeletePermission = useMemo(
    () => glossaryPermission.Delete || glossaryTermPermission.Delete,
    [glossaryPermission, glossaryTermPermission]
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

  const fetchGlossaryTerm = async (params?: ListGlossaryTermsParams) => {
    try {
      const { data } = await getGlossaryTerms({
        ...params,
        limit: API_RES_MAX_SIZE,
        fields: 'tags,children',
      });
      setGlossaryTerms(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const fetchGlossaryPermission = async () => {
    try {
      const response = await getEntityPermission(
        ResourceEntity.GLOSSARY,
        selectedData?.id as string
      );
      setGlossaryPermission(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const fetchGlossaryTermPermission = async () => {
    try {
      const response = await getEntityPermission(
        ResourceEntity.GLOSSARY_TERM,
        selectedData?.id as string
      );
      setGlossaryTermPermission(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  /**
   * To create breadcrumb from the fqn
   * @param fqn fqn of glossary or glossary term
   */
  const handleBreadcrumb = (fqn: string) => {
    if (fqn) {
      const arr = fqn.split(FQN_SEPARATOR_CHAR);
      const dataFQN: Array<string> = [];
      const newData = arr.map((d, i) => {
        dataFQN.push(d);
        const isLink = i < arr.length - 1;

        return {
          name: d,
          url: isLink ? getGlossaryPath(dataFQN.join(FQN_SEPARATOR_CHAR)) : '',
          activeTitle: !isLink,
        };
      });
      setBreadcrumb(newData);
    }
  };

  const handleDelete = () => {
    const { id } = selectedData;
    if (isGlossaryActive) {
      onGlossaryDelete(id);
    } else {
      onGlossaryTermDelete(id);
    }
    setIsDelete(false);
  };

  useEffect(() => {
    handleBreadcrumb(glossaryFqn ? glossaryFqn : selectedData.name);
  }, [glossaryFqn]);

  useAfterMount(() => {
    setLeftPanelWidth(
      document.getElementById('glossary-left-panel')?.offsetWidth || 0
    );
    setAddTermButtonWidth(
      document.getElementById('add-term-button')?.offsetWidth || 0
    );
    setManageButtonWidth(
      document.getElementById('manage-button')?.offsetWidth || 0
    );
  });

  const addButtonContent = [
    {
      label: t('label.term-plural'),
      key: '1',
      onClick: () => handleAddGlossaryTermClick(glossaryFqn),
    },
    {
      label: t('label.asset-plural'),
      key: '2',
    },
  ];

  const manageButtonContent = [
    ...(isGlossaryActive
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
                entityType: isGlossaryActive
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

  useEffect(() => {
    if (selectedData) {
      fetchGlossaryTerm(
        isGlossaryActive
          ? { glossary: selectedData.id }
          : { parent: selectedData.id }
      );
      if (isGlossaryActive) {
        fetchGlossaryPermission();
      } else {
        fetchGlossaryTermPermission();
      }
    }
  }, [selectedData, isGlossaryActive]);

  return isImportAction ? (
    <ImportGlossary glossaryName={selectedData.name} />
  ) : (
    <>
      <div
        className="tw-flex tw-justify-between tw-items-center"
        data-testid="header">
        <div
          className="tw-text-link tw-text-base glossary-breadcrumb"
          data-testid="category-name">
          <TitleBreadcrumb
            titleLinks={breadcrumb}
            widthDeductions={
              leftPanelWidth + addTermButtonWidth + manageButtonWidth + 20 // Additional deduction for margin on the right of leftPanel
            }
          />
        </div>
        <div
          className="tw-relative tw-flex tw-justify-between tw-items-center"
          id="add-term-button">
          {isGlossaryActive ? (
            <Button
              className="m-r-xs"
              data-testid="add-new-tag-button"
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
            />
          )}

          <Dropdown
            align={{ targetOffset: [-12, 0] }}
            disabled={
              isGlossaryActive
                ? !glossaryPermission.Delete
                : !glossaryTermPermission.Delete
            }
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
                isGlossaryDeletePermission
                  ? isGlossaryActive
                    ? t('label.manage-entity', { entity: t('label.glossary') })
                    : t('label.manage-entity', {
                        entity: t('label.glossary-term'),
                      })
                  : NO_PERMISSION_FOR_ACTION
              }>
              <Button
                className="glossary-manage-dropdown-button tw-px-1.5"
                data-testid="manage-button"
                disabled={!isGlossaryDeletePermission}
                onClick={() => setShowActions(true)}>
                <IconDropdown className="anticon self-center manage-dropdown-icon" />
              </Button>
            </Tooltip>
          </Dropdown>
        </div>
      </div>

      {!isEmpty(selectedData) &&
        (isGlossaryActive ? (
          <GlossaryDetails
            glossary={selectedData as Glossary}
            glossaryTerms={glossaryTerms}
            permissions={glossaryPermission}
            updateGlossary={updateGlossary}
          />
        ) : (
          <GlossaryTermsV1
            childGlossaryTerms={glossaryTerms}
            glossaryTerm={selectedData as GlossaryTerm}
            handleGlossaryTermUpdate={onGlossaryTermUpdate}
            permissions={glossaryTermPermission}
          />
        ))}

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

export default GlossaryV1;
