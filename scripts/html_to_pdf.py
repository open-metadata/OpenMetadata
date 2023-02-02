#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
This script generates a PDF from all HTML files contained in a
"""
import glob
import os

import pdfkit
from PyPDF2 import PdfMerger

INPUT_FOLDER = "security-report"

OUTPUT_FOLDER = "security-report"

PDF_FILE_NAME = "security-report"

merger = PdfMerger()

for file in glob.glob(f"{INPUT_FOLDER}/*.html"):
    file_name, _ = os.path.splitext(file)
    pdf_file = f"{file_name}.pdf"
    print(f"Generating PDF file '{pdf_file}'")
    pdfkit.from_file(file, pdf_file)
    merger.append(pdf_file)
    try:
        print(f"Removing file '{file}'")
        os.remove(file)
        print(f"Removing file '{file_name}'")
        os.remove(file_name)
    except OSError as err:
        pass

print("Generating PDF report...")
merger.write(f"{OUTPUT_FOLDER}/{PDF_FILE_NAME}.pdf")
merger.close()
print("Process done!")
