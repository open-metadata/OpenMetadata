
import { SaveInitRequest, ServicesUpdateRequest } from 'Models';
import APIClient from '../rest/index';
import { CreateIngestionPipeline } from '../generated/api/services/ingestionPipelines/createIngestionPipeline';

export const saveInit = (initData: SaveInitRequest) =>
    APIClient.post('/init', initData);

export const saveConnection = (serviceData: ServicesUpdateRequest) =>
    APIClient.post('/connection', serviceData, { withCredentials: true });

export const saveIngestion = (ingestion: CreateIngestionPipeline) =>
    APIClient.post('/ingestion', ingestion);
