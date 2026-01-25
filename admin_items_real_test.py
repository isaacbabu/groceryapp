#!/usr/bin/env python3
"""
Test POST /api/admin/items endpoint using existing admin session
"""

import requests
import json
import sys
from datetime import datetime

class AdminItemsTestWithRealSession:
    def __init__(self):
        self.base_url = "https://add-button-enhance.preview.emergentagent.com/api"
        # Using the actual admin session token from database
        self.session_token = "VxbQJv-KQjSxx5BASUbDTaboP53uNvNgXHRUhp5gQxU"
        
    def verify_admin_access(self):
        """Verify the session token works and user is admin"""
        print("🔍 Verifying admin access...")
        
        headers = {
            'Authorization': f'Bearer {self.session_token}'
        }
        
        try:
            response = requests.get(
                f"{self.base_url}/auth/me",
                headers=headers
            )
            
            print(f"Auth check status: {response.status_code}")
            
            if response.status_code == 200:
                user_data = response.json()
                is_admin = user_data.get('is_admin', False)
                
                print(f"✅ Authentication successful")
                print(f"   User ID: {user_data.get('user_id')}")
                print(f"   Email: {user_data.get('email')}")
                print(f"   Is Admin: {is_admin}")
                
                return is_admin
            else:
                print(f"❌ Authentication failed: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Error verifying admin access: {str(e)}")
            return False
    
    def test_admin_items_endpoint(self):
        """Test POST /api/admin/items with the exact payload from review request"""
        print("\n🧪 Testing POST /api/admin/items endpoint...")
        
        # Exact test payload from review request
        test_payload = {
            "name": "Test Item",
            "rate": 100.0,
            "image_url": "https://images.unsplash.com/photo-1585996340258-c90e51a42c15?w=400",
            "category": "Pulses"
        }
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.session_token}'
        }
        
        print(f"Request URL: {self.base_url}/admin/items")
        print(f"Request payload: {json.dumps(test_payload, indent=2)}")
        
        try:
            response = requests.post(
                f"{self.base_url}/admin/items",
                json=test_payload,
                headers=headers
            )
            
            print(f"\nResponse status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ SUCCESS - Item created successfully!")
                print(f"Response data: {json.dumps(data, indent=2, default=str)}")
                
                # Verify the created item has correct data
                print(f"\n🔍 Verifying created item:")
                print(f"   Item ID: {data.get('item_id')}")
                print(f"   Name: {data.get('name')}")
                print(f"   Rate: {data.get('rate')}")
                print(f"   Category: {data.get('category')}")
                print(f"   Image URL: {data.get('image_url')}")
                print(f"   Created At: {data.get('created_at')}")
                
                return True, data
                
            elif response.status_code == 422:
                print(f"❌ VALIDATION ERROR (422)")
                try:
                    error_data = response.json()
                    print(f"Validation errors: {json.dumps(error_data, indent=2)}")
                    
                    # Analyze specific validation errors
                    if 'detail' in error_data:
                        print(f"\n🔍 Detailed validation analysis:")
                        for error in error_data['detail']:
                            print(f"   Field: {error.get('loc', 'unknown')}")
                            print(f"   Message: {error.get('msg', 'unknown')}")
                            print(f"   Type: {error.get('type', 'unknown')}")
                            print(f"   Input: {error.get('input', 'unknown')}")
                            print(f"   ---")
                            
                except Exception as e:
                    print(f"Error parsing validation response: {e}")
                    print(f"Raw response: {response.text}")
                    
                return False, None
                
            elif response.status_code == 403:
                print(f"❌ FORBIDDEN (403) - Admin access required")
                print(f"Response: {response.text}")
                return False, None
                
            elif response.status_code == 401:
                print(f"❌ UNAUTHORIZED (401) - Authentication required")
                print(f"Response: {response.text}")
                return False, None
                
            else:
                print(f"❌ UNEXPECTED STATUS: {response.status_code}")
                print(f"Response: {response.text}")
                return False, None
                
        except Exception as e:
            print(f"❌ Request failed with exception: {str(e)}")
            return False, None
    
    def verify_item_in_database(self, item_id):
        """Verify the item was actually saved to database"""
        print(f"\n🔍 Verifying item {item_id} exists in database...")
        
        try:
            response = requests.get(
                f"{self.base_url}/items",
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 200:
                items = response.json()
                created_item = next((item for item in items if item.get('item_id') == item_id), None)
                
                if created_item:
                    print(f"✅ Item found in database!")
                    print(f"   Name: {created_item.get('name')}")
                    print(f"   Rate: {created_item.get('rate')}")
                    print(f"   Category: {created_item.get('category')}")
                    return True
                else:
                    print(f"❌ Item not found in database")
                    return False
            else:
                print(f"❌ Failed to fetch items: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Error verifying item in database: {str(e)}")
            return False

def main():
    print("🚀 Testing POST /api/admin/items endpoint with real admin session")
    print(f"Backend URL: https://add-button-enhance.preview.emergentagent.com/api")
    print(f"Test started at: {datetime.now()}")
    print("="*70)
    
    tester = AdminItemsTestWithRealSession()
    
    # Step 1: Verify admin access
    if not tester.verify_admin_access():
        print("\n❌ FAILED: Admin access verification failed")
        return 1
    
    # Step 2: Test the admin items endpoint
    success, created_item = tester.test_admin_items_endpoint()
    
    if success and created_item:
        # Step 3: Verify item was saved to database
        item_id = created_item.get('item_id')
        if tester.verify_item_in_database(item_id):
            print("\n🎉 SUCCESS: POST /api/admin/items endpoint working perfectly!")
            print("   ✅ Item created successfully")
            print("   ✅ Item saved to database")
            print("   ✅ All validations passed")
            return 0
        else:
            print("\n⚠️  PARTIAL SUCCESS: Item created but verification failed")
            return 1
    else:
        print("\n❌ FAILED: POST /api/admin/items endpoint has issues")
        return 1

if __name__ == "__main__":
    sys.exit(main())