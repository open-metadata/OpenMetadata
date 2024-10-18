import React, { useEffect, useState } from 'react';
import { Button, Col, Row, Space, Tooltip, Typography } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import PageLayoutV1 from '../components/PageLayoutV1/PageLayoutV1';
import { LazyLog } from 'react-lazylog';
import CopyToClipboardButton from '../components/common/CopyToClipboardButton';
import { downloadYaml, fetchYaml, runIngestion } from '../utils/APIUtils';
import { ReactComponent as ResumeIcon } from '../assets/svg/ic-play-button.svg';

const DownloadYAML = () => {
    const [yaml, setYaml] = useState<string>('');
    const [isFetching, setIsFetching] = useState(false);
    const [logs, setLogs] = useState<string>('');

    const fetchLogs = async () => {
        setIsFetching(true);
        try {
            const response = await runIngestion();

            if (!response.body) {
                console.error('No response body found');
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');

            // Temporary variable to hold fetched logs
            let receivedLogs = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });

                // Append the chunk to the temporary variable
                receivedLogs += chunk;

                // Set logs to re-render the LazyLog component with new data
                // Appends a line break between prevLogs and chunk
                setLogs((prevLogs) => `${prevLogs}\n${chunk}`);
            }
        } catch (error) {
            setLogs('Logs could not be fetched...');
            console.error('Error fetching logs:', error);
        } finally {
            setIsFetching(false);
        }
    };

    const handleRunIngestion = () => {
        fetchLogs();
    };

    const handleDownload = async () => {
        try {
            const response = await downloadYaml();

            if (response.status !== 200) {
                throw new Error('Failed to download file');
            }

            const blob = response.data;
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
            alert(`An error ocurred while download the file ${error}`);
        }
    };

    // useEffect(() => {
    //     fetchFileContent();
    // }, []);

    return (
        <PageLayoutV1 pageTitle="View or Download Yaml">
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
                                text={logs || 'No content to display'}
                                follow
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
                        <Space direction="vertical" className="mt-2 mb-4">
                            <Tooltip title="Run the ingestion with the yaml">
                                <Button type="primary"
                                    disabled={isFetching}
                                    icon={<ResumeIcon height={16} width={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />}
                                    onClick={handleRunIngestion}
                                >
                                    {isFetching ? 'Running...' : 'Run now'}
                                </Button>
                            </Tooltip>
                        </Space>
                        <Typography.Text type="secondary">
                            You can also run the ingestion via:
                        </Typography.Text>
                        <Space direction="vertical" className="mt-2">
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

                    </Space>
                </Col>
            </Row>
        </PageLayoutV1 >
    );
};

export default DownloadYAML;