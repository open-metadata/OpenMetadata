/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.util;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import org.apache.logging.log4j.util.Strings;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.services.connections.database.SampleDataS3Config;
import org.openmetadata.schema.type.TableData;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

public class S3Util {

  S3Client client;

  private String getOrDefault(String original, String defaultStr) {
    return Strings.isNotEmpty(original) ? original : defaultStr;
  }

  private void initClient(SampleDataS3Config s3Config) {
    if (s3Config != null
        && s3Config.getAwsConfig() != null
        && Strings.isNotEmpty(s3Config.getAwsConfig().getAwsRegion())) {
      SecretsManagerFactory.getSecretsManager().decryptSampleDataS3Config(s3Config);
      String region = s3Config.getAwsConfig().getAwsRegion();
      String accessKeyId = this.getOrDefault(s3Config.getAwsConfig().getAwsAccessKeyId(), "");
      String secretAccessKey = this.getOrDefault(s3Config.getAwsConfig().getAwsSecretAccessKey(), "");
      AwsCredentialsProvider credentialsProvider;
      if (Strings.isBlank(accessKeyId) && Strings.isBlank(secretAccessKey)) {
        credentialsProvider = DefaultCredentialsProvider.create();
      } else {
        credentialsProvider =
            StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKeyId, secretAccessKey));
      }
      this.client = S3Client.builder().region(Region.of(region)).credentialsProvider(credentialsProvider).build();
    } else {
      this.client = S3Client.create();
    }
  }

  private String getSampleDataObjectKey(SampleDataS3Config s3Config, Table table) {
    return getOrDefault(s3Config.getPrefix(), "")
        + "/"
        + table.getService().getName()
        + "/"
        + table.getDatabase().getName()
        + "/"
        + table.getDatabaseSchema().getName()
        + "/"
        + table.getName()
        + "/sample_data.json";
  }

  public void uploadSampleData(SampleDataS3Config s3Config, TableData tableData, Table table) {
    this.initClient(s3Config);
    try {
      String objectKey = this.getSampleDataObjectKey(s3Config, table);
      PutObjectRequest putOb = PutObjectRequest.builder().bucket(s3Config.getBucketName()).key(objectKey).build();
      ObjectMapper objectMapper = new ObjectMapper();
      byte[] bytesToWrite = objectMapper.writeValueAsBytes(tableData);
      this.client.putObject(putOb, RequestBody.fromBytes(bytesToWrite));
    } catch (JsonProcessingException e) {
      throw new RuntimeException(e);
    } catch (S3Exception e) {
      System.err.println(e.getMessage());
    }
  }

  public TableData getSampleData(SampleDataS3Config s3Config, Table table) {
    this.initClient(s3Config);
    try {
      String objectKey = this.getSampleDataObjectKey(s3Config, table);
      GetObjectRequest getOb = GetObjectRequest.builder().bucket(s3Config.getBucketName()).key(objectKey).build();
      ResponseInputStream inputStream = this.client.getObject(getOb);
      byte[] bytesToRead = inputStream.readAllBytes();
      ObjectMapper objectMapper = new ObjectMapper();
      return objectMapper.readValue(bytesToRead, TableData.class);
    } catch (S3Exception e) {
      System.err.println(e.getMessage());
    } catch (IOException e) {
      throw new RuntimeException(e);
    }
    return null;
  }
}
