import requests
import sys
import json
from datetime import datetime

class GroceryBillingAPITester:
    def __init__(self, base_url="https://menu-navigation-fix-1.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.user_token = None  # Will be set after authentication
        self.admin_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_item_id = None
        self.test_order_id = None
        self.sample_item = None

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None, is_admin=False):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        # Use appropriate token
        if token:
            headers['Authorization'] = f'Bearer {token}'
        elif is_admin:
            headers['Authorization'] = f'Bearer {self.admin_token}'
        else:
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
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
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

    def create_mock_session(self):
        """Create a mock session for testing"""
        print("\n" + "="*50)
        print("CREATING MOCK SESSION FOR TESTING")
        print("="*50)
        
        # Try to create a session using a mock session_id
        session_data = {
            "session_id": "mock_session_12345"
        }
        
        success, session_response = self.run_test(
            "Create Mock Session (/api/auth/session)",
            "POST",
            "auth/session",
            200,
            data=session_data,
            token=None
        )
        
        if success and session_response:
            self.user_token = session_response.get("session_token")
            print(f"   Created session token: {self.user_token}")
            return True
        else:
            print("   ❌ Failed to create mock session, will test without authentication")
            return False

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print("\n" + "="*50)
        print("TESTING AUTHENTICATION ENDPOINTS")
        print("="*50)
        
        # Test /api/auth/me with user token
        success, user_data = self.run_test(
            "Get User Profile (/api/auth/me)",
            "GET",
            "auth/me",
            200,
            token=self.user_token
        )
        
        if success and user_data:
            print(f"   User ID: {user_data.get('user_id')}")
            print(f"   Email: {user_data.get('email')}")
            print(f"   Is Admin: {user_data.get('is_admin')}")
        
        # Test /api/auth/me with admin token
        success, admin_data = self.run_test(
            "Get Admin Profile (/api/auth/me)",
            "GET",
            "auth/me",
            200,
            token=self.admin_token
        )
        
        if success and admin_data:
            print(f"   Admin ID: {admin_data.get('user_id')}")
            print(f"   Email: {admin_data.get('email')}")
            print(f"   Is Admin: {admin_data.get('is_admin')}")

    def test_seed_items_endpoint(self):
        """Test seed items endpoint"""
        print("\n" + "="*50)
        print("TESTING SEED ITEMS ENDPOINT")
        print("="*50)
        
        # Test POST /api/seed-items (no auth required)
        success, seed_response = self.run_test(
            "Seed Sample Items (/api/seed-items)",
            "POST",
            "seed-items",
            200,
            token=None
        )
        
        if success and seed_response:
            print(f"   Seed response: {seed_response.get('message')}")

    def test_items_endpoints(self):
        """Test items endpoints"""
        print("\n" + "="*50)
        print("TESTING ITEMS ENDPOINTS")
        print("="*50)
        
        # Test GET /api/items (public endpoint)
        success, items_data = self.run_test(
            "Get All Items (/api/items)",
            "GET",
            "items",
            200,
            token=None
        )
        
        if success and items_data:
            print(f"   Found {len(items_data)} items")
            if items_data:
                print(f"   Sample item: {items_data[0].get('name')} - ${items_data[0].get('rate')}")
                # Store first item for cart testing
                self.sample_item = items_data[0]

    def test_categories_endpoint(self):
        """Test categories endpoint"""
        print("\n" + "="*50)
        print("TESTING CATEGORIES ENDPOINT")
        print("="*50)
        
        # Test GET /api/categories (no auth required)
        success, categories_data = self.run_test(
            "Get Categories (/api/categories)",
            "GET",
            "categories",
            200,
            token=None
        )
        
        if success and categories_data:
            print(f"   Found {len(categories_data)} categories: {categories_data}")

    def test_cart_endpoints(self):
        """Test cart endpoints"""
        print("\n" + "="*50)
        print("TESTING CART ENDPOINTS")
        print("="*50)
        
        # Test GET /api/cart (requires auth)
        success, cart_data = self.run_test(
            "Get User Cart (/api/cart)",
            "GET",
            "cart",
            200
        )
        
        if success and cart_data:
            print(f"   Cart items count: {len(cart_data.get('items', []))}")
        
        # Test PUT /api/cart (requires auth) - Save/update cart
        if hasattr(self, 'sample_item') and self.sample_item:
            cart_update_data = {
                "items": [
                    {
                        "item_id": self.sample_item["item_id"],
                        "item_name": self.sample_item["name"],
                        "rate": self.sample_item["rate"],
                        "quantity": 2,
                        "total": self.sample_item["rate"] * 2
                    }
                ]
            }
            
            success, cart_response = self.run_test(
                "Update Cart (/api/cart)",
                "PUT",
                "cart",
                200,
                data=cart_update_data
            )
            
            if success and cart_response:
                print(f"   Cart updated with {len(cart_response.get('items', []))} items")
        
        # Test GET /api/cart again to verify persistence
        success, updated_cart = self.run_test(
            "Get Updated Cart (/api/cart)",
            "GET",
            "cart",
            200
        )
        
        if success and updated_cart:
            print(f"   Updated cart items count: {len(updated_cart.get('items', []))}")
        
        # Test DELETE /api/cart (requires auth) - Clear cart
        success, clear_response = self.run_test(
            "Clear Cart (/api/cart)",
            "DELETE",
            "cart",
            200
        )
        
        if success and clear_response:
            print(f"   Cart cleared: {clear_response.get('message')}")
        
        # Test GET /api/cart after clearing
        success, empty_cart = self.run_test(
            "Get Cart After Clearing (/api/cart)",
            "GET",
            "cart",
            200
        )
        
        if success and empty_cart:
            print(f"   Cart after clearing items count: {len(empty_cart.get('items', []))}")

    def test_user_profile_endpoints(self):
        """Test user profile endpoints"""
        print("\n" + "="*50)
        print("TESTING USER PROFILE ENDPOINTS")
        print("="*50)
        
        # Test GET /api/user/profile
        success, profile_data = self.run_test(
            "Get User Profile (/api/user/profile)",
            "GET",
            "user/profile",
            200
        )
        
        # Test PUT /api/user/profile
        update_data = {
            "phone_number": "+9876543210",
            "home_address": "456 Updated Street"
        }
        
        success, updated_profile = self.run_test(
            "Update User Profile (/api/user/profile)",
            "PUT",
            "user/profile",
            200,
            data=update_data
        )

    def test_orders_endpoints(self):
        """Test orders endpoints"""
        print("\n" + "="*50)
        print("TESTING ORDERS ENDPOINTS")
        print("="*50)
        
        # First get items to create an order
        success, items_data = self.run_test(
            "Get Items for Order Creation",
            "GET",
            "items",
            200
        )
        
        if success and items_data and len(items_data) > 0:
            # Create a test order
            sample_item = items_data[0]
            order_data = {
                "items": [
                    {
                        "item_id": sample_item["item_id"],
                        "item_name": sample_item["name"],
                        "rate": sample_item["rate"],
                        "quantity": 2,
                        "total": sample_item["rate"] * 2
                    }
                ],
                "grand_total": sample_item["rate"] * 2
            }
            
            # Test POST /api/orders
            success, order_response = self.run_test(
                "Create Order (/api/orders)",
                "POST",
                "orders",
                200,
                data=order_data
            )
            
            if success and order_response:
                self.test_order_id = order_response.get("order_id")
                print(f"   Created order ID: {self.test_order_id}")
                print(f"   Original status: {order_response.get('status')}")
                print(f"   Original grand total: {order_response.get('grand_total')}")
                
                # Test PUT /api/orders/{order_id} - Update existing order
                if len(items_data) > 1:
                    # Use different items for update
                    second_item = items_data[1]
                    updated_order_data = {
                        "items": [
                            {
                                "item_id": sample_item["item_id"],
                                "item_name": sample_item["name"],
                                "rate": sample_item["rate"],
                                "quantity": 1,  # Changed quantity
                                "total": sample_item["rate"] * 1
                            },
                            {
                                "item_id": second_item["item_id"],
                                "item_name": second_item["name"],
                                "rate": second_item["rate"],
                                "quantity": 3,  # Added new item
                                "total": second_item["rate"] * 3
                            }
                        ],
                        "grand_total": (sample_item["rate"] * 1) + (second_item["rate"] * 3)
                    }
                    
                    success, updated_order_response = self.run_test(
                        f"Update Order (/api/orders/{self.test_order_id})",
                        "PUT",
                        f"orders/{self.test_order_id}",
                        200,
                        data=updated_order_data
                    )
                    
                    if success and updated_order_response:
                        print(f"   Updated order ID: {updated_order_response.get('order_id')}")
                        print(f"   Updated status: {updated_order_response.get('status')}")
                        print(f"   Updated grand total: {updated_order_response.get('grand_total')}")
                        print(f"   Updated items count: {len(updated_order_response.get('items', []))}")
                        
                        # Verify status was reset to "Pending"
                        if updated_order_response.get('status') == 'Pending':
                            print("✅ Status correctly reset to 'Pending' after update")
                        else:
                            print(f"❌ Status not reset correctly. Expected 'Pending', got '{updated_order_response.get('status')}'")
        
        # Test GET /api/orders to verify the update persisted
        success, orders_data = self.run_test(
            "Get User Orders After Update (/api/orders)",
            "GET",
            "orders",
            200
        )
        
        if success and orders_data:
            print(f"   Found {len(orders_data)} orders for user")
            if self.test_order_id and orders_data:
                # Find our test order and verify it was updated
                test_order = next((order for order in orders_data if order.get('order_id') == self.test_order_id), None)
                if test_order:
                    print(f"   Verified updated order - Status: {test_order.get('status')}, Items: {len(test_order.get('items', []))}")
                else:
                    print("   ❌ Could not find updated test order in orders list")

    def test_admin_endpoints(self):
        """Test admin endpoints"""
        print("\n" + "="*50)
        print("TESTING ADMIN ENDPOINTS")
        print("="*50)
        
        # Test GET /api/admin/orders
        success, admin_orders = self.run_test(
            "Get All Orders (Admin) (/api/admin/orders)",
            "GET",
            "admin/orders",
            200,
            is_admin=True
        )
        
        if success and admin_orders:
            print(f"   Admin can see {len(admin_orders)} total orders")
        
        # Test admin item management
        # Create new item
        new_item_data = {
            "name": "Test Item",
            "rate": 99.99,
            "image_url": "https://via.placeholder.com/200",
            "category": "Test Category"
        }
        
        success, created_item = self.run_test(
            "Create Item (Admin) (/api/admin/items)",
            "POST",
            "admin/items",
            200,
            data=new_item_data,
            is_admin=True
        )
        
        if success and created_item:
            self.test_item_id = created_item.get("item_id")
            print(f"   Created item ID: {self.test_item_id}")
            
            # Test update item
            update_item_data = {
                "name": "Updated Test Item",
                "rate": 149.99,
                "image_url": "https://via.placeholder.com/300",
                "category": "Updated Category"
            }
            
            success, updated_item = self.run_test(
                f"Update Item (Admin) (/api/admin/items/{self.test_item_id})",
                "PUT",
                f"admin/items/{self.test_item_id}",
                200,
                data=update_item_data,
                is_admin=True
            )

    def test_delete_operations(self):
        """Test delete operations"""
        print("\n" + "="*50)
        print("TESTING DELETE OPERATIONS")
        print("="*50)
        
        # Test delete order (user can delete own order)
        if self.test_order_id:
            success, delete_response = self.run_test(
                f"Delete Order (/api/orders/{self.test_order_id})",
                "DELETE",
                f"orders/{self.test_order_id}",
                200
            )
        
        # Test delete item (admin only)
        if self.test_item_id:
            success, delete_response = self.run_test(
                f"Delete Item (Admin) (/api/admin/items/{self.test_item_id})",
                "DELETE",
                f"admin/items/{self.test_item_id}",
                200,
                is_admin=True
            )

    def test_unauthorized_access(self):
        """Test unauthorized access scenarios"""
        print("\n" + "="*50)
        print("TESTING UNAUTHORIZED ACCESS")
        print("="*50)
        
        # Test admin endpoint with user token (should fail)
        success, response = self.run_test(
            "User accessing Admin Orders (should fail)",
            "GET",
            "admin/orders",
            403,
            token=self.user_token
        )
        
        # Test without token (should fail)
        success, response = self.run_test(
            "Access without token (should fail)",
            "GET",
            "auth/me",
            401,
            token=None
        )

