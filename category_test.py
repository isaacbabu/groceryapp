import requests
import json
from datetime import datetime

class CategoryManagementTester:
    def __init__(self, base_url="https://menu-navigation-fix-1.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.user_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_category_id = None

    def create_test_session(self):
        """Create a test session for authentication"""
        print("🔑 Creating test session...")
        
        # Create a session using the auth endpoint
        session_data = {
            "session_id": "test_session_" + str(int(datetime.now().timestamp()))
        }
        
        try:
            response = requests.post(f"{self.base_url}/auth/session", json=session_data)
            if response.status_code == 200:
                data = response.json()
                self.user_token = data.get("session_token")
                print(f"✅ User session created: {self.user_token[:20]}...")
                
                # Check if user is admin
                user_data = data.get("user", {})
                if user_data.get("is_admin"):
                    self.admin_token = self.user_token
                    print("✅ Admin privileges detected")
                else:
                    print("ℹ️ Regular user session (not admin)")
                
                return True
            else:
                print(f"❌ Failed to create session: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Session creation error: {str(e)}")
            return False

    def run_test(self, name, method, endpoint, expected_status, data=None, use_admin=False):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        # Use appropriate token
        if use_admin and self.admin_token:
            headers['Authorization'] = f'Bearer {self.admin_token}'
        elif self.user_token:
            headers['Authorization'] = f'Bearer {self.user_token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        print(f"   Method: {method}")
        if data:
            print(f"   Data: {json.dumps(data, indent=2)}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            print(f"   Response Status: {response.status_code}")
            
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2, default=str)}")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {json.dumps(error_data, indent=2)}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_public_categories_endpoint(self):
        """Test the public categories endpoint"""
        print("\n" + "="*60)
        print("TESTING PUBLIC CATEGORIES ENDPOINT")
        print("="*60)
        
        success, categories_data = self.run_test(
            "GET /api/categories (Public)",
            "GET",
            "categories",
            200
        )
        
        if success and categories_data:
            print(f"\n📊 Categories Analysis:")
            print(f"   Total categories: {len(categories_data)}")
            print(f"   Categories: {categories_data}")
            
            # Verify requirements
            expected_categories = ["All", "Household", "Pulses", "Rice", "Spices"]
            
            if categories_data == expected_categories:
                print("✅ Categories match expected format exactly")
            else:
                print("❌ Categories don't match expected format")
                print(f"   Expected: {expected_categories}")
                print(f"   Actual: {categories_data}")
            
            if categories_data[0] == "All":
                print("✅ 'All' is correctly positioned first")
            else:
                print("❌ 'All' is not first in the list")

    def test_items_with_categories(self):
        """Test items endpoint to verify categories"""
        print("\n" + "="*60)
        print("TESTING ITEMS WITH CATEGORIES")
        print("="*60)
        
        success, items_data = self.run_test(
            "GET /api/items (Verify Categories)",
            "GET",
            "items",
            200
        )
        
        if success and items_data:
            # Analyze categories in items
            categories_in_items = set()
            category_counts = {}
            
            for item in items_data:
                category = item.get('category')
                if category:
                    categories_in_items.add(category)
                    category_counts[category] = category_counts.get(category, 0) + 1
            
            print(f"\n📊 Items Analysis:")
            print(f"   Total items: {len(items_data)}")
            print(f"   Categories found in items: {sorted(categories_in_items)}")
            print(f"   Category distribution:")
            for cat, count in sorted(category_counts.items()):
                print(f"     {cat}: {count} items")
            
            # Verify expected categories exist
            expected_item_categories = {"Pulses", "Rice", "Spices", "Household"}
            if expected_item_categories.issubset(categories_in_items):
                print("✅ All expected categories found in items")
            else:
                missing = expected_item_categories - categories_in_items
                print(f"❌ Missing categories in items: {missing}")

    def test_admin_categories_endpoints(self):
        """Test admin category management endpoints"""
        print("\n" + "="*60)
        print("TESTING ADMIN CATEGORY MANAGEMENT")
        print("="*60)
        
        if not self.admin_token:
            print("⚠️ No admin token available - skipping admin tests")
            return
        
        # Test GET /api/admin/categories
        success, admin_categories = self.run_test(
            "GET /api/admin/categories (Admin)",
            "GET",
            "admin/categories",
            200,
            use_admin=True
        )
        
        if success and admin_categories:
            print(f"\n📊 Admin Categories Analysis:")
            print(f"   Total categories in admin view: {len(admin_categories)}")
            
            default_categories = [cat for cat in admin_categories if cat.get('is_default')]
            custom_categories = [cat for cat in admin_categories if not cat.get('is_default')]
            
            print(f"   Default categories: {len(default_categories)}")
            print(f"   Custom categories: {len(custom_categories)}")
            
            for cat in admin_categories:
                print(f"     - {cat.get('name')} (default: {cat.get('is_default')})")
        
        # Test POST /api/admin/categories - Create new category
        new_category_data = {
            "name": "Test Category"
        }
        
        success, created_category = self.run_test(
            "POST /api/admin/categories (Create Category)",
            "POST",
            "admin/categories",
            200,
            data=new_category_data,
            use_admin=True
        )
        
        if success and created_category:
            self.created_category_id = created_category.get('category_id')
            print(f"   Created category ID: {self.created_category_id}")
            print(f"   Is default: {created_category.get('is_default')}")
        
        # Test creating duplicate category (should fail)
        success, duplicate_response = self.run_test(
            "POST /api/admin/categories (Duplicate - Should Fail)",
            "POST",
            "admin/categories",
            400,
            data=new_category_data,
            use_admin=True
        )
        
        # Test DELETE /api/admin/categories/{category_id} - Delete custom category
        if self.created_category_id:
            success, delete_response = self.run_test(
                f"DELETE /api/admin/categories/{self.created_category_id} (Delete Custom)",
                "DELETE",
                f"admin/categories/{self.created_category_id}",
                200,
                use_admin=True
            )
        
        # Test deleting default category (should fail)
        # First get a default category ID
        if admin_categories:
            default_cat = next((cat for cat in admin_categories if cat.get('is_default')), None)
            if default_cat:
                default_cat_id = default_cat.get('category_id')
                success, delete_default_response = self.run_test(
                    f"DELETE /api/admin/categories/{default_cat_id} (Delete Default - Should Fail)",
                    "DELETE",
                    f"admin/categories/{default_cat_id}",
                    400,
                    use_admin=True
                )

    def test_unauthorized_access(self):
        """Test unauthorized access to admin endpoints"""
        print("\n" + "="*60)
        print("TESTING UNAUTHORIZED ACCESS")
        print("="*60)
        
        # Test admin endpoint without token
        success, response = self.run_test(
            "GET /api/admin/categories (No Auth - Should Fail)",
            "GET",
            "admin/categories",
            401
        )
        
        # Test admin endpoint with user token (if user is not admin)
        if self.user_token and not self.admin_token:
            success, response = self.run_test(
                "GET /api/admin/categories (User Token - Should Fail)",
                "GET",
                "admin/categories",
                403
            )

    def run_all_tests(self):
        """Run all category management tests"""
        print("🚀 Starting Category Management API Tests")
        print(f"Backend URL: {self.base_url}")
        print(f"Test started at: {datetime.now()}")
        
        # Create session first
        if not self.create_test_session():
            print("❌ Cannot proceed without valid session")
            return
        
        # Run tests in order
        self.test_public_categories_endpoint()
        self.test_items_with_categories()
        self.test_admin_categories_endpoints()
        self.test_unauthorized_access()
        
        # Print final results
        print("\n" + "="*60)
        print("FINAL TEST RESULTS")
        print("="*60)
        print(f"📊 Tests passed: {self.tests_passed}/{self.tests_run}")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All category management tests passed!")
            return 0
        else:
            print(f"❌ {self.tests_run - self.tests_passed} tests failed")
            return 1

def main():
    tester = CategoryManagementTester()
    return tester.run_all_tests()

if __name__ == "__main__":
    exit(main())