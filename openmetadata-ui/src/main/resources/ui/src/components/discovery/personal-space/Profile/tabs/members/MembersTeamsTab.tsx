/*
 *  Copyright 2026 Collate.
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
    Button,
    Dialog,
    EmptyPlaceholder,
    FeaturedIcon,
    Modal,
    ModalOverlay,
    Toggle,
    Typography
} from '@openmetadata/ui-core-components';
import { ArrowRight } from '@openmetadata/ui-core-components/icons';
import { FC } from 'react';
import { DropZone } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import { Transi18next } from '../../../../../../utils/i18next/LocalUtil';
import Table from '../../../../../common/Table/TableV2';
import type { MembersTeamsTabProps } from './MembersTeamDetail.types';
import { TEAM_DRAG_TYPE } from './MembersTeamDetail.utils';

const MembersTeamsTab: FC<MembersTeamsTabProps> = ({
  team,
  childTeamColumns,
  childTeamExpandable,
  filteredChildTeams,
  dragAndDropHooks,
  draggedTeamRef,
  isTableHovered,
  isChildTeamsLoading,
  showDeletedTeam,
  searchTerm,
  canCreateTeam,
  movedTeam,
  onShowDeletedTeamChange,
  onSearchTermChange,
  onNavigate,
  onSetMovedTeam,
  onMoveConfirm,
}) => {
  const { t } = useTranslation();

  return (
    <>
      <DropZone
        aria-label={t('label.move-entity-to-root', {
          entity: t('label.team'),
        })}
        className="tw:block"
        getDropOperation={(types) =>
          types.has(TEAM_DRAG_TYPE) ? 'move' : 'cancel'
        }
        onDrop={() => {
          if (draggedTeamRef.current) {
            onSetMovedTeam({
              from: draggedTeamRef.current,
              to: undefined,
            });
          }
        }}>
        <Table
          className={isTableHovered ? 'drop-over-table' : undefined}
          columns={childTeamColumns}
          containerClassName="tw:rounded-xl"
          data-testid="sub-teams-table"
          dataSource={filteredChildTeams}
          dragAndDropHooks={dragAndDropHooks}
          expandable={childTeamExpandable}
          extraTableFilters={
            <Box align="center" direction="row" gap={3}>
              <Toggle
                data-testid="show-deleted-teams"
                isSelected={showDeletedTeam}
                label={t('label.deleted')}
                size="sm"
                onChange={onShowDeletedTeamChange}
              />
              {canCreateTeam && (
                <Button
                  color="primary"
                  data-testid="add-team"
                  size="sm"
                  onPress={() =>
                    onNavigate({
                      type: 'teams-add',
                      parentFqn: team.fullyQualifiedName,
                    })
                  }>
                  {t('label.add-entity', {
                    entity: t('label.team'),
                  })}
                </Button>
              )}
            </Box>
          }
          loading={isChildTeamsLoading}
          locale={{
            emptyText: (
              <Box
                align="center"
                className="tw:min-h-32 tw:relative"
                justify="center">
                <EmptyPlaceholder title={t('label.no-data-found')} />
              </Box>
            ),
          }}
          pagination={false}
          rowKey="fullyQualifiedName"
          searchProps={{
            containerClassName: 'tw:w-80!',
            placeholder: t('label.search-entity', {
              entity: t('label.team'),
            }),
            searchValue: searchTerm,
            onSearch: onSearchTermChange,
            typingInterval: 500,
          }}
          size="small"
        />
      </DropZone>

      {movedTeam && (
        <ModalOverlay
          isDismissable
          isOpen
          data-testid="move-team-modal"
          style={{ zIndex: 999 }}
          onOpenChange={(isOpen) => !isOpen && onSetMovedTeam(undefined)}>
          <Modal>
            <Dialog width={400} onClose={() => onSetMovedTeam(undefined)}>
              <Dialog.Header className="tw:flex-col">
                <FeaturedIcon
                  color="brand"
                  icon={ArrowRight}
                  size="lg"
                  theme="light"
                />
                <Box
                  className="tw:gap-0.5 tw:mt-4 tw:min-w-0 tw:w-full"
                  data-testid="modal-header"
                  direction="col">
                  <Typography size="text-md" weight="semibold">
                    {t('label.move-the-entity', {
                      entity: t('label.team'),
                    })}
                  </Typography>
                  <Typography
                    as="p"
                    className="tw:text-tertiary tw:break-words">
                    {movedTeam.to ? (
                      <Transi18next
                        i18nKey="message.entity-transfer-message"
                        renderElement={<strong />}
                        values={{
                          from: getEntityName(movedTeam.from),
                          to: getEntityName(movedTeam.to),
                          entity: t('label.team-lowercase'),
                        }}
                      />
                    ) : (
                      t('message.move-entity-to-root', {
                        entity: getEntityName(movedTeam.from),
                      })
                    )}
                  </Typography>
                </Box>
              </Dialog.Header>
              <Box
                className="tw:p-4 tw:pt-6 tw:sm:px-6 tw:sm:pt-8 tw:sm:pb-6"
                direction="row"
                gap={3}>
                <Button
                  className="tw:w-full"
                  color="secondary"
                  data-testid="cancel-button"
                  size="lg"
                  onPress={() => onSetMovedTeam(undefined)}>
                  {t('label.cancel')}
                </Button>
                <Button
                  className="tw:w-full"
                  color="primary"
                  data-testid="confirm-button"
                  size="lg"
                  onPress={onMoveConfirm}>
                  {t('label.confirm')}
                </Button>
              </Box>
            </Dialog>
          </Modal>
        </ModalOverlay>
      )}
    </>
  );
};

export default MembersTeamsTab;