def main():
    print("🚀 Starting Grocery Billing API Tests")
    print(f"Backend URL: https://menu-navigation-fix-1.preview.emergentagent.com/api")
    print(f"Test started at: {datetime.now()}")
    
    tester = GroceryBillingAPITester()
    
    # First try to create a mock session for authentication
    session_created = tester.create_mock_session()
    
    # Run all test suites - following the test flow from review request
    tester.test_seed_items_endpoint()  # First seed data
    tester.test_items_endpoints()      # Verify items exist
    tester.test_categories_endpoint()  # Verify categories are returned
    
    if session_created:
        # Only run authenticated tests if session was created successfully
        tester.test_cart_endpoints()       # Test cart functionality with auth
        tester.test_auth_endpoints()
        tester.test_user_profile_endpoints()
        tester.test_orders_endpoints()     # This includes the PUT /api/orders/{order_id} test
        tester.test_admin_endpoints()
        tester.test_delete_operations()
        tester.test_unauthorized_access()
    else:
        print("\n⚠️  Skipping authenticated tests due to session creation failure")
    
    # Print final results
    print("\n" + "="*50)
    print("FINAL TEST RESULTS")
    print("="*50)
    print(f"📊 Tests passed: {tester.tests_passed}/{tester.tests_run}")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"❌ {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())