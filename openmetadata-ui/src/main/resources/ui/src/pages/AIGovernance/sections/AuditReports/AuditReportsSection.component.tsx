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

import { AxiosError } from 'axios';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AIGovernanceFramework,
  listFrameworks,
} from '../../../../rest/aiGovernanceFrameworkAPI';
import {
  AuditReport,
  AuditReportFormat,
  AuditReportScope,
  AuditReportStatus,
  cancelReport,
  createReport,
  getReportArtifactUrl,
  listReports,
} from '../../../../rest/auditReportAPI';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import {
  Button,
  Checkbox,
  Input,
  Modal,
  Select,
  Spin,
} from '../../components/AIGovUntitled.component';
import {
  IcCheck,
  IcDownload,
  IcFile,
  IcPlus,
  IcScale,
  IcStop,
  IcX,
} from '../../icons/AIGovIcons';
import './audit-reports-section.less';

const STATUS_PILL: Record<AuditReportStatus, string> = {
  Queued: 'ai-gov-pill--info',
  Running: 'ai-gov-pill--info',
  Completed: 'ai-gov-pill--success',
  Failed: 'ai-gov-pill--error',
  Cancelled: 'ai-gov-pill--quiet',
};
const GENERATE_SEARCH_PARAM = 'generate';

const formatBytes = (bytes?: number): string => {
  if (!bytes || bytes <= 0) {
    return '—';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
};

const formatTimestamp = (timestamp?: number): string =>
  timestamp ? new Date(timestamp).toLocaleString() : '—';

const downloadArtifact = (report: AuditReport) => {
  const url = getReportArtifactUrl(report, 'Json');
  if (!url) {
    return;
  }
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${report.name}.json`;
  anchor.target = '_blank';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
};

const AuditReportsSection = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [reports, setReports] = useState<AuditReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get(GENERATE_SEARCH_PARAM) !== '1') {
      return;
    }

    setModalOpen(true);
    searchParams.delete(GENERATE_SEARCH_PARAM);
    const nextSearch = searchParams.toString();
    navigate(`${location.pathname}${nextSearch ? `?${nextSearch}` : ''}`, {
      replace: true,
    });
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const response = await listReports({ limit: 100 });
        if (!cancelled) {
          const sorted = [...response.data].sort(
            (a, b) => (b.requestedAt ?? 0) - (a.requestedAt ?? 0)
          );
          setReports(sorted);
        }
      } catch (error) {
        if (!cancelled) {
          showErrorToast(error as AxiosError);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    const hasActive = reports.some(
      (r) => r.status === 'Queued' || r.status === 'Running'
    );
    if (hasActive) {
      pollRef.current = window.setTimeout(() => {
        setRefreshKey((k) => k + 1);
      }, 4000);
    }

    return () => {
      if (pollRef.current != null) {
        window.clearTimeout(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [reports]);

  const handleCancel = async (report: AuditReport) => {
    if (!report.id) {
      return;
    }
    try {
      await cancelReport(report.id);
      showSuccessToast(t('message.report-cancelled'));
      setRefreshKey((k) => k + 1);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  return (
    <div className="ai-gov-rep">
      <div className="ai-gov-rep-intent">
        <div className="ai-gov-rep-intent-icon">
          <IcScale />
        </div>
        <div style={{ flex: 1 }}>
          <div className="ai-gov-rep-intent-title">
            {t('message.audit-reports-intent-title')}
          </div>
          <div className="ai-gov-rep-intent-sub">
            {t('message.audit-reports-intent-sub')}
          </div>
        </div>
        <Button
          className="ai-gov-rep-btn-primary"
          type="button"
          onClick={() => setModalOpen(true)}>
          <IcPlus style={{ width: 14, height: 14 }} />
          {t('label.export-audit-pack')}
        </Button>
      </div>

      <div className="ai-gov-rep-section-head">
        <div className="ai-gov-rep-section-title">
          {t('label.generated-reports')}
        </div>
        <span className="ai-gov-pill ai-gov-pill--quiet">
          {t('label.count-generated', { count: reports.length })}
        </span>
        <div className="ai-gov-rep-spacer" />
      </div>

      <div className="ai-gov-rep-card">
        {loading ? (
          <div className="ai-gov-rep-empty">
            <Spin size="large" />
          </div>
        ) : reports.length === 0 ? (
          <div className="ai-gov-rep-empty">
            <IcFile className="ai-gov-rep-empty-icon" />
            <div className="ai-gov-rep-empty-text">
              {t('message.no-audit-reports')}
            </div>
          </div>
        ) : (
          <table className="ai-gov-rep-table">
            <thead>
              <tr>
                <th>{t('label.report')}</th>
                <th>{t('label.framework')}</th>
                <th>{t('label.scope')}</th>
                <th>{t('label.format')}</th>
                <th>{t('label.status')}</th>
                <th>{t('label.requested')}</th>
                <th>{t('label.size')}</th>
                <th>{t('label.action-plural')}</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => {
                const artifact = report.artifacts?.[0];
                const isActive =
                  report.status === 'Queued' || report.status === 'Running';

                return (
                  <tr key={report.id}>
                    <td>
                      <div className="ai-gov-rep-name-cell">
                        <span className="ai-gov-rep-name-icon">
                          <IcFile />
                        </span>
                        <div>
                          <div className="ai-gov-rep-name">
                            {report.displayName ?? report.name}
                          </div>
                          <div className="ai-gov-rep-name-sub">
                            {report.fullyQualifiedName ?? report.name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="ai-gov-rep-cell-text">
                        {report.framework?.displayName ??
                          report.framework?.name ??
                          t('label.all-frameworks')}
                      </span>
                    </td>
                    <td>
                      <span className="ai-gov-rep-cell-text">
                        {report.scope}
                        {report.scopeTarget
                          ? ` · ${
                              report.scopeTarget.displayName ??
                              report.scopeTarget.name
                            }`
                          : ''}
                      </span>
                    </td>
                    <td>
                      <span className="ai-gov-rep-cell-text">
                        {report.format}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`ai-gov-rep-status ai-gov-pill ${
                          STATUS_PILL[report.status]
                        }`}>
                        {isActive && <span className="ai-gov-rep-spinner" />}
                        {!isActive && <span className="ai-gov-pill-dot" />}
                        {report.status}
                      </span>
                    </td>
                    <td>
                      <span className="ai-gov-rep-cell-muted">
                        {formatTimestamp(report.requestedAt)}
                      </span>
                    </td>
                    <td>
                      <span className="ai-gov-rep-cell-mono">
                        {formatBytes(artifact?.sizeBytes)}
                      </span>
                    </td>
                    <td>
                      <div className="ai-gov-rep-actions">
                        {report.status === 'Completed' && artifact && (
                          <Button
                            className="ai-gov-rep-btn-sm-primary"
                            type="button"
                            onClick={() => downloadArtifact(report)}>
                            <IcDownload style={{ width: 12, height: 12 }} />
                            {t('label.download')}
                          </Button>
                        )}
                        {isActive && (
                          <Button
                            className="ai-gov-rep-btn-sm-secondary"
                            type="button"
                            onClick={() => handleCancel(report)}>
                            <IcStop style={{ width: 12, height: 12 }} />
                            {t('label.cancel')}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <ExportPackModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmitted={() => {
          setModalOpen(false);
          setRefreshKey((k) => k + 1);
        }}
      />
    </div>
  );
};

const ExportPackModal = ({
  open,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) => {
  const { t } = useTranslation();
  const [frameworks, setFrameworks] = useState<AIGovernanceFramework[]>([]);
  const [name, setName] = useState('');
  const [framework, setFramework] = useState<string>('');
  const [scope, setScope] = useState<AuditReportScope>('Estate');
  const [format, setFormat] = useState<AuditReportFormat>('Json');
  const [includeRedacted, setIncludeRedacted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const response = await listFrameworks({ limit: 100 });
        if (!cancelled) {
          setFrameworks(response.data);
        }
      } catch {
        if (!cancelled) {
          setFrameworks([]);
        }
      }
    };
    load();
    setName(`audit_pack_${new Date().toISOString().slice(0, 10)}`);
    setFramework('');
    setScope('Estate');
    setFormat('Json');
    setIncludeRedacted(false);

    return () => {
      cancelled = true;
    };
  }, [open]);

  const enabledFrameworks = useMemo(
    () => frameworks.filter((f) => f.enabled),
    [frameworks]
  );

  const handleSubmit = async () => {
    if (!name.trim()) {
      showErrorToast(t('message.report-name-required'));

      return;
    }
    setSubmitting(true);
    try {
      await createReport({
        name: name.trim(),
        framework: framework || undefined,
        scope,
        format,
        includeRedacted,
      });
      showSuccessToast(t('message.audit-pack-queued'));
      onSubmitted();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      centered
      className="ai-gov-rep-modal"
      closable={false}
      footer={null}
      maskClosable={!submitting}
      open={open}
      width={640}
      onCancel={onClose}>
      <div className="ai-gov-rep-modal-head">
        <div className="ai-gov-rep-modal-icon">
          <IcScale />
        </div>
        <div style={{ flex: 1 }}>
          <div className="ai-gov-rep-modal-title">
            {t('label.export-audit-pack')}
          </div>
          <div className="ai-gov-rep-modal-sub">
            {t('message.export-audit-pack-sub')}
          </div>
        </div>
        <Button
          className="ai-gov-rep-btn-tertiary"
          style={{ width: 32, padding: 0 }}
          type="button"
          onClick={onClose}>
          <IcX />
        </Button>
      </div>

      <div className="ai-gov-rep-modal-body">
        <div className="ai-gov-rep-form-field">
          <div className="ai-gov-rep-form-label">{t('label.report-name')}</div>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="ai-gov-rep-form-grid">
          <div className="ai-gov-rep-form-field">
            <div className="ai-gov-rep-form-label">{t('label.framework')}</div>
            <Select
              options={[
                { label: t('label.all-frameworks'), value: '' },
                ...enabledFrameworks.map((fw) => ({
                  label: fw.displayName ?? fw.name,
                  value: fw.fullyQualifiedName ?? fw.name,
                })),
              ]}
              value={framework}
              onChange={setFramework}
            />
          </div>
          <div className="ai-gov-rep-form-field">
            <div className="ai-gov-rep-form-label">{t('label.scope')}</div>
            <div className="ai-gov-rep-segment">
              {(['Estate', 'Domain', 'Asset'] as AuditReportScope[]).map(
                (s) => (
                  <Button
                    className={`ai-gov-rep-segment-item ${
                      scope === s ? 'is-active' : ''
                    }`}
                    key={s}
                    type="button"
                    onClick={() => setScope(s)}>
                    {s}
                  </Button>
                )
              )}
            </div>
          </div>
        </div>

        <div className="ai-gov-rep-form-field">
          <div className="ai-gov-rep-form-label">{t('label.format')}</div>
          <div className="ai-gov-rep-segment">
            {(['Json', 'Pdf', 'Both'] as AuditReportFormat[]).map((f) => (
              <Button
                className={`ai-gov-rep-segment-item ${
                  format === f ? 'is-active' : ''
                }`}
                disabled={f === 'Pdf' || f === 'Both'}
                key={f}
                title={
                  f === 'Pdf' || f === 'Both' ? t('label.coming-soon') : ''
                }
                type="button"
                onClick={() => setFormat(f)}>
                {f}
              </Button>
            ))}
          </div>
        </div>

        <div className="ai-gov-rep-form-field">
          <Checkbox
            checked={includeRedacted}
            onChange={(e) => setIncludeRedacted(e.target.checked)}>
            {t('label.include-redacted')}
          </Checkbox>
        </div>
      </div>

      <div className="ai-gov-rep-modal-foot">
        <Button
          className="ai-gov-rep-btn-tertiary"
          type="button"
          onClick={onClose}>
          {t('label.cancel')}
        </Button>
        <div className="ai-gov-rep-spacer" />
        <Button
          className="ai-gov-rep-btn-primary"
          disabled={submitting}
          type="button"
          onClick={handleSubmit}>
          <IcCheck style={{ width: 14, height: 14 }} />
          {t('label.generate-pack')}
        </Button>
      </div>
    </Modal>
  );
};

export default AuditReportsSection;
