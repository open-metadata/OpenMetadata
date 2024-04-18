"""
Manage SSL test cases
"""
import os
import unittest

from metadata.utils.ssl_manager import SSLManager


class SSLManagerTest(unittest.TestCase):
    """
    Tests to verify the functionality of SSLManager
    """

    def setUp(self):
        self.ca = "CA certificate content"
        self.key = "Private key content"
        self.cert = "Certificate content"
        self.ssl_manager = SSLManager(self.ca, self.key, self.cert)

    def tearDown(self):
        self.ssl_manager.cleanup_temp_files()

    def test_create_temp_file(self):
        content = "Test content"
        temp_file = self.ssl_manager.create_temp_file(content)
        self.assertTrue(os.path.exists(temp_file))
        with open(temp_file, "r", encoding="UTF-8") as file:
            file_content = file.read()
        self.assertEqual(file_content, content)
        content = ""
        temp_file = self.ssl_manager.create_temp_file(content)
        self.assertTrue(os.path.exists(temp_file))
        with open(temp_file, "r", encoding="UTF-8") as file:
            file_content = file.read()
        self.assertEqual(file_content, content)
        with self.assertRaises(AttributeError):
            content = None
            self.ssl_manager.create_temp_file(content)

    def test_cleanup_temp_files(self):
        temp_file = self.ssl_manager.create_temp_file("Test content")
        self.ssl_manager.cleanup_temp_files()
        self.assertFalse(os.path.exists(temp_file))
