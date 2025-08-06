#!/usr/bin/env python3
"""
Script to generate a large glossary with 5000+ terms for testing UI performance.
This simulates the issue reported where loading thousands of glossary terms causes UI failures.
"""

import json
import random
import string
import requests
import time
from typing import List, Dict
import argparse
import websocket
import threading

def generate_random_description(min_length=50, max_length=200):
    """Generate random description text similar to Informatica export"""
    words = [
        "data", "process", "system", "business", "analysis", "metric", "report",
        "customer", "product", "service", "revenue", "cost", "profit", "market",
        "sales", "inventory", "warehouse", "dimension", "fact", "attribute",
        "entity", "relationship", "model", "architecture", "integration", "quality",
        "governance", "compliance", "security", "privacy", "audit", "control"
    ]
    
    description_length = random.randint(min_length, max_length)
    description_words = []
    
    for _ in range(description_length):
        description_words.append(random.choice(words))
    
    # Group words into sentences
    sentences = []
    words_per_sentence = 10
    for i in range(0, len(description_words), words_per_sentence):
        sentence = ' '.join(description_words[i:i+words_per_sentence])
        if sentence:
            sentences.append(sentence.capitalize() + '.')
    
    return ' '.join(sentences)

def generate_glossary_terms(count: int, glossary_name: str, hierarchy_mix: bool = True) -> List[Dict]:
    """Generate glossary terms with mixed hierarchy structure"""
    terms = []
    
    # Create categories (parent terms)
    categories = [
        "Customer", "Product", "Sales", "Finance", "Operations",
        "Marketing", "HR", "IT", "Supply_Chain", "Analytics"
    ]
    
    # Generate root level terms (categories)
    for i, category in enumerate(categories):
        parent_term = {
            "name": f"{category}_Category",
            "displayName": f"{category} Category",
            "description": generate_random_description(min_length=50, max_length=100),
            "synonyms": [f"{category}_Cat", f"{category}_Group"],
            "tags": []
        }
        terms.append(parent_term)
    
    # Calculate how many terms to generate
    remaining_count = count - len(categories)
    
    if hierarchy_mix:
        # Mix of different hierarchy levels
        # 40% direct children of categories
        # 30% subcategories (2nd level)
        # 20% nested under subcategories (3rd level)
        # 10% root level terms (no parent)
        
        direct_children_count = int(remaining_count * 0.4)
        subcategory_count = int(remaining_count * 0.3)
        nested_count = int(remaining_count * 0.2)
        root_count = remaining_count - direct_children_count - subcategory_count - nested_count
        
        # Generate root level terms (no parent)
        for i in range(root_count):
            root_term = {
                "name": f"Root_Term_{i}",
                "displayName": f"Root Term {i}",
                "description": generate_random_description(min_length=30, max_length=80),
                "tags": []
            }
            terms.append(root_term)
        
        # Generate direct children of categories
        for i in range(direct_children_count):
            category = categories[i % len(categories)]
            child_term = {
                "name": f"{category}_Term_{i}",
                "displayName": f"{category} Term {i}",
                "description": generate_random_description(min_length=30, max_length=80),
                "parent": f"{glossary_name}.{category}_Category",
                "tags": []
            }
            terms.append(child_term)
        
        # Generate subcategories
        subcategory_names = []
        for i in range(subcategory_count):
            category = categories[i % len(categories)]
            subcategory_name = f"{category}_SubCategory_{i}"
            subcategory_term = {
                "name": subcategory_name,
                "displayName": f"{category} SubCategory {i}",
                "description": generate_random_description(min_length=30, max_length=80),
                "parent": f"{glossary_name}.{category}_Category",
                "tags": []
            }
            terms.append(subcategory_term)
            subcategory_names.append((category, subcategory_name))
        
        # Generate nested terms under subcategories
        for i in range(nested_count):
            if subcategory_names:
                category, subcategory = subcategory_names[i % len(subcategory_names)]
                nested_term = {
                    "name": f"{category}_Nested_Term_{i}",
                    "displayName": f"{category} Nested Term {i}",
                    "description": generate_random_description(min_length=30, max_length=80),
                    "parent": f"{glossary_name}.{category}_Category.{subcategory}",
                    "tags": []
                }
                terms.append(nested_term)
    else:
        # Simple flat structure under categories
        terms_per_category = remaining_count // len(categories)
        extra_terms = remaining_count % len(categories)
        
        for cat_idx, category in enumerate(categories):
            category_term_count = terms_per_category + (extra_terms if cat_idx == 0 else 0)
            
            for i in range(category_term_count):
                child_term = {
                    "name": f"{category}_Term_{i}",
                    "displayName": f"{category} Term {i}",
                    "description": generate_random_description(min_length=30, max_length=80),
                    "parent": f"{glossary_name}.{category}_Category",
                    "tags": []
                }
                terms.append(child_term)
    
    return terms


