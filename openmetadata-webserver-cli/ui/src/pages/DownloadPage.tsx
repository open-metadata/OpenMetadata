import React, { useEffect, useState } from 'react';
import { Button, Col, Row, Typography } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import BrandImage from '../components/common/BrandImage/BrandImage';
import PageLayoutV1 from '../components/PageLayoutV1/PageLayoutV1';

const { Text, Paragraph, Link } = Typography;

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
        <PageLayoutV1 pageTitle="download">
            <div style={styles.container}>
                <Row className="h-full">

                    <Col className="bg-white" span={24}>
                        <div
                            className="mt-10 text-left flex flex-col items-start">
                            <BrandImage height="auto" width={200} />
                            <Button
                                icon={<DownloadOutlined />}
                                type="primary"
                                onClick={handleDownload}
                                className="mt-4 mb-4"
                            >
                                Download YAML
                            </Button>
                        </div>
                    </Col>
                    <Col span={24}>
                        <div style={styles.yamlBox} className="mx-10">
                            <Paragraph code style={styles.yamlText}>
                                {yaml}
                            </Paragraph>
                        </div>
                    </Col>
                    <Col span={24}>
                        <div style={styles.commandBox} className="mx-10">
                            <Paragraph>
                                <Text>You can now run the ingestion via:</Text>
                            </Paragraph>
                            <Paragraph code>metadata ingest/profile/test/usage -c file.yaml</Paragraph>
                        </div>
                    </Col>
                    <Col span={24}>
                        <div style={styles.footer} className="mx-10 text-center">
                            <Paragraph>
                                If you want to schedule the ingestion, check some examples in the
                                docs <a href="https://docs.open-metadata.org/latest/deployment/ingestion">here</a>
                            </Paragraph>
                        </div>
                    </Col>
                </Row>
            </div>
        </PageLayoutV1 >
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