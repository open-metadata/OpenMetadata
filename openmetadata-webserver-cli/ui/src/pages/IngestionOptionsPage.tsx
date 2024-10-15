import { Row, Col, Tabs } from "antd";
import PageLayoutV1 from "../components/PageLayoutV1/PageLayoutV1";
import React from "react";
import { PAGE_HEADERS } from "../constants/PageHeaders.constant";
import IngestionOptions from "../components/Settings/Services/IngestionOptions/IngestionOptions";

const IngestionOptionsPage = () => {
    return (
        <PageLayoutV1 pageTitle={PAGE_HEADERS.INGESTION_OPTIONS.header}>
            <Row className="page-container" gutter={[0, 16]}>
                <Col span={24}>
                    <Tabs
                        destroyInactiveTabPane
                        items={[
                            ...([
                                {
                                    key: 'services',
                                    children: <IngestionOptions />,
                                    label: 'Ingestion',
                                },
                            ]),
                            // pipelines are not supported for apiServices so don't show pipelines tab for apiServices
                            ...([]),
                        ]}
                        onChange={(activeKey) =>
                            null
                        }
                    />
                </Col>
            </Row >
        </PageLayoutV1 >
    );
}

export default IngestionOptionsPage;