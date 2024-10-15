import React from 'react';
import { useTranslation } from 'react-i18next';
import { PipelineType } from '../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { Row, Col, Space, Button, Card, Typography } from 'antd';
import { Link, useHistory } from 'react-router-dom';
import { GlobalSettingOptions } from '../../../../constants/GlobalSettings.constants';
import { ReactComponent as IngestionIcon } from '../../../../assets/svg/ingestion.svg';
import SettingItemCard from '../../SettingItemCard/SettingItemCard.component';
import { PAGE_HEADERS } from '../../../../constants/PageHeaders.constant';
import PageHeader from '../../../PageHeader/PageHeader.component';
import { ServiceCategory } from '../../../../enums/service.enum';

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
    const history = useHistory();

    const handlePipelineOptionClick = (key: string) => {
        const [category, option] = key.split('.');
        history.push(`ingestion/${category}/${option}`)
    }

    const ingestionOptionItems = [
        {
            label: 'Metadata',
            description: t('label.metadata-ingestion'),
            isProtected: false,
            key: `${ServiceCategory.DATABASE_SERVICES}.metadata`,
            icon: IngestionIcon,
        },
        {
            label: 'Profiler',
            description: t('label.profiler-ingestion'),
            isProtected: false,
            key: `${ServiceCategory.DATABASE_SERVICES}.profiler`,
            icon: IngestionIcon,
        },
        {
            label: 'Lineage',
            description: t('label.lineage-ingestion'),
            isProtected: false,
            key: `${ServiceCategory.DATABASE_SERVICES}.lineage`,
            icon: IngestionIcon,
        },
        {
            label: 'Usage',
            description: t('label.usage-ingestion'),
            isProtected: false,
            key: `${ServiceCategory.DATABASE_SERVICES}.usage`,
            icon: IngestionIcon,
        },
        {
            label: 'Dbt',
            description: t('label.dbt-ingestion'),
            isProtected: false,
            key: `${ServiceCategory.DATABASE_SERVICES}.dbt`,
            icon: IngestionIcon,
        },
        {
            label: 'Data Quality',
            description: t('label.data-quailty-ingestion', "Data quality ingestion"),
            isProtected: false,
            key: `${ServiceCategory.DATABASE_SERVICES}.dbt`,
            icon: IngestionIcon,
        },
    ];

    return (
        <Row
            className="justify-center m-b-md"
            data-testid="services-container"
            gutter={[16, 16]}>
            <Col span={24}>
                <Space className="w-full justify-between m-b-lg" data-testid="header">
                    <PageHeader data={PAGE_HEADERS.INGESTION_OPTIONS} />

                </Space>
            </Col>
            <Col span={24}>
                <Row gutter={[20, 20]}>
                    {ingestionOptionItems.map((option) => (
                        <Col key={option?.key} span={4}>
                            <SettingItemCard
                                data={option}
                                onClick={handlePipelineOptionClick}
                            />
                        </Col>
                    ))}
                </Row>
            </Col>
        </Row>
    );

};


export default IngestionOptions;