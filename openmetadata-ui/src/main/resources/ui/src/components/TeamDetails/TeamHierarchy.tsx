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
import { isArray, isEmpty } from 'lodash';
import React, { FC, useCallback, useMemo, useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getTeamByName, updateTeam } from 'rest/teamsAPI';
import { TABLE_CONSTANTS } from '../../constants/Teams.constants';
import { Team } from '../../generated/entity/teams/team';
import { getEntityName } from '../../utils/CommonUtils';
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
        title: 'Teams',
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
        title: 'Type',
        dataIndex: 'teamType',
        key: 'teamType',
      },
      {
        title: 'Sub Teams',
        dataIndex: 'childrenCount',
        key: 'subTeams',
        render: (childrenCount: number) => childrenCount ?? '--',
      },
      {
        title: 'Users',
        dataIndex: 'userCount',
        key: 'users',
        render: (userCount: number) => userCount ?? '--',
      },
      {
        title: 'Asset Count',
        dataIndex: 'owns',
        key: 'owns',
        render: (owns) => owns.length,
      },
      {
        title: 'Description',
        dataIndex: 'description',
        key: 'description',
        render: (description: string) => description || '--',
      },
    ];
  }, [data, onTeamExpand]);

  const handleMoveRow = useCallback(
    async (dragRecord: Team, dropRecord: Team) => {
      if (dragRecord.id === dropRecord.id) {
        return;
      }
      let dropTeam: Team = dropRecord;
      if (!isArray(dropTeam.children)) {
        const res = await getTeamByName(dropTeam.name, ['parents'], 'all');
        dropTeam = (res.parents?.[0] as Team) || currentTeam;
      }
      setMovedTeam({
        from: dragRecord,
        to: dropTeam,
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
        data-testid="confirmation-modal"
        okText={t('label.confirm')}
        open={isModalOpen}
        title={t('label.move-the-team')}
        onCancel={() => setIsModalOpen(false)}
        onOk={handleChangeTeam}>
        <Typography.Text>
          {t('message.team-transfer-message', {
            from: movedTeam?.from?.name,
            to: movedTeam?.to?.name,
          })}
        </Typography.Text>
      </Modal>
    </>
  );
};

export default TeamHierarchy;
