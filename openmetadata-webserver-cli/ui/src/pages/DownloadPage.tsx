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

    const fetchFileContent = () => {
        fetchYaml()
            .then(response => setYaml(response.data))
            .catch(error => setYaml(`Failed to load yaml ${error.message}`));
    }

    useEffect(() => {
        fetchFileContent();
    }, []);

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
                                text={yaml || 'No content to display'}
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