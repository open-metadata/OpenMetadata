
import { SaveInitRequest, ServicesUpdateRequest, TestConnectionRequest } from 'Models';
import APIClient from '../rest/index';
import { CreateIngestionPipeline } from '../generated/api/services/ingestionPipelines/createIngestionPipeline';

export const saveInit = (initData: SaveInitRequest) =>
    APIClient.post('/init', initData);

export const runConnectionTest = (payload: TestConnectionRequest) =>
    APIClient.post('/api/test', payload, { timeout: 2 * 60 * 1000 })

export const saveConnection = (serviceData: ServicesUpdateRequest) =>
    APIClient.post('/connection', serviceData, { withCredentials: true });

export const saveIngestion = (ingestion: CreateIngestionPipeline) =>
    APIClient.post('/ingestion', ingestion);

export const fetchYaml = () => APIClient.get('/api/yaml');

export const downloadYaml = () => APIClient.get('api/yaml/download', { responseType: 'blob' });

// It was quicker to use Fetch API instead of Axios.
// We can revisit later.
export const runIngestion = () => fetch(`${APIClient.defaults.baseURL}api/run`, {
    method: 'POST',
});

