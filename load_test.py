#!/usr/bin/env python3

import asyncio
import aiohttp
import argparse
import time
from dataclasses import dataclass
from typing import List, Dict
import statistics

@dataclass
class RequestResult:
    status_code: int
    response_time: float
    timestamp: float
    error: str = None

class LoadTester:
    def __init__(self, url: str, concurrent_requests: int, total_requests: int):
        self.url = url
        self.concurrent_requests = concurrent_requests
        self.total_requests = total_requests
        self.results: List[RequestResult] = []
        
    async def make_request(self, session: aiohttp.ClientSession, semaphore: asyncio.Semaphore) -> RequestResult:
        async with semaphore:
            start_time = time.time()
            try:
                async with session.get(self.url) as response:
                    await response.text()
                    end_time = time.time()
                    return RequestResult(
                        status_code=response.status,
                        response_time=end_time - start_time,
                        timestamp=end_time
                    )
            except Exception as e:
                end_time = time.time()
                return RequestResult(
                    status_code=0,
                    response_time=end_time - start_time,
                    timestamp=end_time,
                    error=str(e)
                )
    
    async def run_load_test(self):
        semaphore = asyncio.Semaphore(self.concurrent_requests)
        connector = aiohttp.TCPConnector(limit=self.concurrent_requests * 2)
        timeout = aiohttp.ClientTimeout(total=30)
        
        async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
            print(f"Starting load test: {self.total_requests} requests with {self.concurrent_requests} concurrent connections")
            print(f"Target URL: {self.url}")
            print("-" * 60)
            
            start_time = time.time()
            
            tasks = [
                self.make_request(session, semaphore) 
                for _ in range(self.total_requests)
            ]
            
            self.results = await asyncio.gather(*tasks)
            
            end_time = time.time()
            total_time = end_time - start_time
            
            self.print_statistics(total_time)
    
    def print_statistics(self, total_time: float):
        successful_requests = [r for r in self.results if r.status_code == 200]
        failed_requests = [r for r in self.results if r.status_code != 200]
        error_requests = [r for r in self.results if r.error]
        
        response_times = [r.response_time for r in successful_requests]
        
        print(f"\nLoad Test Results:")
        print("-" * 60)
        print(f"Total requests: {self.total_requests}")
        print(f"Concurrent requests: {self.concurrent_requests}")
        print(f"Total time: {total_time:.2f} seconds")
        
        print(f"\nThroughput Metrics:")
        print("-" * 30)
        overall_rps = self.total_requests / total_time
        successful_rps = len(successful_requests) / total_time
        print(f"Overall RPS (Requests Per Second): {overall_rps:.2f}")
        print(f"Successful RPS: {successful_rps:.2f}")
        print(f"Failed RPS: {(len(failed_requests) + len(error_requests)) / total_time:.2f}")
        
        print(f"\nRequest Status Summary:")
        print(f"Successful requests: {len(successful_requests)} ({(len(successful_requests) / self.total_requests) * 100:.2f}%)")
        print(f"Failed requests: {len(failed_requests)} ({(len(failed_requests) / self.total_requests) * 100:.2f}%)")
        print(f"Error requests: {len(error_requests)} ({(len(error_requests) / self.total_requests) * 100:.2f}%)")
        
        if response_times:
            print(f"\nResponse Time Statistics:")
            print(f"Average: {statistics.mean(response_times):.3f} seconds")
            print(f"Median: {statistics.median(response_times):.3f} seconds")
            print(f"Min: {min(response_times):.3f} seconds")
            print(f"Max: {max(response_times):.3f} seconds")
            if len(response_times) > 1:
                print(f"Standard deviation: {statistics.stdev(response_times):.3f} seconds")
        
        self.print_throughput_over_time()
        
        status_codes = {}
        for result in self.results:
            status_codes[result.status_code] = status_codes.get(result.status_code, 0) + 1
        
        print(f"\nStatus Code Distribution:")
        for code, count in sorted(status_codes.items()):
            print(f"  {code}: {count}")
        
        if error_requests:
            print(f"\nErrors:")
            error_types = {}
            for result in error_requests:
                error_type = type(Exception(result.error)).__name__ if result.error else "Unknown"
                error_types[error_type] = error_types.get(error_type, 0) + 1
            
            for error_type, count in error_types.items():
                print(f"  {error_type}: {count}")
    
    def print_throughput_over_time(self):
        if not self.results:
            return
            
        timestamps = [r.timestamp for r in self.results if r.timestamp > 0]
        if len(timestamps) < 2:
            return
            
        timestamps.sort()
        start_time = timestamps[0]
        end_time = timestamps[-1]
        
        window_size = 1.0
        current_window = start_time
        
        print(f"\nThroughput Over Time (1-second windows):")
        print("-" * 40)
        
        while current_window < end_time:
            window_end = current_window + window_size
            requests_in_window = [t for t in timestamps if current_window <= t < window_end]
            rps_in_window = len(requests_in_window)
            
            if rps_in_window > 0:
                elapsed = current_window - start_time
                print(f"  {elapsed:6.1f}s - {elapsed + window_size:6.1f}s: {rps_in_window:4d} RPS")
            
            current_window += window_size
            
        avg_rps = len(timestamps) / (end_time - start_time)
        print(f"\nAverage RPS across all windows: {avg_rps:.2f}")
        
        if len(timestamps) >= 10:
            window_counts = []
            current_window = start_time
            while current_window < end_time:
                window_end = current_window + window_size
                count = len([t for t in timestamps if current_window <= t < window_end])
                if count > 0:
                    window_counts.append(count)
                current_window += window_size
            
            if window_counts:
                print(f"Peak RPS: {max(window_counts)}")
                print(f"Min RPS: {min(window_counts)}")
                if len(window_counts) > 1:
                    print(f"RPS Standard Deviation: {statistics.stdev(window_counts):.2f}")

def main():
    parser = argparse.ArgumentParser(description='Load test script for HTTP endpoints')
    parser.add_argument('--url', '-u', default='http://localhost:8585/', 
                       help='Target URL (default: http://localhost:8585/)')
    parser.add_argument('--concurrent', '-c', type=int, default=10000,
                       help='Number of concurrent requests (default: 1000)')
    parser.add_argument('--total', '-t', type=int, default=300000,
                       help='Total number of requests (default: 1000)')
    
    args = parser.parse_args()
    
    if args.concurrent > args.total:
        print("Warning: Concurrent requests cannot exceed total requests")
        args.concurrent = args.total
    
    load_tester = LoadTester(args.url, args.concurrent, args.total)
    
    try:
        asyncio.run(load_tester.run_load_test())
    except KeyboardInterrupt:
        print("\nLoad test interrupted by user")
    except Exception as e:
        print(f"Error running load test: {e}")

if __name__ == "__main__":
    main()