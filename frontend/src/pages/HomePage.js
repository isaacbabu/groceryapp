import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { axiosInstance } from '@/App';
import { Menu, Plus, LogOut, User, ShoppingBag, Info, LayoutDashboard, ShoppingCart, Check, Search, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

const HomePage = ({ user: initialUser }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(initialUser);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingItems, setAddingItems] = useState(new Set());
  const [addedItems, setAddedItems] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [itemQuantities, setItemQuantities] = useState({});

  useEffect(() => {
    fetchItems();
    fetchCategories();
    loadCartItems();
  }, []);

  const fetchItems = async () => {
    try {
      // Fetch all items with higher limit (500 max from backend)
      const response = await axiosInstance.get('/items?limit=500');
      setItems(response.data);
      
      // If no items, seed sample items
      if (response.data.length === 0) {
        await axiosInstance.post('/seed-items');
        const newResponse = await axiosInstance.get('/items?limit=500');
        setItems(newResponse.data);
      }
    } catch (error) {
      console.error('Failed to load items:', error);
      toast.error('Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axiosInstance.get('/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Failed to load categories');
    }
  };

  const loadCartItems = async () => {
    try {
      const response = await axiosInstance.get('/cart');
      const cartItems = response.data.items || [];

      // Mark items that are in cart as added
      const addedItemIds = new Set(cartItems.map(item => item.item_id));
      setAddedItems(addedItemIds);

      // Hydrate quantity state from persisted cart so UI reflects real quantities
      const quantitiesFromCart = cartItems.reduce((acc, cartItem) => {
        acc[cartItem.item_id] = cartItem.quantity || 1;
        return acc;
      }, {});
      setItemQuantities(prev => ({ ...prev, ...quantitiesFromCart }));
    } catch (error) {
      console.error('Failed to load cart items');
    }
  };

  const getItemQuantity = (itemId) => {
    return itemQuantities[itemId] || 1;
  };

  const updateCartItemQuantity = async (item, nextQuantity) => {
    // NOTE: we intentionally do NOT add this item to `addingItems`.
    // That state is used to disable controls / show loaders for add/remove,
    // but quantity updates should feel instant and should not animate the trash icon.

    try {
      const cartResponse = await axiosInstance.get('/cart');
      const currentCart = cartResponse.data.items || [];

      const existingItemIndex = currentCart.findIndex(
        cartItem => cartItem.item_id === item.item_id
      );

      let updatedCart = [...currentCart];
      if (existingItemIndex >= 0) {
        updatedCart[existingItemIndex] = {
          ...updatedCart[existingItemIndex],
          quantity: nextQuantity,
          total: nextQuantity * updatedCart[existingItemIndex].rate,
        };
      } else {
        // Should be rare, but keeps cart consistent if UI state gets out of sync
        updatedCart = [
          ...currentCart,
          {
            item_id: item.item_id,
            item_name: item.name,
            rate: item.rate,
            quantity: nextQuantity,
            total: item.rate * nextQuantity,
          },
        ];
        setAddedItems(prev => new Set([...prev, item.item_id]));
      }

      await axiosInstance.put('/cart', { items: updatedCart });
    } catch (error) {
      console.error('Failed to update quantity:', error);
      toast.error('Failed to update quantity');
    }
  };

  const setQuantity = (item, nextQuantity) => {
    // Update local state instantly for snappy UI
    setItemQuantities(prev => ({
      ...prev,
      [item.item_id]: nextQuantity,
    }));

    // If it's already in cart, persist the updated quantity
    if (addedItems.has(item.item_id)) {
      updateCartItemQuantity(item, nextQuantity);
    }
  };

  const increaseQuantity = (item) => {
    const currentQty = getItemQuantity(item.item_id);
    setQuantity(item, currentQty + 1);
  };

  const decreaseQuantity = (item) => {
    const currentQty = getItemQuantity(item.item_id);
    if (currentQty > 1) {
      setQuantity(item, currentQty - 1);
    }
  };

  const addToCart = async (item) => {
    setAddingItems(prev => new Set([...prev, item.item_id]));

    // Ensure first click always adds quantity=1, and reveals the toggler
    setItemQuantities(prev => ({
      ...prev,
      [item.item_id]: 1,
    }));

    try {
      // Get current cart
      const cartResponse = await axiosInstance.get('/cart');
      const currentCart = cartResponse.data.items || [];

      const quantity = 1;

      // Check if item already exists in cart
      const existingItemIndex = currentCart.findIndex(
        cartItem => cartItem.item_id === item.item_id
      );

      let updatedCart;
      if (existingItemIndex >= 0) {
        // Item exists, update quantity
        updatedCart = [...currentCart];
        updatedCart[existingItemIndex].quantity = quantity;
        updatedCart[existingItemIndex].total = quantity * updatedCart[existingItemIndex].rate;
      } else {
        // New item
        updatedCart = [
          ...currentCart,
          {
            item_id: item.item_id,
            item_name: item.name,
            rate: item.rate,
            quantity,
            total: item.rate * quantity,
          },
        ];
      }

      // Save updated cart
      await axiosInstance.put('/cart', { items: updatedCart });
      toast.success(`${item.name} added to cart!`);

      setAddedItems(prev => new Set([...prev, item.item_id]));
    } catch (error) {
      console.error('Failed to add to cart:', error);
      toast.error('Failed to add item to cart');

      // If add fails, revert UI back to pre-add state
      setAddedItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(item.item_id);
        return newSet;
      });
    } finally {
      setAddingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(item.item_id);
        return newSet;
      });
    }
  };

  const removeFromCart = async (item) => {
    setAddingItems(prev => new Set([...prev, item.item_id]));
    
    try {
      // Get current cart
      const cartResponse = await axiosInstance.get('/cart');
      const currentCart = cartResponse.data.items || [];
      
      // Remove item from cart
      const updatedCart = currentCart.filter(cartItem => cartItem.item_id !== item.item_id);
      
      // Save updated cart
      await axiosInstance.put('/cart', { items: updatedCart });
      toast.success(`${item.name} removed from cart!`);
      
      // Remove from added items
      setAddedItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(item.item_id);
        return newSet;
      });
      
      // Reset quantity to 1
      setItemQuantities(prev => ({
        ...prev,
        [item.item_id]: 1
      }));
      
    } catch (error) {
      console.error('Failed to remove from cart:', error);
      toast.error('Failed to remove item from cart');
    } finally {
      setAddingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(item.item_id);
        return newSet;
      });
    }
  };

  const handleLogout = async () => {
    try {
      await axiosInstance.post('/auth/logout');
      toast.success('Logged out successfully');
      navigate('/login');
    } catch (error) {
      toast.error('Logout failed');
    }
  };

  // Filter items based on search query
  const filteredItems = searchQuery.trim() 
    ? items.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : items;

  // Group filtered items by category
  const filteredItemsByCategory = categories.reduce((acc, category) => {
    acc[category] = filteredItems.filter(item => item.category === category);
    return acc;
  }, {});

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50">
      {/* Sidebar Sheet */}
      <Sheet>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="p-6 border-b border-zinc-200">
            <SheetTitle className="font-primary text-xl font-bold text-emerald-950">Menu</SheetTitle>
          </SheetHeader>
          <nav className="p-4 space-y-2">
            <Button onClick={() => navigate('/')} variant="ghost" className="w-full justify-start font-secondary bg-emerald-50 text-emerald-700">
              <ShoppingCart className="mr-2 h-4 w-4" /> Home
            </Button>
            <Button onClick={() => navigate('/your-order')} variant="ghost" className="w-full justify-start font-secondary">
              <ShoppingBag className="mr-2 h-4 w-4" /> Your Order
            </Button>
            <Button onClick={() => navigate('/profile')} variant="ghost" className="w-full justify-start font-secondary">
              <User className="mr-2 h-4 w-4" /> User Profile
            </Button>
            <Button onClick={() => navigate('/orders')} variant="ghost" className="w-full justify-start font-secondary">
              <ShoppingBag className="mr-2 h-4 w-4" /> Placed Orders
            </Button>
            <Button onClick={() => navigate('/about')} variant="ghost" className="w-full justify-start font-secondary">
              <Info className="mr-2 h-4 w-4" /> About App
            </Button>
            {user?.is_admin && (
              <Button onClick={() => navigate('/admin')} variant="ghost" className="w-full justify-start font-secondary">
                <LayoutDashboard className="mr-2 h-4 w-4" /> Admin Dashboard
              </Button>
            )}
            <Button onClick={handleLogout} variant="ghost" className="w-full justify-start text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-secondary">
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </Button>
          </nav>
        </SheetContent>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="bg-emerald-900 border-b border-emerald-950 px-4 md:px-8 py-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-emerald-800 hover:text-white p-0">
                    <Menu className="h-5 w-5" strokeWidth={1.5} />
                  </Button>
                </SheetTrigger>
                <div className="cursor-pointer" onClick={() => navigate('/')}>
                  <h1 className="text-xl md:text-2xl font-bold font-primary text-white tracking-tight">Emmanuel Supermarket</h1>
                  <p className="text-sm text-emerald-100 font-secondary mt-0.5">Online Grocery Shopping</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Button 
                  onClick={() => navigate('/your-order')} 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-secondary"
                  size="sm"
                >
                  <ShoppingBag className="mr-2 h-4 w-4" />
                  View Cart
                </Button>
                <div className="text-right hidden md:block">
                  <p className="text-xs text-emerald-200 uppercase tracking-widest font-primary font-bold">User</p>
                  <p className="text-sm font-medium text-white font-secondary">{user?.name}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-auto">
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
              {/* Welcome Section */}
              <div className="mb-8">
                <h2 className="text-3xl font-bold font-primary text-emerald-950 mb-2">Welcome to Emmanuel Supermarket</h2>
                <p className="text-zinc-600 font-secondary mb-6">Browse our fresh products and add items to your cart</p>
                
                {/* Search Box */}
                <div className="max-w-2xl">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-zinc-400" />
                    <Input
                      type="text"
                      placeholder="Search for items..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-12 border-zinc-300 focus:border-emerald-500 focus:ring-emerald-500 font-secondary"
                    />
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
                    <p className="text-zinc-600 font-secondary">Loading products...</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-12">
                  {categories.map(category => {
                    const categoryItems = filteredItemsByCategory[category] || [];
                    if (categoryItems.length === 0) return null;

                    return (
                      <div key={category}>
                        <div className="flex items-center gap-3 mb-6">
                          <h3 className="text-2xl font-bold font-primary text-emerald-950">{category}</h3>
                          <Badge variant="secondary" className="font-secondary">{categoryItems.length} items</Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-6">
                          {categoryItems.map(item => (
                            <div 
                              key={item.item_id} 
                              className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden hover:shadow-md transition-shadow duration-200"
                            >
                              {/* Item Image */}
                              <div className="h-32 md:h-48 bg-zinc-100 overflow-hidden">
                                <img 
                                  src={item.image_url} 
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                  onError={(e) => {
                                    e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&h=300&fit=crop';
                                  }}
                                />
                              </div>
                              
                              {/* Item Details */}
                              <div className="p-2 md:p-4">
                                <h4 className="font-primary font-bold text-emerald-950 text-sm md:text-lg mb-0.5 md:mb-1 truncate">{item.name}</h4>
                                <p className="text-xs text-zinc-500 font-secondary mb-2 md:mb-3 hidden sm:block">{item.category}</p>
                                
                                <div className="flex flex-col gap-2">
                                  <div>
                                    <p className="text-xs text-zinc-500 font-secondary hidden sm:block">Price</p>
                                    <p className="text-base md:text-xl font-bold text-emerald-600 font-primary">₹{item.rate}</p>
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    {addedItems.has(item.item_id) ? (
                                      <>
                                        {/* Quantity Controls (LEFT) */}
                                        <div className="flex items-center justify-center gap-1 bg-zinc-100 rounded px-2 py-1.5 flex-1">
                                          <button
                                            onClick={() => decreaseQuantity(item)}
                                            className="p-1 hover:bg-zinc-200 rounded"
                                            disabled={getItemQuantity(item.item_id) <= 1}
                                          >
                                            <ChevronDown className="h-4 w-4 text-zinc-600" />
                                          </button>
                                          <span className="text-sm md:text-base font-bold text-emerald-600 px-2 min-w-[30px] text-center">
                                            {getItemQuantity(item.item_id)}
                                          </span>
                                          <button
                                            onClick={() => increaseQuantity(item)}
                                            className="p-1 hover:bg-zinc-200 rounded"
                                          >
                                            <ChevronUp className="h-4 w-4 text-zinc-600" />
                                          </button>
                                        </div>

                                        {/* Trash icon (RIGHT) */}
                                        <Button
                                          onClick={() => removeFromCart(item)}
                                          disabled={addingItems.has(item.item_id)}
                                          variant="outline"
                                          size="icon"
                                          className="h-9 w-9 md:h-10 md:w-10 border-zinc-300 text-zinc-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
                                          aria-label={`Remove ${item.name} from cart`}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </>
                                    ) : (
                                      <Button
                                        onClick={() => addToCart(item)}
                                        disabled={addingItems.has(item.item_id)}
                                        className="font-secondary text-xs md:text-sm bg-emerald-600 hover:bg-emerald-700 text-white w-full"
                                        size="sm"
                                      >
                                        {addingItems.has(item.item_id) ? (
                                          <>
                                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                                            Adding
                                          </>
                                        ) : (
                                          <>Add to Cart</>
                                        )}
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* No Results Message */}
                  {searchQuery.trim() && filteredItems.length === 0 && (
                    <div className="text-center py-20">
                      <Search className="h-16 w-16 text-zinc-300 mx-auto mb-4" />
                      <p className="text-zinc-600 font-secondary text-lg mb-2">No items found</p>
                      <p className="text-zinc-500 font-secondary text-sm">Try searching with different keywords</p>
                    </div>
                  )}
                </div>
              )}

              {!loading && items.length === 0 && (
                <div className="text-center py-20">
                  <ShoppingCart className="h-16 w-16 text-zinc-300 mx-auto mb-4" />
                  <p className="text-zinc-600 font-secondary text-lg">No items available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </Sheet>
    </div>
  );
};

export default HomePage;
