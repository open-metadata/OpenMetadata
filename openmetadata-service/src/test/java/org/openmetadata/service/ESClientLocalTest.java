package org.openmetadata.service;

import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestHighLevelClient;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.service.util.ElasticSearchClientUtils;
import java.io.IOException;
public class ESClientLocalTest {
    @Test
    void testEsMetadataClient() throws IOException {
        ElasticSearchConfiguration configuration = new ElasticSearchConfiguration()
//                .withHost("prod-es-metadata-disco.use.frdstr.com")
                .withHost("192.168.95.24")
                .withBatchSize(10)
                .withConnectionTimeoutSecs(60)
                .withUsername("app")
                .withPassword("IIb!dOxFj#bGRDwe2mV8Yg2d**MX86s0")
                .withPort(9200)
                .withTruststorePath("/Users/cristicalugaru/Development/k8s/dev/truststore/prod_truststore.jks")
                .withTruststorePassword("Md8DB2g*$1S9")
                .withScheme("https");
        RestHighLevelClient elasticSearchClient = ElasticSearchClientUtils.createElasticSearchClient(configuration);
        elasticSearchClient.ping(RequestOptions.DEFAULT);
    }
}
