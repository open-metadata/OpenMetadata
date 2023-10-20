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

import static org.openmetadata.service.jdbi3.EntityDAO.LOG;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import java.io.IOException;
import java.util.Objects;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import org.apache.logging.log4j.util.Strings;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.services.connections.database.SampleDataS3Config;
import org.openmetadata.schema.type.TableData;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import software.amazon.awssdk.auth.credentials.AwsSessionCredentials;
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

// import software.amazon.awssdk.services.s3.model.S3

public class S3Util {

  private static final int CACHE_SIZE = 100;

  private static final int CACHE_DURATION_IN_MIN = 2;

  private static final LoadingCache<SampleDataConfigWrapper, TableData> TABLE_DATA_CACHE =
      CacheBuilder.newBuilder()
          .maximumSize(CACHE_SIZE)
          .expireAfterWrite(CACHE_DURATION_IN_MIN, TimeUnit.MINUTES)
          .build(new TableDataLoader());

  private static String getOrDefault(String original, String defaultStr) {
    return Strings.isNotEmpty(original) ? original : defaultStr;
  }

  private static S3Client getS3Client(SampleDataS3Config s3Config) {
    if (s3Config != null
        && s3Config.getAwsConfig() != null
        && Strings.isNotEmpty(s3Config.getAwsConfig().getAwsRegion())) {
      SecretsManagerFactory.getSecretsManager().decryptSampleDataS3Config(s3Config);
      String region = s3Config.getAwsConfig().getAwsRegion();
      String accessKeyId = S3Util.getOrDefault(s3Config.getAwsConfig().getAwsAccessKeyId(), "");
      String secretAccessKey = S3Util.getOrDefault(s3Config.getAwsConfig().getAwsSecretAccessKey(), "");
      String sessionToken = S3Util.getOrDefault(s3Config.getAwsConfig().getAwsSessionToken(), "");
      AwsCredentialsProvider credentialsProvider;
      if (Strings.isBlank(accessKeyId) && Strings.isBlank(secretAccessKey)) {
        credentialsProvider = DefaultCredentialsProvider.create();
      } else {
        credentialsProvider =
            StaticCredentialsProvider.create(AwsSessionCredentials.create(accessKeyId, secretAccessKey, sessionToken));
      }
      return S3Client.builder().region(Region.of(region)).credentialsProvider(credentialsProvider).build();
    }
    return S3Client.create();
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
    S3Client client = this.getS3Client(s3Config);
    try {
      String objectKey = this.getSampleDataObjectKey(s3Config, table);
      PutObjectRequest putOb = PutObjectRequest.builder().bucket(s3Config.getBucketName()).key(objectKey).build();
      ObjectMapper objectMapper = new ObjectMapper();
      byte[] bytesToWrite = objectMapper.writeValueAsBytes(tableData);
      client.putObject(putOb, RequestBody.fromBytes(bytesToWrite));
    } catch (JsonProcessingException e) {
      throw new RuntimeException(e);
    } catch (S3Exception e) {
      System.err.println(e.getMessage());
    }
  }

  private static TableData getSampleDataFromS3(S3Client s3Client, SampleDataS3Config s3Config, String objectKey)
      throws IOException {
    GetObjectRequest getOb = GetObjectRequest.builder().bucket(s3Config.getBucketName()).key(objectKey).build();
    ResponseInputStream inputStream = s3Client.getObject(getOb);
    byte[] bytesToRead = inputStream.readAllBytes();
    ObjectMapper objectMapper = new ObjectMapper();
    return objectMapper.readValue(bytesToRead, TableData.class);
  }

  public TableData getSampleData(SampleDataS3Config s3Config, Table table) {
    S3Client client = this.getS3Client(s3Config);
    try {
      String objectKey = this.getSampleDataObjectKey(s3Config, table);
      return S3Util.getSampleDataFromS3(client, s3Config, objectKey);
    } catch (S3Exception e) {
      System.err.println(e.getMessage());
    } catch (IOException e) {
      throw new RuntimeException(e);
    }
    return null;
  }

  public TableData getSampleDataPaginated(SampleDataS3Config s3Config, Table table) {
    try {
      String objectKey = this.getSampleDataObjectKey(s3Config, table);
      SampleDataConfigWrapper sampleDataConfigWrapper = new SampleDataConfigWrapper(s3Config, objectKey);
      if (TABLE_DATA_CACHE.get(sampleDataConfigWrapper).equals(null)) {
        TABLE_DATA_CACHE.invalidate(sampleDataConfigWrapper);
      }
      return TABLE_DATA_CACHE.get(sampleDataConfigWrapper);

    } catch (S3Exception e) {
      System.err.println(e.getMessage());
    } catch (ExecutionException e) {
      throw new RuntimeException(e);
    }
    return null;
  }

  static class TableDataLoader extends CacheLoader<SampleDataConfigWrapper, TableData> {
    @Override
    public TableData load(SampleDataConfigWrapper data) throws Exception {
      try {
        GetObjectRequest getOb =
            GetObjectRequest.builder().bucket(data.getS3Config().getBucketName()).key(data.getObjectKey()).build();
        S3Client s3Client = S3Util.getS3Client(data.getS3Config());
        ResponseInputStream inputStream = s3Client.getObject(getOb);
        byte[] bytesToRead = inputStream.readAllBytes();
        ObjectMapper objectMapper = new ObjectMapper();
        return objectMapper.readValue(bytesToRead, TableData.class);
      } catch (S3Exception e) {
        LOG.debug("Failed to fetch sample data: " + e.getMessage());
      }
      return null;
    }
  }

  private class SampleDataConfigWrapper {

    private SampleDataS3Config s3Config;
    private String objectKey;

    SampleDataConfigWrapper(SampleDataS3Config s3Config, String objectKey) {
      this.s3Config = s3Config;
      this.objectKey = objectKey;
    }

    public SampleDataS3Config getS3Config() {
      return s3Config;
    }

    public String getObjectKey() {
      return objectKey;
    }

    @Override
    public boolean equals(Object o) {
      if (this == o) return true;
      if (o == null || getClass() != o.getClass()) return false;
      SampleDataConfigWrapper that = (SampleDataConfigWrapper) o;
      return Objects.equals(s3Config, that.s3Config) && Objects.equals(objectKey, that.objectKey);
    }

    @Override
    public int hashCode() {
      return Objects.hash(s3Config, objectKey);
    }
  }
}
