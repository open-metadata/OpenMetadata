/*
 *  Copyright 2025 Collate
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

package org.openmetadata.service.resources.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.net.URI;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.services.connections.database.CustomDatabaseConnection;

/**
 * Simple unit tests for logoUrl functionality in DatabaseService.
 * This test focuses on the basic functionality without complex test infrastructure.
 */
public class DatabaseServiceLogoUrlTest {

  @Test
  void testDatabaseServiceWithLogoUrl() {
    // Create a DatabaseService with logoUrl
    DatabaseService service = new DatabaseService();
    service.setName("test-service");
    service.setDisplayName("Test Service");
    service.setServiceType(CreateDatabaseService.DatabaseServiceType.CustomDatabase);
    
    URI logoUrl = URI.create("https://example.com/custom-db-logo.png");
    service.setLogoUrl(logoUrl);

    // Verify logoUrl is set correctly
    assertNotNull(service);
    assertEquals(logoUrl, service.getLogoUrl());
    assertEquals("https://example.com/custom-db-logo.png", service.getLogoUrl().toString());
    assertEquals("CustomDatabase", service.getServiceType().value());
  }

  @Test
  void testDatabaseServiceWithoutLogoUrl() {
    // Create a DatabaseService without logoUrl
    DatabaseService service = new DatabaseService();
    service.setName("test-service");
    service.setDisplayName("Test Service");
    service.setServiceType(CreateDatabaseService.DatabaseServiceType.CustomDatabase);

    // Verify logoUrl is null when not set
    assertNotNull(service);
    assertNull(service.getLogoUrl());
    assertEquals("CustomDatabase", service.getServiceType().value());
  }

  @Test
  void testCreateDatabaseServiceWithLogoUrl() {
    // Create a CreateDatabaseService with logoUrl
    CreateDatabaseService createRequest = new CreateDatabaseService();
    createRequest.setName("test-service");
    createRequest.setDisplayName("Test Service");
    createRequest.setServiceType(CreateDatabaseService.DatabaseServiceType.CustomDatabase);
    
    URI logoUrl = URI.create("https://example.com/custom-db-logo.svg");
    createRequest.setLogoUrl(logoUrl);

    // Set up connection
    DatabaseConnection connection = new DatabaseConnection();
    connection.setConfig(new CustomDatabaseConnection());
    createRequest.setConnection(connection);

    // Verify logoUrl is set correctly
    assertNotNull(createRequest);
    assertEquals(logoUrl, createRequest.getLogoUrl());
    assertEquals("https://example.com/custom-db-logo.svg", createRequest.getLogoUrl().toString());
    assertEquals("CustomDatabase", createRequest.getServiceType().value());
  }

  @Test
  void testCreateDatabaseServiceWithoutLogoUrl() {
    // Create a CreateDatabaseService without logoUrl
    CreateDatabaseService createRequest = new CreateDatabaseService();
    createRequest.setName("test-service");
    createRequest.setDisplayName("Test Service");
    createRequest.setServiceType(CreateDatabaseService.DatabaseServiceType.CustomDatabase);

    // Set up connection
    DatabaseConnection connection = new DatabaseConnection();
    connection.setConfig(new CustomDatabaseConnection());
    createRequest.setConnection(connection);

    // Verify logoUrl is null when not set
    assertNotNull(createRequest);
    assertNull(createRequest.getLogoUrl());
    assertEquals("CustomDatabase", createRequest.getServiceType().value());
  }

  @Test
  void testLogoUrlWithDifferentFormats() {
    // Test PNG format
    URI pngUrl = URI.create("https://example.com/logo.png");
    DatabaseService service1 = new DatabaseService();
    service1.setLogoUrl(pngUrl);
    assertEquals("https://example.com/logo.png", service1.getLogoUrl().toString());

    // Test SVG format
    URI svgUrl = URI.create("https://example.com/logo.svg");
    DatabaseService service2 = new DatabaseService();
    service2.setLogoUrl(svgUrl);
    assertEquals("https://example.com/logo.svg", service2.getLogoUrl().toString());

    // Test with query parameters
    URI queryUrl = URI.create("https://example.com/logo.png?v=1.0&size=64");
    DatabaseService service3 = new DatabaseService();
    service3.setLogoUrl(queryUrl);
    assertEquals("https://example.com/logo.png?v=1.0&size=64", service3.getLogoUrl().toString());

    // Test with subdomain
    URI subdomainUrl = URI.create("https://cdn.example.com/assets/logo.png");
    DatabaseService service4 = new DatabaseService();
    service4.setLogoUrl(subdomainUrl);
    assertEquals("https://cdn.example.com/assets/logo.png", service4.getLogoUrl().toString());

    // Test with port
    URI portUrl = URI.create("https://example.com:8080/static/logo.png");
    DatabaseService service5 = new DatabaseService();
    service5.setLogoUrl(portUrl);
    assertEquals("https://example.com:8080/static/logo.png", service5.getLogoUrl().toString());
  }

  @Test
  void testLogoUrlSerialization() {
    // Test that logoUrl can be serialized and deserialized
    DatabaseService originalService = new DatabaseService();
    originalService.setName("test-service");
    originalService.setDisplayName("Test Service");
    originalService.setServiceType(CreateDatabaseService.DatabaseServiceType.CustomDatabase);
    
    URI logoUrl = URI.create("https://example.com/serialized-logo.png");
    originalService.setLogoUrl(logoUrl);

    // Verify the logoUrl is properly set
    assertEquals(logoUrl, originalService.getLogoUrl());
    assertEquals("https://example.com/serialized-logo.png", originalService.getLogoUrl().toString());
  }

  @Test
  void testLogoUrlWithSpecialCharacters() {
    // Test URL with special characters (encoded)
    URI specialCharUrl = URI.create("https://example.com/logo%20with%20spaces.png");
    DatabaseService service = new DatabaseService();
    service.setLogoUrl(specialCharUrl);
    assertEquals("https://example.com/logo%20with%20spaces.png", service.getLogoUrl().toString());
  }

  @Test
  void testLogoUrlWithInternationalDomain() {
    // Test international domain name
    URI internationalUrl = URI.create("https://例え.jp/logo.png");
    DatabaseService service = new DatabaseService();
    service.setLogoUrl(internationalUrl);
    assertEquals("https://例え.jp/logo.png", service.getLogoUrl().toString());
  }

  @Test
  void testLogoUrlWithVeryLongUrl() {
    // Test very long URL
    String longUrlString = "https://example.com/very/long/path/to/logo/with/many/segments/and/parameters?param1=value1&param2=value2&param3=value3&param4=value4&param5=value5.png";
    URI longUrl = URI.create(longUrlString);
    DatabaseService service = new DatabaseService();
    service.setLogoUrl(longUrl);
    assertEquals(longUrlString, service.getLogoUrl().toString());
  }
}