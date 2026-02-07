#!/usr/bin/env python3
"""
Test POST /api/admin/items endpoint with various validation scenarios
"""

import requests
import json
import sys
from datetime import datetime

class AdminItemsValidationTest:
    def __init__(self):
        self.base_url = "https://add-button-enhance.preview.emergentagent.com/api"
        # Using the actual admin session token from database
        self.session_token = "VxbQJv-KQjSxx5BASUbDTaboP53uNvNgXHRUhp5gQxU"
        
    def test_validation_scenario(self, test_name, payload, expected_status=422):
        """Test a specific validation scenario"""
        print(f"\n🧪 Testing: {test_name}")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.session_token}'
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/admin/items",
                json=payload,
                headers=headers
            )
            
            print(f"Response status: {response.status_code}")
            
            if response.status_code == expected_status:
                if response.status_code == 422:
                    error_data = response.json()
                    print(f"✅ Expected validation error received:")
                    if 'detail' in error_data:
                        for error in error_data['detail']:
                            field = '.'.join(str(x) for x in error.get('loc', []))
                            print(f"   - {field}: {error.get('msg', 'unknown error')}")
                elif response.status_code == 200:
                    data = response.json()
                    print(f"✅ Item created successfully: {data.get('item_id')}")
                return True
            else:
                print(f"❌ Unexpected status. Expected {expected_status}, got {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Request failed: {str(e)}")
            return False
    
    def run_validation_tests(self):
        """Run various validation test scenarios"""
        print("🔍 Running validation tests for POST /api/admin/items...")
        
        test_cases = [
            # Valid case
            {
                "name": "Valid Item Creation",
                "payload": {
                    "name": "Valid Test Item",
                    "rate": 50.0,
                    "image_url": "https://images.unsplash.com/photo-1585996340258-c90e51a42c15?w=400",
                    "category": "Spices"
                },
                "expected": 200
            },
            
            # Missing required fields
            {
                "name": "Missing name field",
                "payload": {
                    "rate": 100.0,
                    "image_url": "https://images.unsplash.com/photo-1585996340258-c90e51a42c15?w=400",
                    "category": "Pulses"
                },
                "expected": 422
            },
            
            {
                "name": "Missing rate field",
                "payload": {
                    "name": "Test Item",
                    "image_url": "https://images.unsplash.com/photo-1585996340258-c90e51a42c15?w=400",
                    "category": "Pulses"
                },
                "expected": 422
            },
            
            {
                "name": "Missing image_url field",
                "payload": {
                    "name": "Test Item",
                    "rate": 100.0,
                    "category": "Pulses"
                },
                "expected": 422
            },
            
            {
                "name": "Missing category field",
                "payload": {
                    "name": "Test Item",
                    "rate": 100.0,
                    "image_url": "https://images.unsplash.com/photo-1585996340258-c90e51a42c15?w=400"
                },
                "expected": 422
            },
            
            # Invalid field values
            {
                "name": "Empty name",
                "payload": {
                    "name": "",
                    "rate": 100.0,
                    "image_url": "https://images.unsplash.com/photo-1585996340258-c90e51a42c15?w=400",
                    "category": "Pulses"
                },
                "expected": 422
            },
            
            {
                "name": "Negative rate",
                "payload": {
                    "name": "Test Item",
                    "rate": -10.0,
                    "image_url": "https://images.unsplash.com/photo-1585996340258-c90e51a42c15?w=400",
                    "category": "Pulses"
                },
                "expected": 422
            },
            
            {
                "name": "Zero rate",
                "payload": {
                    "name": "Test Item",
                    "rate": 0.0,
                    "image_url": "https://images.unsplash.com/photo-1585996340258-c90e51a42c15?w=400",
                    "category": "Pulses"
                },
                "expected": 422
            },
            
            {
                "name": "Invalid image URL",
                "payload": {
                    "name": "Test Item",
                    "rate": 100.0,
                    "image_url": "invalid-url",
                    "category": "Pulses"
                },
                "expected": 422
            },
            
            {
                "name": "Empty category",
                "payload": {
                    "name": "Test Item",
                    "rate": 100.0,
                    "image_url": "https://images.unsplash.com/photo-1585996340258-c90e51a42c15?w=400",
                    "category": ""
                },
                "expected": 422
            },
            
            # Edge cases
            {
                "name": "Very long name",
                "payload": {
                    "name": "A" * 300,  # Exceeds max length
                    "rate": 100.0,
                    "image_url": "https://images.unsplash.com/photo-1585996340258-c90e51a42c15?w=400",
                    "category": "Pulses"
                },
                "expected": 200  # Should be truncated and sanitized
            },
            
            {
                "name": "Maximum valid rate",
                "payload": {
                    "name": "Expensive Item",
                    "rate": 999999.99,
                    "image_url": "https://images.unsplash.com/photo-1585996340258-c90e51a42c15?w=400",
                    "category": "Pulses"
                },
                "expected": 200
            },
            
            {
                "name": "Rate exceeding maximum",
                "payload": {
                    "name": "Too Expensive Item",
                    "rate": 1000001.0,  # Exceeds MAX_RATE
                    "image_url": "https://images.unsplash.com/photo-1585996340258-c90e51a42c15?w=400",
                    "category": "Pulses"
                },
                "expected": 422
            }
        ]
        
        passed = 0
        total = len(test_cases)
        
        for test_case in test_cases:
            if self.test_validation_scenario(
                test_case["name"], 
                test_case["payload"], 
                test_case["expected"]
            ):
                passed += 1
        
        print(f"\n📊 Validation Test Results: {passed}/{total} passed")
        return passed == total

def main():
    print("🚀 Testing POST /api/admin/items validation scenarios")
    print(f"Backend URL: https://add-button-enhance.preview.emergentagent.com/api")
    print(f"Test started at: {datetime.now()}")
    print("="*70)
    
    tester = AdminItemsValidationTest()
    
    if tester.run_validation_tests():
        print("\n🎉 All validation tests passed!")
        return 0
    else:
        print("\n❌ Some validation tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())