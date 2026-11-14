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
  Card,
  Dialog,
  Modal,
  ModalOverlay,
  Table,
  Typography,
} from '@openmetadata/ui-core-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OauthClient } from '../../../../../generated/api/mcp/oauthClient';
import {
  getMcpClients,
  revokeMcpClient,
  revokeMcpClientTokens,
} from '../../../../../rest/mcpConfigAPI';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../utils/ToastUtils';
import Loader from '../../../../common/Loader/Loader';

const McpClientsTable = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [cursors, setCursors] = useState<string[]>(['']);
  const [pendingClient, setPendingClient] = useState<OauthClient>();
  const [revokeTokensOnly, setRevokeTokensOnly] = useState(false);
  const after = cursors[cursors.length - 1];
  const {
    data: clients = [],
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['mcp-clients', after],
    queryFn: () => getMcpClients(after),
    retry: false,
  });
  const revoke = useMutation({
    mutationFn: (clientId: string) =>
      revokeTokensOnly
        ? revokeMcpClientTokens(clientId)
        : revokeMcpClient(clientId),
    onSuccess: async () => {
      setPendingClient(undefined);
      setCursors(['']);
      await queryClient.invalidateQueries({ queryKey: ['mcp-clients'] });
      showSuccessToast(
        t(
          revokeTokensOnly
            ? 'message.mcp-tokens-revoked'
            : 'message.mcp-client-revoked'
        )
      );
    },
    onError: (error: AxiosError) => showErrorToast(error),
  });
  const closeDialog = () => {
    if (!revoke.isPending) {
      setPendingClient(undefined);
    }
  };

  const confirmation = () =>
    revokeTokensOnly
      ? {
          title: 'label.mcp-revoke-tokens',
          message: 'message.mcp-revoke-tokens-confirm',
        }
      : {
          title: 'label.mcp-remove-client',
          message: 'message.mcp-revoke-client-confirm',
        };

  return (
    <Card className="tw:mt-6" data-testid="mcp-clients" variant="outlined">
      <Card.Header
        extra={
          <Button
            color="secondary"
            isDisabled={isFetching}
            onClick={() => void refetch()}>
            {t('label.refresh')}
          </Button>
        }
        subtitle={t('message.mcp-client-inventory-description')}
        title={t('label.mcp-registered-clients')}
      />
      <Card.Content>
        {isError ? (
          <Box direction="col" gap={3}>
            <Typography role="alert">
              {t('message.mcp-clients-load-error')}
            </Typography>
            <Button color="secondary" onClick={() => void refetch()}>
              {t('label.retry')}
            </Button>
          </Box>
        ) : null}
        {!isError && isLoading && <Loader />}
        {!isError && !isLoading && (
          <Table aria-label={t('label.mcp-registered-clients')}>
            <Table.Header>
              <Table.Head isRowHeader id="name" label={t('label.name')} />
              <Table.Head id="clientId" label={t('label.client-id')} />
              <Table.Head
                id="redirectUris"
                label={t('label.mcp-redirect-uris')}
              />
              <Table.Head id="issuedAt" label={t('label.created-at')} />
              <Table.Head
                id="accessTokens"
                label={t('label.mcp-active-access-tokens')}
              />
              <Table.Head
                id="refreshTokens"
                label={t('label.mcp-active-refresh-tokens')}
              />
              <Table.Head id="actions" label={t('label.action-plural')} />
            </Table.Header>
            <Table.Body
              items={clients}
              renderEmptyState={() => (
                <Typography>{t('message.mcp-no-clients')}</Typography>
              )}>
              {(client) => (
                <Table.Row id={client.clientId} key={client.clientId}>
                  <Table.Cell>
                    {client.clientName ?? client.clientId}
                  </Table.Cell>
                  <Table.Cell>
                    <span className="tw:break-all">{client.clientId}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <Box direction="col" gap={1}>
                      {client.redirectUris?.map((uri) => (
                        <span className="tw:break-all" key={uri}>
                          {uri}
                        </span>
                      ))}
                    </Box>
                  </Table.Cell>
                  <Table.Cell>
                    {client.issuedAt == null
                      ? '—'
                      : new Date(client.issuedAt).toLocaleString()}
                  </Table.Cell>
                  <Table.Cell>{client.activeAccessTokens ?? '—'}</Table.Cell>
                  <Table.Cell>{client.activeRefreshTokens ?? '—'}</Table.Cell>
                  <Table.Cell>
                    <Box direction="col" gap={2}>
                      <Button
                        color="secondary"
                        isDisabled={!client.clientId || revoke.isPending}
                        size="sm"
                        onClick={() => {
                          setRevokeTokensOnly(true);
                          setPendingClient(client);
                        }}>
                        {t('label.mcp-revoke-tokens')}
                      </Button>
                      <Button
                        color="primary-destructive"
                        isDisabled={!client.clientId || revoke.isPending}
                        size="sm"
                        onClick={() => {
                          setRevokeTokensOnly(false);
                          setPendingClient(client);
                        }}>
                        {t('label.mcp-remove-client')}
                      </Button>
                    </Box>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        )}
      </Card.Content>
      <Card.Footer>
        <Box gap={3}>
          <Button
            color="secondary"
            isDisabled={cursors.length === 1 || isFetching}
            onClick={() => setCursors((previous) => previous.slice(0, -1))}>
            {t('label.previous')}
          </Button>
          <Button
            color="secondary"
            isDisabled={clients.length < 25 || isFetching || isError}
            onClick={() => {
              const cursor = clients.at(-1)?.clientId;
              if (cursor) {
                setCursors((previous) => [...previous, cursor]);
              }
            }}>
            {t('label.next')}
          </Button>
        </Box>
      </Card.Footer>
      <ModalOverlay
        isDismissable={!revoke.isPending}
        isOpen={Boolean(pendingClient)}
        onOpenChange={(open) => !open && closeDialog()}>
        <Modal>
          <Dialog dividers="scroll" onClose={closeDialog}>
            <Dialog.Header title={t(confirmation().title)} />
            <Dialog.Content>
              <Typography>
                {t(confirmation().message, {
                  name: pendingClient?.clientName ?? pendingClient?.clientId,
                })}
              </Typography>
              <Typography>{pendingClient?.clientId}</Typography>
            </Dialog.Content>
            <Dialog.Footer>
              <Button
                color="secondary"
                isDisabled={revoke.isPending}
                onClick={closeDialog}>
                {t('label.cancel')}
              </Button>
              <Button
                color="primary-destructive"
                isLoading={revoke.isPending}
                onClick={() =>
                  pendingClient?.clientId &&
                  revoke.mutate(pendingClient.clientId)
                }>
                {t('label.revoke')}
              </Button>
            </Dialog.Footer>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </Card>
  );
};

export default McpClientsTable;
