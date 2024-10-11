import React from 'react';
import { useTranslation } from 'react-i18next';
import { PipelineType } from '../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { Row, Col, Space, PageHeader, Button, Card, Typography } from 'antd';
import { DomainSupportedServiceTypes } from '../../../../interface/service.interface';
import { ListView } from '../../../common/ListView/ListView.component';
import { Link } from 'react-router-dom';
import { getServiceLogo } from '../../../../utils/CommonUtils';
import { getOptionalFields } from '../../../../utils/ServiceUtils';
import RichTextEditorPreviewer from '../../../common/RichTextEditor/RichTextEditorPreviewer';

export type PipelineOptions =
    | PipelineType.Metadata
    | PipelineType.Profiler
    | PipelineType.Lineage
    | PipelineType.Usage
    | PipelineType.Dbt
    | PipelineType.DataInsight

export interface PipelineOption {
    name: string;
    pipelineType: PipelineType;
}

const IngestionOptions = () => {
    const { t } = useTranslation();
    const handleClick = (name: string) => {
        alert(`You clicked on ${name}`);
    };

    const pipelineOptionCardRenderer = (pipeline: PipelineOption) => {
        return (
            <Col key={pipeline} lg={8} xl={6}>
                <Card className="w-full" size="small">
                    <div
                        className="d-flex justify-between text-grey-muted"
                        data-testid="service-card">
                        <Row gutter={[0, 6]}>
                            <Col span={24}>
                                <Link
                                    className="no-underline"
                                    to="#">
                                    <Typography.Text
                                        className="text-base text-grey-body font-medium truncate w-48 d-inline-block"
                                        title={pipeline.name}>
                                        {pipeline.name}
                                    </Typography.Text>
                                </Link>
                            </Col>
                            <Col span={24}>
                                <div className="m-b-xss" data-testid="service-type">
                                    <label className="m-b-0">{`${t('label.type')}:`}</label>
                                    <span className="font-normal m-l-xss text-grey-body">
                                        {pipeline.name}]
                                    </span>
                                </div>
                            </Col>
                        </Row>
                    </div>
                </Card>
            </Col>
        );
    };

    const serviceDetails: Array<PipelineOption> = [
        {
            name: PipelineType.Metadata,
            pipelineType: PipelineType.Metadata
        } as PipelineOption,
        {
            name: PipelineType.Dbt,
            pipelineType: PipelineType.Dbt
        } as PipelineOption,
    ];

    return (
        <Row
            className="justify-center m-b-md"
            data-testid="services-container"
            gutter={[16, 16]}>
            <Col span={24}>
                <Space className="w-full justify-between m-b-lg" data-testid="header">
                    {/* <PageHeader data="Choose the Ingestion" /> */}

                    <Button
                        className="m-b-xs"
                        data-testid="add-service-button"
                        size="middle"
                        type="primary"
                        onClick={() => null}>
                        {t('label.add-new-entity', {
                            entity: t('label.service'),
                        })}
                    </Button>
                </Space>
            </Col>
            <Col span={24}>
                {serviceDetails.map(pipelineOptionCardRenderer)}
                {/* <ListView<PipelineOption>
                    cardRenderer={pipelineOptionCardRenderer}
                    deleted={false}
                    handleDeletedSwitchChange={() => null}

                    searchProps={{
                        onSearch: () => null,
                        search: "",
                    }}
                    tableProps={{
                        dataSource: serviceDetails,
                    }}
                /> */}
            </Col>
        </Row>
    );

    // return (
    //     <div style={styles.container}>
    //         <div style={styles.header}>
    //             <div style={styles.logo}>Logo</div>
    //             <div style={styles.title}>Choose the ingestion</div>
    //         </div>

    //         <div style={styles.grid}>
    //             {Object.values(PipelineType).map((pipelineType) => (
    //                 <div
    //                     key={pipelineType}
    //                     style={styles.square}
    //                     onClick={() => handleClick(pipelineType)}
    //                 >
    //                     {pipelineType}
    //                 </div>
    //             ))}
    //         </div>
    //     </div>
    // );
};

// const styles = {
//     container: {
//         display: 'flex',
//         flexDirection: 'column' as const,
//         alignItems: 'center',
//         padding: '20px',
//         fontFamily: 'Arial, sans-serif',
//     },
//     header: {
//         display: 'flex',
//         flexDirection: 'column' as const,
//         alignItems: 'center',
//         marginBottom: '20px',
//     },
//     logo: {
//         borderRadius: '50%',
//         width: '50px',
//         height: '50px',
//         display: 'flex',
//         justifyContent: 'center',
//         alignItems: 'center',
//         border: '2px solid black',
//         marginBottom: '10px',
//     },
//     title: {
//         fontSize: '20px',
//         marginBottom: '20px',
//     },
//     grid: {
//         display: 'grid',
//         gridTemplateColumns: 'repeat(2, 1fr)',
//         gap: '20px',
//         width: '400px',
//     },
//     square: {
//         display: 'flex',
//         flexDirection: 'column' as const,
//         justifyContent: 'center',
//         alignItems: 'center',
//         width: '150px',
//         height: '100px',
//         border: '2px solid black',
//         cursor: 'pointer',
//         textAlign: 'center' as const,
//         padding: '10px',
//     },
// };

export default IngestionOptions;