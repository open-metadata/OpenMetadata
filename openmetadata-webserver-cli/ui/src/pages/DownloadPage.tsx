import React from 'react';
import { Button, Card, Typography } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';

const { Text, Paragraph, Link } = Typography;

const DownloadYAML = () => {
    const handleDownload = () => {
        // Function to handle YAML download
        alert('Downloading YAML...');
    };

    const dummyYAML = `
    version: 1.0
    service:
      name: sample_service
      description: "This is a dummy YAML for example purposes."
      config:
        host: localhost
        port: 5432
        username: admin
        password: secret
    metadata:
      ingest: true
      profile: true
  `;

    return (
        <div style={styles.container}>
            <Card style={styles.card} bordered={false}>
                <div style={styles.header}>
                    <Text strong>Download</Text>
                    <Button
                        icon={<DownloadOutlined />}
                        type="primary"
                        onClick={handleDownload}
                    >
                        Download YAML
                    </Button>
                </div>

                <div style={styles.yamlBox}>
                    <Paragraph code style={styles.yamlText}>
                        {dummyYAML}
                    </Paragraph>
                </div>

                <Card bordered={false} style={styles.commandBox}>
                    <Paragraph>
                        <Text>You can now run the ingestion via:</Text>
                    </Paragraph>
                    <Paragraph code>metadata ingest/profile/test/usage -c file.yaml</Paragraph>
                </Card>

                <div style={styles.footer}>
                    <Text>
                        If you want to schedule the ingestion, check some examples in the
                        docs&nbsp;
                        <Link href="#" target="_blank">
                            here
                        </Link>
                    </Text>
                </div>
            </Card>
        </div>
    );
};

const styles = {
    container: {
        padding: '20px',
        display: 'flex',
        justifyContent: 'center',
    },
    card: {
        maxWidth: '800px',
        width: '100%',
        padding: '20px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '20px',
    },
    yamlBox: {
        border: '1px solid #d9d9d9',
        borderRadius: '4px',
        padding: '20px',
        marginBottom: '20px',
        backgroundColor: '#fafafa',
        textAlign: 'left' as const, // Align text to the left
        fontFamily: 'monospace',
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