def generate_csv_content(terms: List[Dict]) -> str:
    """Convert glossary terms to CSV format for import"""
    csv_lines = []
    
    # Add CSV header - note 'name*' indicates it's a required field
    csv_lines.append("parent,name*,displayName,description,synonyms,relatedTerms,references,tags,reviewers,owner,glossaryStatus,extension")
    
    for term in terms:
        parent = term.get('parent', '')
        name = term['name']
        display_name = term.get('displayName', name)
        description = term.get('description', '').replace('"', '""').replace('\n', ' ')
        synonyms = ';'.join(term.get('synonyms', []))
        related_terms = ''  # Empty for now
        references = ''  # Empty for now
        tags = ''  # Empty for now
        reviewers = ''  # Empty for now
        owner = ''  # Empty for now
        glossary_status = ''  # Empty for now (will use default)
        extension = ''  # Empty for now
        
        # Create CSV line
        csv_line = f'"{parent}","{name}","{display_name}","{description}","{synonyms}","{related_terms}","{references}","{tags}","{reviewers}","{owner}","{glossary_status}","{extension}"'
        csv_lines.append(csv_line)
    
    return '\n'.join(csv_lines)


def upload_to_openmetadata(file_path: str, server_url: str, token: str, use_async: bool = True):
    """Upload the glossary to OpenMetadata server using import endpoints"""
    
    with open(file_path, 'r') as f:
        data = json.load(f)
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    # First check if glossary already exists
    glossary_name = data['glossaryName']
    check_url = f"{server_url}/api/v1/glossaries/name/{glossary_name}"
    check_response = requests.get(check_url, headers=headers)
    
    if check_response.status_code == 200:
        print(f"Glossary '{glossary_name}' already exists. Using existing glossary.")
        glossary_response = check_response.json()
    else:
        # Create the glossary
        glossary_url = f"{server_url}/api/v1/glossaries"
        response = requests.post(
            glossary_url,
            json=data['createGlossary'],
            headers=headers
        )
        
        if response.status_code not in [200, 201]:
            print(f"Failed to create glossary: {response.status_code} - {response.text}")
            return
        
        glossary_response = response.json()
        print(f"Created glossary: {glossary_response['name']}")
    
    # Prepare import data
    import_data = {
        "dryRun": False,
        "glossaryName": glossary_response['fullyQualifiedName'],
        "createGlossaryTerms": data['createGlossaryTerms']
    }
    
    print(f"Importing {len(data['createGlossaryTerms'])} terms...")
    
    # Convert to CSV format for import
    csv_content = generate_csv_content(data['createGlossaryTerms'])
    
    if use_async and len(data['createGlossaryTerms']) > 1000:
        # Use async import for large datasets
        import_url = f"{server_url}/api/v1/glossaries/name/{glossary_response['fullyQualifiedName']}/importAsync"
        print("Using async import endpoint for large dataset...")
        
        headers['Content-Type'] = 'text/plain'
        
        response = requests.put(
            import_url,
            data=csv_content,
            headers=headers,
            params={'dryRun': 'false'},
            timeout=300  # 5 minute timeout for large imports
        )
        
        if response.status_code in [200, 201, 202]:
            print("Async import job submitted successfully!")
            result = response.json()
            
            if 'jobId' in result:
                job_id = result['jobId']
                print(f"Job ID: {job_id}")
                
                # Set up WebSocket connection to listen for updates
                ws_url = server_url.replace('http://', 'ws://').replace('https://', 'wss://')
                ws_url = f"{ws_url}/api/v1/push/feed/jobId/{job_id}"
                
                print("Connecting to WebSocket for real-time updates...")
                
                job_complete = threading.Event()
                job_result = {'status': None}
                
                def on_message(ws, message):
                    try:
                        data = json.loads(message)
                        print(f"Update: {data}")
                        
                        if 'status' in data:
                            job_result['status'] = data['status']
                            if data['status'] in ['COMPLETED', 'FAILED']:
                                job_complete.set()
                    except Exception as e:
                        print(f"Error processing message: {str(e)}")
                
                def on_error(ws, error):
                    print(f"WebSocket error: {error}")
                    job_complete.set()
                
                def on_close(ws, close_status_code, close_msg):
                    print("WebSocket connection closed")
                    job_complete.set()
                
                def on_open(ws):
                    print("WebSocket connection established")
                
                # Create WebSocket connection with authorization
                ws_headers = [f"Authorization: Bearer {token}"]
                ws = websocket.WebSocketApp(ws_url,
                                          on_open=on_open,
                                          on_message=on_message,
                                          on_error=on_error,
                                          on_close=on_close,
                                          header=ws_headers)
                
                # Run WebSocket in a separate thread
                ws_thread = threading.Thread(target=ws.run_forever)
                ws_thread.daemon = True
                ws_thread.start()
                
                # Wait for job completion or timeout
                if job_complete.wait(timeout=300):  # 5 minute timeout
                    if job_result['status'] == 'COMPLETED':
                        print("Import completed successfully!")
                    elif job_result['status'] == 'FAILED':
                        print("Import failed!")
                else:
                    print("Timeout waiting for import completion. Check the OpenMetadata UI for status.")
                    ws.close()
                
            elif 'summary' in result:
                print(f"Import summary: {result['summary']}")
            else:
                print(f"Response: {result}")
        else:
            print(f"Failed to submit async import: {response.status_code} - {response.text}")
            # Fallback to sync import
            print("Falling back to synchronous import...")
            use_async = False
    
    if not use_async:
        # Use synchronous import
        import_url = f"{server_url}/api/v1/glossaries/name/{glossary_response['fullyQualifiedName']}/import"
        
        # For large payloads, split into batches
        batch_size = 500
        terms = data['createGlossaryTerms']
        
        headers['Content-Type'] = 'text/plain'
        
        if len(terms) > batch_size:
            print(f"Splitting into batches of {batch_size} terms...")
            for i in range(0, len(terms), batch_size):
                batch = terms[i:i + batch_size]
                batch_csv = generate_csv_content(batch)
                
                print(f"Importing batch {i//batch_size + 1}/{(len(terms) + batch_size - 1)//batch_size} ({len(batch)} terms)...")
                
                try:
                    start_time = time.time()
                    response = requests.put(
                        import_url,
                        data=batch_csv,
                        headers=headers,
                        params={'dryRun': 'false'},
                        timeout=120  # 2 minute timeout per batch
                    )
                    elapsed_time = time.time() - start_time
                    
                    if response.status_code in [200, 201]:
                        print(f"Batch {i//batch_size + 1} imported successfully in {elapsed_time:.2f} seconds!")
                        result = response.json()
                        if 'summary' in result:
                            print(f"  Summary: {result['summary']}")
                    else:
                        print(f"Failed to import batch {i//batch_size + 1}: {response.status_code} - {response.text}")
                except requests.exceptions.Timeout:
                    print(f"Timeout importing batch {i//batch_size + 1}. The import may still be processing on the server.")
                except Exception as e:
                    print(f"Error importing batch {i//batch_size + 1}: {str(e)}")
        else:
            # Small dataset, import all at once
            try:
                response = requests.put(
                    import_url,
                    data=csv_content,
                    headers=headers,
                    params={'dryRun': 'false'},
                    timeout=120
                )
                
                if response.status_code in [200, 201]:
                    print("Successfully uploaded glossary terms!")
                    result = response.json()
                    if 'summary' in result:
                        print(f"Import summary: {result['summary']}")
                else:
                    print(f"Failed to upload terms: {response.status_code} - {response.text}")
            except requests.exceptions.Timeout:
                print("Request timed out. The import may still be processing on the server.")
            except Exception as e:
                print(f"Error uploading terms: {str(e)}")

