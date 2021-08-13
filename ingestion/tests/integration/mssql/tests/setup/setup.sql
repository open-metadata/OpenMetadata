CREATE DATABASE catalog_test;
GO
USE catalog_test;
GO
CREATE TABLE SampleData (ID int, DataName nvarchar(max));
GO
CREATE SCHEMA catalog_test_check;
GO
CREATE TABLE catalog_test_check.SampleItems (ID int, SampleItemName nvarchar(max));
GO