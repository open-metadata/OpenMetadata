CREATE DATABASE catalog_test;
GO
USE catalog_test;
GO
CREATE TABLE Products (ID int, ProductName nvarchar(max));
GO
CREATE SCHEMA catalog_test_check;
GO
CREATE TABLE catalog_test_check.Items (ID int, ItemName nvarchar(max));
GO