def main():
    parser = argparse.ArgumentParser(
        description='Generate large glossary test data for OpenMetadata performance testing',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate 5000 terms to a file
  python generate-large-glossary-test-data.py --terms 5000
  
  # Generate and upload to local OpenMetadata
  python generate-large-glossary-test-data.py --terms 5000 --upload --token "YOUR_JWT_TOKEN"
  
  # Generate with custom name and upload to specific server
  python generate-large-glossary-test-data.py --terms 3000 --name "TestGlossary" --server https://openmetadata.example.com --upload --token "YOUR_JWT_TOKEN"
  
  # Generate flat hierarchy (no nested terms)
  python generate-large-glossary-test-data.py --terms 5000 --flat
  
  # Force synchronous import
  python generate-large-glossary-test-data.py --terms 5000 --upload --token "YOUR_JWT_TOKEN" --sync
        """
    )
    parser.add_argument('--terms', type=int, default=5000, help='Number of terms to generate (default: 5000)')
    parser.add_argument('--name', type=str, default='LargeTestGlossary', help='Glossary name (default: LargeTestGlossary)')
    parser.add_argument('--output', type=str, default='large_glossary_test.json', help='Output file (default: large_glossary_test.json)')
    parser.add_argument('--upload', action='store_true', help='Upload to OpenMetadata server after generation')
    parser.add_argument('--server', type=str, default='http://localhost:8585', help='OpenMetadata server URL (default: http://localhost:8585)')
    parser.add_argument('--token', type=str, help='JWT Bearer token for authentication (required for upload)')
    parser.add_argument('--flat', action='store_true', help='Generate flat hierarchy (no deep nesting)')
    parser.add_argument('--sync', action='store_true', help='Force synchronous import (default: async for 1000+ terms)')
    parser.add_argument('--save-csv', action='store_true', help='Save CSV file for debugging')
    
    args = parser.parse_args()
    
    # Validate arguments
    if args.terms < 100:
        print("Warning: Generating less than 100 terms may not reproduce performance issues")
    
    if args.terms > 10000:
        print("Warning: Generating more than 10,000 terms may take several minutes")
    
    # Generate the test data
    print(f"\nGenerating {args.terms} glossary terms...")
    print(f"Hierarchy: {'Flat' if args.flat else 'Mixed (multiple levels)'}")
    
    # Update the generate function call to use the flat parameter
    glossary = {
        "name": args.name,
        "displayName": f"{args.name} Test Glossary",
        "description": f"Test glossary with {args.terms} terms to reproduce UI performance issues",
        "reviewers": [],
        "tags": []
    }
    
    terms = generate_glossary_terms(args.terms, args.name, hierarchy_mix=not args.flat)
    
    # Create the bulk import format
    import_data = {
        "dryRun": False,
        "glossaryName": args.name,
        "createGlossary": glossary,
        "createGlossaryTerms": terms
    }
    
    with open(args.output, 'w') as f:
        json.dump(import_data, f, indent=2)
    
    print(f"Generated {len(terms)} glossary terms in {args.output}")
    print(f"Total size: {len(json.dumps(import_data))} bytes")
    
    # Save CSV if requested
    if args.save_csv:
        csv_output = args.output.replace('.json', '.csv')
        csv_content = generate_csv_content(terms)
        with open(csv_output, 'w') as f:
            f.write(csv_content)
        print(f"CSV saved to {csv_output}")
    
    # Upload if requested
    if args.upload:
        if not args.token:
            print("\nError: --token is required for upload")
            print("Please provide a JWT token using: --token 'YOUR_JWT_TOKEN'")
            return
        
        print(f"\nUploading to {args.server}...")
        upload_to_openmetadata(args.output, args.server, args.token, use_async=not args.sync)

if __name__ == "__main__":
    main()