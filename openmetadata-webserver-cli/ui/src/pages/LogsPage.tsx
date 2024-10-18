import React, { useEffect, useState } from 'react';
import { Button, Col, Row, Space, Tooltip, Typography } from 'antd';
import PageLayoutV1 from '../components/PageLayoutV1/PageLayoutV1';
import { LazyLog } from 'react-lazylog';
import { runIngestion } from '../utils/APIUtils';
import { ReactComponent as ResumeIcon } from '../assets/svg/ic-play-button.svg';
import { useLocation } from 'react-router-dom';

interface LogsPageProps {
    autoStart?: boolean;
}

export const LogsPage = ({ autoStart = false }: LogsPageProps) => {
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

    useEffect(() => {
        let isMounted = true; // Flag to track whether component is still mounted
        if (autoStart && !isFetching) {
            const fetchLogsInternal = async () => {
                setIsFetching(true);

                try {
                    // Simulate a fetch or async task (e.g., API call)
                    await fetchLogs();

                    if (isMounted) {
                        // Only update state if the component is still mounted
                        console.log('Logs fetched, updating state');
                        setIsFetching(false);
                    }
                } catch (error) {
                    if (isMounted) {
                        console.error('Error fetching logs:', error);
                    }
                }
            };

            fetchLogsInternal();
        }

        // Cleanup function to run when the component unmounts
        return () => {
            isMounted = false; // Mark the component as unmounted
        };
    }, []);

    return (
        <PageLayoutV1 pageTitle="Run Ingestion">
            <Space align="start" className="w-full m-md m-t-xs" direction="vertical">
                <Space>
                    <Typography.Title level={5}>
                        Run Ingestion
                    </Typography.Title>
                </Space>
            </Space>

            <Row className="page-container" gutter={[0, 16]}>
                <Col span={24}>
                    <Tooltip title="Run the ingestion now">
                        <Button type="primary"
                            disabled={isFetching}
                            icon={<ResumeIcon height={16} width={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />}
                            onClick={handleRunIngestion}
                        >
                            {isFetching ? 'Running...' : 'Run now'}
                        </Button>
                    </Tooltip>
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
                <div className="d-flex w-full justify-end">
                    <Space>
                        <Button type="link" onClick={() => history.back}>
                            Back
                        </Button>
                    </Space>
                </div>
            </Row>
        </PageLayoutV1 >
    );
};

export const LogsPageWrapper = () => {
    const location = useLocation();
    const autoStart = location.pathname === '/logs/start';

    console.log('Autostart', autoStart);

    return <LogsPage autoStart={autoStart} />;
};
