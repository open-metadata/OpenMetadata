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

import { Modal, Table, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { ExpandableConfig } from 'antd/lib/table/interface';
import { AxiosError } from 'axios';
import { TeamType } from 'generated/api/teams/createTeam';
import { isEmpty } from 'lodash';
import React, { FC, useCallback, useMemo, useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getTeamByName, updateTeam } from 'rest/teamsAPI';
import { getEntityName } from 'utils/EntityUtils';
import { TABLE_CONSTANTS } from '../../constants/Teams.constants';
import { Team } from '../../generated/entity/teams/team';
import { Transi18next } from '../../utils/CommonUtils';
import { getTeamsWithFqnPath } from '../../utils/RouterUtils';
import { getTableExpandableConfig } from '../../utils/TableUtils';
import { getMovedTeamData } from '../../utils/TeamUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import {
  DraggableBodyRowProps,
  MovedTeamProps,
  TeamHierarchyProps,
} from './team.interface';
import './teams.less';

const TeamHierarchy: FC<TeamHierarchyProps> = ({
  currentTeam,
  data,
  onTeamExpand,
}) => {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isTableLoading, setIsTableLoading] = useState<boolean>(false);
  const [movedTeam, setMovedTeam] = useState<MovedTeamProps>();

  const columns: ColumnsType<Team> = useMemo(() => {
    return [
      {
        title: t('label.team-plural'),
        dataIndex: 'teams',
        key: 'teams',
        render: (_, record) => (
          <Link
            className="hover:tw-underline tw-cursor-pointer"
            to={getTeamsWithFqnPath(record.fullyQualifiedName || record.name)}>
            {getEntityName(record)}
          </Link>
        ),
      },
      {
        title: t('label.type'),
        dataIndex: 'teamType',
        key: 'teamType',
      },
      {
        title: t('label.sub-team-plural'),
        dataIndex: 'childrenCount',
        key: 'subTeams',
        render: (childrenCount: number) => childrenCount ?? '--',
      },
      {
        title: t('label.user-plural'),
        dataIndex: 'userCount',
        key: 'users',
        render: (userCount: number) => userCount ?? '--',
      },
      {
        title: t('label.entity-count', {
          entity: t('label.asset'),
        }),
        dataIndex: 'owns',
        key: 'owns',
        render: (owns) => owns.length,
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        width: 450,
        key: 'description',
        render: (description: string) => (
          <Typography.Paragraph
            className="m-b-0"
            ellipsis={{
              rows: 2,
            }}
            title={description}>
            {isEmpty(description) ? '--' : description}
          </Typography.Paragraph>
        ),
      },
    ];
  }, [data, onTeamExpand]);

  const handleMoveRow = useCallback(
    async (dragRecord: Team, dropRecord: Team) => {
      if (dragRecord.id === dropRecord.id) {
        return;
      }

      if (dropRecord.teamType === TeamType.Group) {
        showErrorToast(t('message.error-team-transfer-message'));

        return;
      }
      setMovedTeam({
        from: dragRecord,
        to: dropRecord,
      });
      setIsModalOpen(true);
    },
    []
  );

  const handleChangeTeam = async () => {
    if (movedTeam) {
      setIsTableLoading(true);
      try {
        const data = await getTeamByName(
          movedTeam.from.name,
          ['users', 'defaultRoles', 'policies', 'owner', 'parents', 'children'],
          'all'
        );
        await updateTeam(getMovedTeamData(data, [movedTeam.to.id]));
        onTeamExpand(true, currentTeam?.name);
        showSuccessToast(t('message.team-moved-success'));
      } catch (error) {
        showErrorToast(error as AxiosError, t('server.team-moved-error'));
      } finally {
        setIsTableLoading(false);
        setIsModalOpen(false);
      }
    }
  };

  const expandableConfig: ExpandableConfig<Team> = useMemo(
    () => ({
      ...getTableExpandableConfig<Team>(true),
      onExpand: (isOpen, record) => {
        if (isOpen && isEmpty(record.children)) {
          onTeamExpand(false, record.fullyQualifiedName, true);
        }
      },
    }),
    [onTeamExpand]
  );

  return (
    <>
      <DndProvider backend={HTML5Backend}>
        <Table
          bordered
          className="teams-list-table"
          columns={columns}
          components={TABLE_CONSTANTS}
          data-testid="team-hierarchy-table"
          dataSource={data}
          expandable={expandableConfig}
          loading={isTableLoading}
          pagination={false}
          rowKey="name"
          size="small"
          onRow={(record, index) => {
            const attr = {
              index,
              handleMoveRow,
              record,
            };

            return attr as DraggableBodyRowProps;
          }}
        />
      </DndProvider>

      <Modal
        centered
        destroyOnClose
        closable={false}
        confirmLoading={isTableLoading}
        data-testid="confirmation-modal"
        maskClosable={false}
        okText={t('label.confirm')}
        open={isModalOpen}
        title={t('label.move-the-entity', { entity: t('label.team') })}
        onCancel={() => setIsModalOpen(false)}
        onOk={handleChangeTeam}>
        <Transi18next
          i18nKey="message.entity-transfer-message"
          renderElement={<strong />}
          values={{
            from: movedTeam?.from?.name,
            to: movedTeam?.to?.name,
            entity: t('label.team-lowercase'),
          }}
        />
      </Modal>
    </>
  );
};

export default TeamHierarchy;
