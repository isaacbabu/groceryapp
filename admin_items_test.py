#!/usr/bin/env python3
"""
Specific test for POST /api/admin/items endpoint
Testing the exact scenario from the review request
"""

import requests
import json
import sys
from datetime import datetime

class AdminItemsTest:
    def __init__(self):
        self.base_url = "https://menu-navigation-fix-1.preview.emergentagent.com/api"
        self.session_token = None
        
    def create_admin_session(self):
        """Create a session for admin user"""
        print("🔐 Creating admin session...")
        
        # Mock session data for Google auth
        session_data = {
            "session_id": "admin_test_session_12345"
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/auth/session",
                json=session_data,
                headers={'Content-Type': 'application/json'}
            )
            
            print(f"Session creation status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.session_token = data.get("session_token")
                user_info = data.get("user", {})
                
                print(f"✅ Session created successfully")
                print(f"   Session token: {self.session_token}")
                print(f"   User email: {user_info.get('email')}")
                print(f"   Is admin: {user_info.get('is_admin')}")
                
                return True
            else:
                print(f"❌ Session creation failed: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Error creating session: {str(e)}")
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
        print(f"Request headers: {headers}")
        print(f"Request payload: {json.dumps(test_payload, indent=2)}")
        
        try:
            response = requests.post(
                f"{self.base_url}/admin/items",
                json=test_payload,
                headers=headers
            )
            
            print(f"\nResponse status: {response.status_code}")
            print(f"Response headers: {dict(response.headers)}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ SUCCESS - Item created successfully!")
                print(f"Response data: {json.dumps(data, indent=2, default=str)}")
                return True
                
            elif response.status_code == 422:
                print(f"❌ VALIDATION ERROR (422)")
                try:
                    error_data = response.json()
                    print(f"Validation errors: {json.dumps(error_data, indent=2)}")
                    
                    # Analyze specific validation errors
                    if 'detail' in error_data:
                        print("\n🔍 Detailed validation analysis:")
                        for error in error_data['detail']:
                            print(f"   Field: {error.get('loc', 'unknown')}")
                            print(f"   Message: {error.get('msg', 'unknown')}")
                            print(f"   Type: {error.get('type', 'unknown')}")
                            print(f"   Input: {error.get('input', 'unknown')}")
                            print("   ---")
                            
                except Exception as e:
                    print(f"Error parsing validation response: {e}")
                    print(f"Raw response: {response.text}")
                    
                return False
                
            elif response.status_code == 403:
                print(f"❌ FORBIDDEN (403) - Admin access required")
                print(f"Response: {response.text}")
                return False
                
            elif response.status_code == 401:
                print(f"❌ UNAUTHORIZED (401) - Authentication required")
                print(f"Response: {response.text}")
                return False
                
            else:
                print(f"❌ UNEXPECTED STATUS: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Request failed with exception: {str(e)}")
            return False
    
    def verify_user_is_admin(self):
        """Verify the current user has admin privileges"""
        print("\n🔍 Verifying admin privileges...")
        
        headers = {
            'Authorization': f'Bearer {self.session_token}'
        }
        
        try:
            response = requests.get(
                f"{self.base_url}/auth/me",
                headers=headers
            )
            
            if response.status_code == 200:
                user_data = response.json()
                is_admin = user_data.get('is_admin', False)
                
                print(f"User ID: {user_data.get('user_id')}")
                print(f"Email: {user_data.get('email')}")
                print(f"Is Admin: {is_admin}")
                
                if is_admin:
                    print("✅ User has admin privileges")
                    return True
                else:
                    print("❌ User does NOT have admin privileges")
                    return False
            else:
                print(f"❌ Failed to get user info: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Error verifying admin status: {str(e)}")
            return False

def main():
    print("🚀 Testing POST /api/admin/items endpoint")
    print(f"Backend URL: https://menu-navigation-fix-1.preview.emergentagent.com/api")
    print(f"Test started at: {datetime.now()}")
    print("="*60)
    
    tester = AdminItemsTest()
    
    # Step 1: Create admin session
    if not tester.create_admin_session():
        print("\n❌ FAILED: Could not create admin session")
        return 1
    
    # Step 2: Verify admin privileges
    if not tester.verify_user_is_admin():
        print("\n❌ FAILED: User does not have admin privileges")
        return 1
    
    # Step 3: Test the admin items endpoint
    if tester.test_admin_items_endpoint():
        print("\n🎉 SUCCESS: POST /api/admin/items endpoint working correctly!")
        return 0
    else:
        print("\n❌ FAILED: POST /api/admin/items endpoint has issues")
        return 1

if __name__ == "__main__":
    sys.exit(main())