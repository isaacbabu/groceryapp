import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { axiosInstance } from '@/App';
import { Menu, Plus, Trash2, Search, LogOut, User, ShoppingBag, Info, LayoutDashboard, Phone, MapPin, X, Pencil, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { toast } from 'sonner';

const BillingPage = ({ user: initialUser }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, setUser] = useState(initialUser);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [billingRows, setBillingRows] = useState([]);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [grandTotal, setGrandTotal] = useState(0);
  const [cartLoaded, setCartLoaded] = useState(false);
  
  // Modal state derived from URL
  const showModal = searchParams.get('modal') === 'select-item';
  
  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [editOrderId, setEditOrderId] = useState(null);
  
  // Address modal state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Functions to open/close modal via URL
  const openItemModal = () => {
    setSearchParams({ modal: 'select-item' });
  };

  const closeItemModal = () => {
    setSearchParams({});
    setSearchQuery('');
    setSelectedCategory('All');
  };

  const fetchItems = async () => {
    try {
      const response = await axiosInstance.get('/items');
      setItems(response.data);
      
      // If no items, seed sample items
      if (response.data.length === 0) {
        await axiosInstance.post('/seed-items');
        const newResponse = await axiosInstance.get('/items');
        setItems(newResponse.data);
      }
    } catch (error) {
      console.error('Failed to load items:', error);
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

  const loadCart = async () => {
    try {
      const response = await axiosInstance.get('/cart');
      if (response.data.items && response.data.items.length > 0) {
        const cartItems = response.data.items.map((item, index) => ({
          id: Date.now() + index,
          item_id: item.item_id,
          item_name: item.item_name,
          rate: item.rate,
          quantity: item.quantity,
          total: item.total,
        }));
        setBillingRows(cartItems);
      }
      setCartLoaded(true);
    } catch (error) {
      console.error('Failed to load cart');
      setCartLoaded(true);
    }
  };

  const saveCart = useCallback(async (rows) => {
    if (!cartLoaded) return;
    
    try {
      const cartItems = rows.map(row => ({
        item_id: row.item_id,
        item_name: row.item_name,
        rate: row.rate,
        quantity: row.quantity || 0,
        total: row.total || 0,
      }));
      await axiosInstance.put('/cart', { items: cartItems });
    } catch (error) {
      console.error('Failed to save cart');
    }
  }, [cartLoaded]);

  const clearCart = async () => {
    try {
      await axiosInstance.delete('/cart');
    } catch (error) {
      console.error('Failed to clear cart');
    }
  };

  useEffect(() => {
    fetchItems();
    fetchCategories();
    loadCart();
  }, []);

  // Check for edit order from navigation state
  useEffect(() => {
    if (location.state?.editOrder) {
      const { order_id, items: orderItems } = location.state.editOrder;
      setEditMode(true);
      setEditOrderId(order_id);
      
      // Load order items into billing rows
      const editRows = orderItems.map((item, index) => ({
        id: Date.now() + index,
        item_id: item.item_id,
        item_name: item.item_name,
        rate: item.rate,
        quantity: item.quantity,
        total: item.total,
      }));
      setBillingRows(editRows);
      setCartLoaded(true); // Mark as loaded to prevent cart override
      
      toast.info(`Editing order ${order_id.slice(-8)}...`);
      
      // Clear the navigation state to prevent reloading on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Save cart whenever billingRows changes (after initial load)
  useEffect(() => {
    if (cartLoaded && billingRows.length >= 0) {
      const timeoutId = setTimeout(() => {
        saveCart(billingRows);
      }, 500); // Debounce saves
      return () => clearTimeout(timeoutId);
    }
  }, [billingRows, cartLoaded, saveCart]);

  useEffect(() => {
    const total = billingRows.reduce((sum, row) => sum + row.total, 0);
    setGrandTotal(total);
  }, [billingRows]);

  const addItemToBill = (item) => {
    const newRow = {
      id: Date.now(),
      item_id: item.item_id,
      item_name: item.name,
      rate: item.rate,
      quantity: 1,
      total: item.rate * 1,
    };
    setBillingRows([...billingRows, newRow]);
    closeItemModal();
    toast.success(`${item.name} added to bill`);
  };

  const updateQuantity = (id, value) => {
    // Sanitize input - only allow numbers and decimal point
    let sanitized = value.replace(/[^0-9.]/g, '');
    // Remove leading zeros except for "0" or "0.x"
    sanitized = sanitized.replace(/^0+(?=\d)/, '');
    // Prevent multiple decimal points
    const parts = sanitized.split('.');
    if (parts.length > 2) {
      sanitized = parts[0] + '.' + parts.slice(1).join('');
    }
    // Parse for calculation but keep string for display to allow typing decimals
    const qty = Math.min(parseFloat(sanitized) || 0, 10000);
    setBillingRows(billingRows.map(row => 
      row.id === id ? { ...row, quantity: sanitized === '' ? '' : sanitized, total: parseFloat((row.rate * qty).toFixed(2)) } : row
    ));
  };

  const deleteRow = (id) => {
    setBillingRows(billingRows.filter(row => row.id !== id));
    toast.success('Item removed from bill');
  };

  // Sanitize text input
  const sanitizeInput = (text, maxLength = 500) => {
    if (!text) return '';
    return text.toString().trim().slice(0, maxLength);
  };

  const handleSaveProfileAndOrder = async () => {
    // Validate and sanitize inputs
    const cleanPhone = sanitizeInput(phoneNumber, 20);
    const cleanAddress = sanitizeInput(homeAddress, 1000);
    
    if (!cleanPhone || cleanPhone.length < 7) {
      toast.error('Please enter a valid phone number (minimum 7 digits)');
      return;
    }
    if (!cleanAddress || cleanAddress.length < 5) {
      toast.error('Please enter a valid address (minimum 5 characters)');
      return;
    }

    setSavingProfile(true);
    try {
      // Save profile with sanitized inputs
      const profileResponse = await axiosInstance.put('/user/profile', {
        phone_number: cleanPhone,
        home_address: cleanAddress,
      });
      setUser(profileResponse.data);
      
      // Prepare sanitized order items
      const sanitizedItems = billingRows.map(row => ({
        item_id: sanitizeInput(row.item_id, 50),
        item_name: sanitizeInput(row.item_name, 200),
        rate: parseFloat(row.rate) || 0,
        quantity: parseFloat(row.quantity) || 0,
        total: parseFloat((row.rate * row.quantity).toFixed(2)) || 0
      }));
      
      // Place or update order with sanitized data
      if (editMode && editOrderId) {
        await axiosInstance.put(`/orders/${editOrderId}`, {
          items: sanitizedItems,
          grand_total: parseFloat(grandTotal.toFixed(2)),
        });
        toast.success('Order updated successfully!');
        setEditMode(false);
        setEditOrderId(null);
      } else {
        await axiosInstance.post('/orders', {
          items: sanitizedItems,
          grand_total: parseFloat(grandTotal.toFixed(2)),
        });
        toast.success('Order placed successfully!');
      }
      
      setBillingRows([]);
      setGrandTotal(0);
      await clearCart();
      setShowAddressModal(false);
      setPhoneNumber('');
      setHomeAddress('');
    } catch (error) {
      toast.error(error.response?.data?.detail || (editMode ? 'Failed to update order' : 'Failed to place order'));
    } finally {
      setSavingProfile(false);
    }
  };

  const placeOrder = async () => {
    if (billingRows.length === 0) {
      toast.error('Add items to the bill first');
      return;
    }

    // Check if any item has 0 quantity
    const hasZeroQuantity = billingRows.some(row => !row.quantity || row.quantity <= 0);
    if (hasZeroQuantity) {
      toast.error('Please enter quantity for all items');
      return;
    }

    // Check if user has phone and address
    if (!user.phone_number || !user.home_address) {
      // Show address modal instead of redirecting
      setShowAddressModal(true);
      return;
    }

    try {
      if (editMode && editOrderId) {
        // Update existing order
        await axiosInstance.put(`/orders/${editOrderId}`, {
          items: billingRows,
          grand_total: grandTotal,
        });
        toast.success('Order updated successfully!');
        setEditMode(false);
        setEditOrderId(null);
      } else {
        // Create new order
        await axiosInstance.post('/orders', {
          items: billingRows,
          grand_total: grandTotal,
        });
        toast.success('Order placed successfully!');
      }
      setBillingRows([]);
      setGrandTotal(0);
      await clearCart();
    } catch (error) {
      toast.error(editMode ? 'Failed to update order' : 'Failed to place order');
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

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="h-screen flex flex-col md:flex-row overflow-hidden bg-zinc-50">
      {/* Sidebar Sheet */}
      <Sheet>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="p-6 border-b border-zinc-200">
            <SheetTitle className="font-primary text-xl font-bold text-emerald-950">Menu</SheetTitle>
          </SheetHeader>
          <nav className="p-4 space-y-2">
            <Button data-testid="nav-profile-btn" onClick={() => navigate('/profile')} variant="ghost" className="w-full justify-start font-secondary">
              <User className="mr-2 h-4 w-4" /> User Profile
            </Button>
            <Button data-testid="nav-orders-btn" onClick={() => navigate('/orders')} variant="ghost" className="w-full justify-start font-secondary">
              <ShoppingBag className="mr-2 h-4 w-4" /> Placed Orders
            </Button>
            <Button data-testid="nav-about-btn" onClick={() => navigate('/about')} variant="ghost" className="w-full justify-start font-secondary">
              <Info className="mr-2 h-4 w-4" /> About App
            </Button>
            {user?.is_admin && (
              <Button data-testid="nav-admin-btn" onClick={() => navigate('/admin')} variant="ghost" className="w-full justify-start font-secondary">
                <LayoutDashboard className="mr-2 h-4 w-4" /> Admin Dashboard
              </Button>
            )}
            <Button data-testid="logout-btn" onClick={handleLogout} variant="ghost" className="w-full justify-start text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-secondary">
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </Button>
          </nav>
        </SheetContent>

        {/* Main Content */}
        <div className="flex-1 flex flex-col h-full relative">
          {/* Header */}
          <div className="bg-emerald-900 border-b border-emerald-950 px-4 md:px-8 py-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <SheetTrigger asChild>
                  <Button data-testid="menu-btn" variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-emerald-800 hover:text-white p-0">
                    <Menu className="h-5 w-5" strokeWidth={1.5} />
                  </Button>
                </SheetTrigger>
                <div>
                  <h1 className="text-xl md:text-2xl font-bold font-primary text-white tracking-tight">Emmanuel Supermarket</h1>
                  <p className="text-sm text-emerald-100 font-secondary mt-0.5">Online Grocery Shopping</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-emerald-200 uppercase tracking-widest font-primary font-bold">User</p>
                <p className="text-sm font-medium text-white font-secondary">{user?.name}</p>
              </div>
            </div>
          </div>

        {/* Table Container - Fixed height with scroll */}
        <div className="flex-1 overflow-auto p-3 md:p-8 pb-1">
          {/* Edit Mode Banner */}
          {editMode && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-amber-100 rounded-full p-2">
                  <Pencil className="h-5 w-5 text-amber-700" />
                </div>
                <div>
                  <p className="font-primary font-bold text-amber-900">Editing Order</p>
                  <p className="text-sm text-amber-700 font-secondary">Order ID: {editOrderId?.slice(-8)}</p>
                </div>
              </div>
              <Button
                data-testid="cancel-edit-btn"
                onClick={() => {
                  setEditMode(false);
                  setEditOrderId(null);
                  setBillingRows([]);
                  setGrandTotal(0);
                  toast.info('Edit cancelled');
                }}
                variant="outline"
                className="text-amber-700 border-amber-300 hover:bg-amber-100 font-secondary"
              >
                <X className="mr-2 h-4 w-4" /> Cancel Edit
              </Button>
            </div>
          )}
          <div className="mb-2">
            <h2 className="text-base md:text-lg font-bold font-primary text-emerald-950 mb-1">{editMode ? 'Edit Order' : 'Ordering'}</h2>
            <p className="text-xs md:text-sm text-zinc-500 font-secondary">{editMode ? 'Modify your existing order' : 'Create new order'}</p>
          </div>
          <div className="w-full border border-zinc-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200">
                  <th className="h-10 px-2 text-left align-middle font-primary text-xs font-bold text-zinc-500 uppercase tracking-wider">Sl No</th>
                  <th className="h-10 px-2 text-left align-middle font-primary text-xs font-bold text-zinc-500 uppercase tracking-wider">Item Name</th>
                  <th className="h-10 px-2 text-left align-middle font-primary text-xs font-bold text-zinc-500 uppercase tracking-wider">Rate</th>
                  <th className="h-10 px-2 text-left align-middle font-primary text-xs font-bold text-zinc-500 uppercase tracking-wider">Quantity</th>
                  <th className="h-10 px-2 text-left align-middle font-primary text-xs font-bold text-zinc-500 uppercase tracking-wider">Total</th>
                  <th className="h-10 px-2 text-left align-middle font-primary text-xs font-bold text-zinc-500 uppercase tracking-wider w-10"></th>
                </tr>
              </thead>
              <tbody>
                {billingRows.map((row, index) => (
                  <tr key={row.id} className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors group" data-testid={`billing-row-${index}`}>
                    <td className="p-2 align-middle font-mono text-sm text-zinc-700">{index + 1}</td>
                    <td className="p-2 align-middle font-secondary text-sm text-zinc-700">{row.item_name}</td>
                    <td className="p-2 align-middle font-mono text-sm text-emerald-700">₹{row.rate.toFixed(2)}</td>
                    <td className="p-2 align-middle">
                      <div className="relative inline-flex items-center">
                        <button
                          type="button"
                          onClick={() => updateQuantity(row.id, String((parseFloat(row.quantity) || 0) + 1))}
                          className="absolute left-1 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded transition-colors"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <Input
                          data-testid={`qty-input-${index}`}
                          type="text"
                          inputMode="decimal"
                          value={row.quantity}
                          onChange={(e) => updateQuantity(row.id, e.target.value)}
                          onFocus={(e) => {
                            const len = e.target.value.length;
                            e.target.setSelectionRange(len, len);
                          }}
                          onClick={(e) => {
                            const len = e.target.value.length;
                            e.target.setSelectionRange(len, len);
                          }}
                          onKeyUp={(e) => {
                            const len = e.target.value.length;
                            e.target.setSelectionRange(len, len);
                          }}
                          placeholder="1"
                          className="h-8 w-16 bg-transparent border border-zinc-200 rounded-md pl-6 pr-2 py-1 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono text-right"
                        />
                      </div>
                    </td>
                    <td className="p-2 align-middle font-mono text-sm font-medium text-emerald-900">₹{row.total.toFixed(2)}</td>
                    <td className="p-2 align-middle">
                      <button
                        data-testid={`delete-row-btn-${index}`}
                        onClick={() => deleteRow(row.id)}
                        className="text-zinc-400 hover:text-rose-500 p-1 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-center">
            <Button
              data-testid="add-item-btn"
              onClick={openItemModal}
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-full border-2 border-emerald-900 text-emerald-900 hover:bg-emerald-900 hover:text-white transition-all"
            >
              <Plus className="h-6 w-6" />
            </Button>
          </div>
        </div>

        {/* Bottom Bar - Always visible, compact for mobile */}
        <div className="h-16 md:h-24 bg-white border-t border-zinc-200 flex flex-row items-center justify-between px-3 md:px-8 gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-20">
          <div className="flex flex-col items-start">
            <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-zinc-400 font-primary">Grand Total</p>
            <p className="text-xl md:text-5xl font-mono font-bold text-emerald-950 tracking-tighter leading-tight" data-testid="grand-total">₹{grandTotal.toFixed(2)}</p>
          </div>
          <Button
            data-testid="place-order-btn"
            onClick={placeOrder}
            className={`${editMode ? 'bg-amber-400 hover:bg-amber-500 text-amber-950' : 'bg-lime-400 hover:bg-lime-500 text-lime-950'} h-12 md:h-14 px-4 md:px-8 text-sm md:text-lg font-primary font-bold transition-all whitespace-nowrap flex-shrink-0`}
          >
            {editMode ? 'Update Order' : 'Place Order'}
          </Button>
        </div>
        </div>

      {/* Item Selection Modal */}
      <Dialog open={showModal} onOpenChange={(open) => !open && closeItemModal()}>
        <DialogContent 
          className="bg-white border-none shadow-2xl sm:max-w-[800px] p-0 overflow-hidden rounded-2xl"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader className="p-6 border-b border-zinc-100 bg-zinc-50/50">
            <DialogTitle className="text-2xl font-bold font-primary text-emerald-950">Select Item</DialogTitle>
          </DialogHeader>
          
          <div className="p-6">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-zinc-400" />
              <Input
                data-testid="item-search-input"
                type="text"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 font-secondary"
              />
            </div>

            {/* Category Filter */}
            <div className="mb-6 flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  data-testid={`category-filter-${category.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-full text-sm font-secondary font-medium transition-all ${
                    selectedCategory === category
                      ? 'bg-emerald-900 text-white'
                      : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[50vh] overflow-y-auto">
              {filteredItems.length === 0 ? (
                <div className="col-span-full text-center py-12 text-zinc-500">
                  <p className="font-secondary">No items found</p>
                </div>
              ) : (
                filteredItems.map((item) => (
                  <div
                    key={item.item_id}
                    data-testid={`item-card-${item.item_id}`}
                    className="group relative flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white hover:border-emerald-500/50 hover:shadow-lg transition-all"
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden bg-zinc-100">
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => {
                          e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400';
                        }}
                      />
                    </div>
                    <div className="p-4">
                      <span className="text-xs font-secondary text-emerald-600 uppercase tracking-wider">{item.category}</span>
                      <h3 className="font-primary font-bold text-zinc-900 truncate mt-1">{item.name}</h3>
                      <p className="font-mono text-emerald-700 font-medium mt-1">₹{item.rate.toFixed(2)}</p>
                      <button
                        data-testid={`add-item-btn-${item.item_id}`}
                        onClick={() => addItemToBill(item)}
                        className="mt-3 w-full h-9 rounded-md bg-lime-400 hover:bg-lime-500 text-lime-950 flex items-center justify-center transition-colors shadow-sm font-secondary font-medium text-sm"
                      >
                        <Plus className="h-4 w-4 mr-1" /> Add Item
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Address Requirement Modal */}
      <Dialog open={showAddressModal} onOpenChange={setShowAddressModal}>
        <DialogContent className="bg-white border-none shadow-2xl sm:max-w-[500px] p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="p-6 border-b border-zinc-100 bg-emerald-900">
            <DialogTitle className="text-xl font-bold font-primary text-white">Complete Your Profile</DialogTitle>
            <p className="text-sm text-emerald-100 font-secondary mt-1">We need your contact details to deliver your order</p>
          </DialogHeader>
          
          <div className="p-6 space-y-6">
            <div>
              <Label htmlFor="modal-phone" className="text-sm font-primary font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center">
                <Phone className="h-4 w-4 mr-2" /> Phone Number *
              </Label>
              <Input
                id="modal-phone"
                data-testid="modal-phone-input"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Enter your phone number"
                className="font-secondary h-12"
              />
            </div>

            <div>
              <Label htmlFor="modal-address" className="text-sm font-primary font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center">
                <MapPin className="h-4 w-4 mr-2" /> Delivery Address *
              </Label>
              <Input
                id="modal-address"
                data-testid="modal-address-input"
                value={homeAddress}
                onChange={(e) => setHomeAddress(e.target.value)}
                placeholder="Enter your delivery address"
                className="font-secondary h-12"
              />
            </div>
          </div>

          <DialogFooter className="p-6 pt-0 flex gap-3">
            <Button
              data-testid="modal-cancel-btn"
              onClick={() => setShowAddressModal(false)}
              variant="outline"
              className="flex-1 h-12 font-secondary"
            >
              Cancel
            </Button>
            <Button
              data-testid="modal-save-order-btn"
              onClick={handleSaveProfileAndOrder}
              disabled={savingProfile}
              className="flex-1 bg-emerald-900 hover:bg-emerald-950 text-white h-12 font-primary font-medium"
            >
              {savingProfile ? 'Processing...' : (editMode ? 'Save & Update Order' : 'Save & Place Order')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </Sheet>
    </div>
  );
};

export default BillingPage;
