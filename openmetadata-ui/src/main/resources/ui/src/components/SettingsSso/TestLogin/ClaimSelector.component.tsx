/*
 *  Copyright 2025 Collate.
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

import { Button, Radio, Table, Tag, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClaimSelectorProps } from './TestLogin.interface';

interface ClaimRow {
  key: string;
  claimName: string;
  value: string;
}

const ClaimSelector: React.FC<ClaimSelectorProps> = ({
  result,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [selectedClaim, setSelectedClaim] = useState<string>(
    result.suggestedEmailClaim ?? ''
  );

  const claimRows: ClaimRow[] = useMemo(
    () =>
      Object.entries(result.claims).map(([claimName, value]) => ({
        key: claimName,
        claimName,
        value: String(value),
      })),
    [result.claims]
  );

  const selectedEmail = result.claims[selectedClaim] ?? '';
  const derivedDomain = selectedEmail.includes('@')
    ? selectedEmail.split('@')[1]
    : result.derivedPrincipalDomain ?? '';
  const derivedAdmin = selectedEmail.includes('@')
    ? selectedEmail
    : result.suggestedAdminPrincipal ?? '';

  const columns: ColumnsType<ClaimRow> = [
    {
      dataIndex: 'claimName',
      key: 'claimName',
      render: (text: string) => <code>{text}</code>,
      title: t('label.claim-name'),
    },
    {
      dataIndex: 'value',
      key: 'value',
      render: (text: string) => (
        <Typography.Text ellipsis={{ tooltip: text }} style={{ maxWidth: 300 }}>
          {text}
        </Typography.Text>
      ),
      title: t('label.value'),
    },
    {
      dataIndex: 'select',
      key: 'select',
      render: (_: unknown, record: ClaimRow) => (
        <Radio
          checked={selectedClaim === record.claimName}
          onChange={() => setSelectedClaim(record.claimName)}
        />
      ),
      title: t('label.select-as-email-claim'),
    },
  ];

  const handleConfirm = () => {
    if (selectedClaim) {
      onConfirm(selectedClaim, derivedDomain, derivedAdmin);
    }
  };

  return (
    <div className="m-t-md">
      <Typography.Title level={5}>
        {t('message.claims-received-from-idp')}
      </Typography.Title>

      <Table
        bordered
        columns={columns}
        dataSource={claimRows}
        pagination={false}
        rowClassName={(record) =>
          record.claimName === selectedClaim ? 'ant-table-row-selected' : ''
        }
        size="small"
      />

      <div className="m-t-md p-md bg-grey-1 rounded-4">
        <Typography.Text strong>
          {t('label.auto-derived-from-selection')}
        </Typography.Text>
        <div className="m-t-xs">
          <div>
            {`${t('label.email-claim')}: `}
            <code>{selectedClaim || '—'}</code>
          </div>
          <div>
            {`${t('label.principal-domain')}: `}
            <code>{derivedDomain || '—'}</code>
          </div>
          <div>
            {`${t('label.admin-principal')}: `}
            <code>{derivedAdmin || '—'}</code>
          </div>
          <div>
            {`${t('label.refresh-token')}: `}
            {result.hasRefreshToken ? (
              <Tag color="success">
                {`\u2713 ${t('label.received')}`}
              </Tag>
            ) : (
              <Tag color="warning">
                {`\u26A0 ${t('message.no-refresh-token')}`}
              </Tag>
            )}
          </div>
        </div>
      </div>

      <div className="d-flex gap-3 m-t-md">
        <Button
          disabled={!selectedClaim}
          type="primary"
          onClick={handleConfirm}>
          {t('label.confirm-email-claim')}
        </Button>
        <Button onClick={onCancel}>{t('label.cancel')}</Button>
      </div>
    </div>
  );
};

export default ClaimSelector;
