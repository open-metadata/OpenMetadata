import React, { useEffect, useState } from 'react';
import { Button, Col, Progress, Row, Space, Typography } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import PageLayoutV1 from '../components/PageLayoutV1/PageLayoutV1';
import progress from 'antd/lib/progress';
import { t } from 'i18next';
import { LazyLog } from 'react-lazylog';
import CopyToClipboardButton from '../components/common/CopyToClipboardButton';
import Paragraph from 'antd/lib/skeleton/Paragraph';

const DownloadYAML = () => {
    const [yaml, setYaml] = useState<string>('');

    const handleDownload = async () => {
        try {
            const response = await fetch('http://localhost:8001/api/yaml/download');

            if (!response.ok) {
                throw new Error('Failed to download file');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = 'config.yaml';
            document.body.appendChild(a);
            a.click();
            a.remove();

            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading file:', error);
        }
    };

    const fetchFileContent = async () => {
        try {
            const response = await fetch('http://localhost:8001/api/yaml');

            if (!response.ok) {
                throw new Error('Failed to fetch file content');
            }

            const content = await response.text();
            setYaml(content);
        } catch (err) {
            setYaml('Failed to load yaml');
        }
    };

    useEffect(() => {
        fetchFileContent();
    }, []);

    return (
        <PageLayoutV1 pageTitle={t('label.log-viewer')}>
            <Space align="start" className="w-full m-md m-t-xs" direction="vertical">
                <Space>
                    <Typography.Title level={5}>
                        View or Download Yaml
                    </Typography.Title>
                </Space>
            </Space>

            <Row className="border-top">
                <Col className="p-md border-right" span={16}>
                    <Row className="relative" gutter={[16, 16]}>
                        <Col span={24}>
                            <Row justify="end">
                                <Col>
                                    <CopyToClipboardButton copyText={yaml} />
                                </Col>
                                <Col>

                                    <Button
                                        className="h-8 m-l-md relative flex-center"
                                        data-testid="download"
                                        icon={
                                            <DownloadOutlined
                                                data-testid="download-icon"
                                                width="16"
                                            />
                                        }
                                        type="text"
                                        onClick={handleDownload}
                                    />
                                </Col>
                            </Row>
                        </Col>
                        <Col
                            className="h-min-80 lazy-log-container"
                            data-testid="lazy-log"
                            span={24}>
                            <LazyLog
                                caseInsensitive
                                enableSearch
                                selectableLines
                                extraLines={1}
                                text={yaml || 'No content to display'}
                            />
                        </Col>
                    </Row>
                </Col>
                <Col span={8}>
                    <Space
                        className="p-md w-full"
                        data-testid="summary-card"
                        direction="vertical">
                        <Typography.Title level={5}>
                            Next steps
                        </Typography.Title>

                        <div>
                            <Typography.Text type="secondary">
                                You can now run the ingestion via:
                            </Typography.Text>
                            <Space direction="vertical" className="mt-4">
                                <Typography.Text keyboard>
                                    metadata ingest/profile/test/usage -c file.yaml
                                </Typography.Text>
                            </Space>
                            <Space direction="vertical" className="mt-4">
                                <Typography.Text type="secondary">
                                    If you want to schedule the ingestion, check some examples in the
                                    docs <a href="https://docs.open-metadata.org/latest/deployment/ingestion">here</a>
                                </Typography.Text>
                            </Space>
                        </div>
                    </Space>
                </Col>
            </Row>
        </PageLayoutV1>
    );
};

const styles = {
    container: {
        padding: '20px',
        display: 'flex',
        justifyContent: 'center',
    },
    yamlBox: {
        border: '1px solid #d9d9d9',
        borderRadius: '4px',
        padding: '20px',
        marginBottom: '20px',
        backgroundColor: '#fafafa',
        textAlign: 'left' as const, // Align text to the left
        fontFamily: 'monospace',
        maxHeight: '400px', // Set max height to make it scrollable
        overflow: 'auto', // Enable scrolling when content overflows
        whiteSpace: 'pre-wrap', // Preserve white spaces and wrap lines if necessary
    },
    yamlText: {
        whiteSpace: 'pre-wrap', // Maintain the format of YAML (preformatted text)
        fontSize: '14px',
        lineHeight: '1.5',
        color: '#595959',
    },
    commandBox: {
        backgroundColor: '#f0f5ff',
        padding: '15px',
    },
    footer: {
        marginTop: '20px',
        textAlign: 'center' as const,
    },
};

export default DownloadYAML;