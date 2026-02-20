import React, { useState, useEffect, useCallback } from 'react';
import { axiosInstance } from '@/App';
import { Search, ChevronUp, ChevronDown, Trash2, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import Layout from '@/components/Layout';

const HomePage = () => {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingItems, setAddingItems] = useState(new Set());
  const [addedItems, setAddedItems] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [itemQuantities, setItemQuantities] = useState({});

  const fetchItems = async () => {
    try {
      const response = await axiosInstance.get('/items?limit=500');
      setItems(response.data);
      if (response.data.length === 0) {
        await axiosInstance.post('/seed-items');
        const newResponse = await axiosInstance.get('/items?limit=500');
        setItems(newResponse.data);
      }
    } catch (error) {
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
      const addedItemIds = new Set(cartItems.map(item => item.item_id));
      setAddedItems(addedItemIds);
      const quantitiesFromCart = cartItems.reduce((acc, cartItem) => {
        acc[cartItem.item_id] = cartItem.quantity || 1;
        return acc;
      }, {});
      setItemQuantities(prev => ({ ...prev, ...quantitiesFromCart }));
    } catch (error) {
      console.error('Failed to load cart items');
    }
  };

  const checkAuthAndLoadData = useCallback(async () => {
    try {
      const authResponse = await axiosInstance.get('/auth/me');
      const currentUser = authResponse.data;
      setUser(currentUser);
      if (currentUser) loadCartItems();
    } catch (error) {
      console.log("Guest user");
    } finally {
      fetchItems();
      fetchCategories();
    }
  }, []);

  useEffect(() => {
    checkAuthAndLoadData();
  }, [checkAuthAndLoadData]);

  // Handle direct login for guest users adding items
  const handleLoginPrompt = () => {
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
    const redirectUri = `${window.location.origin}/auth/callback`;
    const params = new URLSearchParams({
      client_id: clientId, redirect_uri: redirectUri, response_type: "id_token",
      scope: "openid email profile", nonce: Math.random().toString(36).substring(2), prompt: "select_account",
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  };

  const getItemQuantity = (itemId) => itemQuantities[itemId] || 1;

  const updateCartItemQuantity = async (item, nextQuantity) => {
    try {
      const cartResponse = await axiosInstance.get('/cart');
      const currentCart = cartResponse.data.items || [];
      const existingItemIndex = currentCart.findIndex(cartItem => cartItem.item_id === item.item_id);
      let updatedCart = [...currentCart];
      if (existingItemIndex >= 0) {
        updatedCart[existingItemIndex] = {
          ...updatedCart[existingItemIndex], quantity: nextQuantity, total: nextQuantity * updatedCart[existingItemIndex].rate,
        };
      } else {
        updatedCart = [...currentCart, {
            item_id: item.item_id, item_name: item.name, rate: item.rate, quantity: nextQuantity, total: item.rate * nextQuantity,
        }];
        setAddedItems(prev => new Set([...prev, item.item_id]));
      }
      await axiosInstance.put('/cart', { items: updatedCart });
    } catch (error) {
      toast.error('Failed to update quantity');
    }
  };

  const setQuantity = (item, nextQuantity) => {
    setItemQuantities(prev => ({ ...prev, [item.item_id]: nextQuantity }));
    if (addedItems.has(item.item_id)) updateCartItemQuantity(item, nextQuantity);
  };

  const increaseQuantity = (item) => setQuantity(item, getItemQuantity(item.item_id) + 1);
  const decreaseQuantity = (item) => {
    const currentQty = getItemQuantity(item.item_id);
    if (currentQty > 1) setQuantity(item, currentQty - 1);
  };

  const addToCart = async (item) => {
    if (!user) {
      toast.info("Please sign in to add items to cart");
      handleLoginPrompt();
      return;
    }
    setAddingItems(prev => new Set([...prev, item.item_id]));
    setItemQuantities(prev => ({ ...prev, [item.item_id]: 1 }));

    try {
      const updatedCart = items
        .filter(i => addedItems.has(i.item_id) || i.item_id === item.item_id)
        .map(i => {
          const quantity = i.item_id === item.item_id ? 1 : getItemQuantity(i.item_id);
          return { item_id: i.item_id, item_name: i.name, rate: i.rate, quantity, total: i.rate * quantity };
        });

      await axiosInstance.put('/cart', { items: updatedCart });
      toast.success(`${item.name} added to cart!`);
      setAddedItems(prev => new Set([...prev, item.item_id]));
    } catch (error) {
      toast.error('Failed to add item to cart');
      setAddedItems(prev => { const newSet = new Set(prev); newSet.delete(item.item_id); return newSet; });
    } finally {
      setAddingItems(prev => { const newSet = new Set(prev); newSet.delete(item.item_id); return newSet; });
    }
  };

  const removeFromCart = async (item) => {
    setAddingItems(prev => new Set([...prev, item.item_id]));
    try {
      const cartResponse = await axiosInstance.get('/cart');
      const updatedCart = (cartResponse.data.items || []).filter(cartItem => cartItem.item_id !== item.item_id);
      await axiosInstance.put('/cart', { items: updatedCart });
      toast.success(`${item.name} removed from cart!`);
      setAddedItems(prev => { const newSet = new Set(prev); newSet.delete(item.item_id); return newSet; });
      setItemQuantities(prev => ({ ...prev, [item.item_id]: 1 }));
    } catch (error) {
      toast.error('Failed to remove item from cart');
    } finally {
      setAddingItems(prev => { const newSet = new Set(prev); newSet.delete(item.item_id); return newSet; });
    }
  };

  const filteredItems = searchQuery.trim() 
    ? items.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : items;

  const filteredItemsByCategory = categories.reduce((acc, category) => {
    acc[category] = filteredItems.filter(item => item.category === category);
    return acc;
  }, {});

  return (
    <Layout user={user} setUser={setUser}>
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <div className="mb-8">
          <div className="max-w-2xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-zinc-400" />
              <Input
                type="text"
                placeholder="Search for items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 border-zinc-300 focus:border-emerald-500 focus:ring-emerald-500 font-secondary bg-white shadow-sm"
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
                      <div key={item.item_id} className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden hover:shadow-md transition-shadow duration-200">
                        <div className="h-32 md:h-48 bg-zinc-100 overflow-hidden">
                          <img 
                            src={item.image_url} 
                            alt={item.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&h=300&fit=crop'; }}
                          />
                        </div>
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
                                  <div className="flex items-center justify-center gap-1 bg-zinc-100 rounded px-2 py-1.5 flex-1">
                                    <button onClick={() => decreaseQuantity(item)} className="p-1 hover:bg-zinc-200 rounded" disabled={getItemQuantity(item.item_id) <= 1}>
                                      <ChevronDown className="h-4 w-4 text-zinc-600" />
                                    </button>
                                    <span className="text-sm md:text-base font-bold text-emerald-600 px-2 min-w-[30px] text-center">{getItemQuantity(item.item_id)}</span>
                                    <button onClick={() => increaseQuantity(item)} className="p-1 hover:bg-zinc-200 rounded">
                                      <ChevronUp className="h-4 w-4 text-zinc-600" />
                                    </button>
                                  </div>
                                  <Button onClick={() => removeFromCart(item)} disabled={addingItems.has(item.item_id)} variant="outline" size="icon" className="h-9 w-9 md:h-10 md:w-10 border-zinc-300 text-zinc-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <Button onClick={() => addToCart(item)} disabled={addingItems.has(item.item_id)} className="font-secondary text-xs md:text-sm bg-emerald-600 hover:bg-emerald-700 text-white w-full" size="sm">
                                  {addingItems.has(item.item_id) ? (
                                    <><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>Adding</>
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
    </Layout>
  );
};

export default HomePage;