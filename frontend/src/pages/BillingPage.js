import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { axiosInstance } from '@/App';
import { Plus, Trash2, Search, Phone, MapPin, X, Pencil, Map, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import Layout from '@/components/Layout';

const BillingPage = ({ user: initialUser }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, setUser] = useState(initialUser);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('Rice');
  const [billingRows, setBillingRows] = useState([]);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [grandTotal, setGrandTotal] = useState(0);
  const [cartLoaded, setCartLoaded] = useState(false);
  
  const showModal = searchParams.get('modal') === 'select-item';
  const [editMode, setEditMode] = useState(false);
  const [editOrderId, setEditOrderId] = useState(null);
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [geolocation, setGeolocation] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    if (user) {
      setPhoneNumber(user.phone_number || '');
      setHomeAddress(user.home_address || '');
      setGeolocation(user.geolocation || '');
    }
  }, [user]);

  const openItemModal = () => setSearchParams({ modal: 'select-item' });
  const closeItemModal = () => {
    setSearchParams({});
    setSearchQuery('');
    setSelectedCategory('Rice');
  };

  const fetchItems = async () => {
    try {
      const response = await axiosInstance.get('/items');
      setItems(response.data);
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
      const cats = response.data;
      const sortedCategories = cats.sort((a, b) => {
        if (a === 'Rice') return -1;
        if (b === 'Rice') return 1;
        if (a === 'All') return 1;
        if (b === 'All') return -1;
        return a.localeCompare(b);
      });
      if (!sortedCategories.includes('All')) sortedCategories.push('All');
      setCategories(sortedCategories);
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
        item_id: row.item_id, item_name: row.item_name, rate: row.rate, quantity: row.quantity || 0, total: row.total || 0,
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

  useEffect(() => {
    if (location.state?.editOrder) {
      const { order_id, items: orderItems } = location.state.editOrder;
      setEditMode(true);
      setEditOrderId(order_id);
      const editRows = orderItems.map((item, index) => ({
        id: Date.now() + index, item_id: item.item_id, item_name: item.item_name, rate: item.rate, quantity: item.quantity, total: item.total,
      }));
      setBillingRows(editRows);
      setCartLoaded(true);
      toast.info(`Editing order ${order_id.slice(-8)}...`);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    if (cartLoaded && billingRows.length >= 0) {
      const timeoutId = setTimeout(() => saveCart(billingRows), 500);
      return () => clearTimeout(timeoutId);
    }
  }, [billingRows, cartLoaded, saveCart]);

  useEffect(() => {
    const total = billingRows.reduce((sum, row) => sum + row.total, 0);
    setGrandTotal(total);
  }, [billingRows]);

  const addItemToBill = (item) => {
    const newRow = { id: Date.now(), item_id: item.item_id, item_name: item.name, rate: item.rate, quantity: 1, total: item.rate * 1 };
    setBillingRows([...billingRows, newRow]);
    closeItemModal();
    toast.success(`${item.name} added to bill`);
  };

  const updateQuantity = (id, value) => {
    let sanitized = value.replace(/[^0-9.]/g, '');
    sanitized = sanitized.replace(/^0+(?=\d)/, '');
    const parts = sanitized.split('.');
    if (parts.length > 2) sanitized = parts[0] + '.' + parts.slice(1).join('');
    const qty = Math.min(parseFloat(sanitized) || 0, 10000);
    setBillingRows(billingRows.map(row => 
      row.id === id ? { ...row, quantity: sanitized === '' ? '' : sanitized, total: parseFloat((row.rate * qty).toFixed(2)) } : row
    ));
  };

  const deleteRow = (id) => {
    setBillingRows(billingRows.filter(row => row.id !== id));
    toast.success('Item removed from bill');
  };

  const sanitizeInput = (text, maxLength = 500) => text ? text.toString().trim().slice(0, maxLength) : '';

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setIsLocating(true);
    toast.info('Capturing precise GPS coordinates...', { duration: 2000 });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setGeolocation(`${latitude}, ${longitude}`);
        toast.success('GPS coordinates captured!');
        setIsLocating(false);
      },
      (error) => {
        setIsLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error('Location permission was denied. Please allow access.');
            break;
          case error.POSITION_UNAVAILABLE:
            toast.error('Location information is currently unavailable.');
            break;
          case error.TIMEOUT:
            toast.error('The request to get your location timed out.');
            break;
          default:
            toast.error('An unknown error occurred.');
            break;
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSaveProfileAndOrder = async () => {
    const cleanPhone = sanitizeInput(phoneNumber, 20);
    const cleanAddress = sanitizeInput(homeAddress, 1000);
    
    if (!cleanPhone || cleanPhone.length < 7) { toast.error('Please enter a valid phone number'); return; }
    if (!cleanAddress || cleanAddress.length < 5) { toast.error('Please enter a valid address'); return; }

    setSavingProfile(true);
    try {
      const profileResponse = await axiosInstance.put('/user/profile', { 
        phone_number: cleanPhone, 
        home_address: cleanAddress,
        geolocation: geolocation // Will send empty string if skipped, which is fine
      });
      setUser(profileResponse.data);
      
      const sanitizedItems = billingRows.map(row => ({
        item_id: sanitizeInput(row.item_id, 50), item_name: sanitizeInput(row.item_name, 200), rate: parseFloat(row.rate) || 0, quantity: parseFloat(row.quantity) || 0, total: parseFloat((row.rate * row.quantity).toFixed(2)) || 0
      }));
      
      if (editMode && editOrderId) {
        await axiosInstance.put(`/orders/${editOrderId}`, { items: sanitizedItems, grand_total: parseFloat(grandTotal.toFixed(2)) });
        toast.success('Order updated successfully!');
        setEditMode(false);
        setEditOrderId(null);
      } else {
        await axiosInstance.post('/orders', { items: sanitizedItems, grand_total: parseFloat(grandTotal.toFixed(2)) });
        toast.success('Order placed successfully!');
      }
      
      setBillingRows([]);
      setGrandTotal(0);
      await clearCart();
      setShowAddressModal(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || (editMode ? 'Failed to update order' : 'Failed to place order'));
    } finally {
      setSavingProfile(false);
    }
  };

  const placeOrder = async () => {
    if (billingRows.length === 0) { toast.error('Add items to the bill first'); return; }
    const hasZeroQuantity = billingRows.some(row => !row.quantity || row.quantity <= 0);
    if (hasZeroQuantity) { toast.error('Please enter quantity for all items'); return; }
    
    // Check for phone and address only (not geolocation)
    if (!user.phone_number || !user.home_address) { 
      setShowAddressModal(true); 
      return; 
    }

    try {
      if (editMode && editOrderId) {
        await axiosInstance.put(`/orders/${editOrderId}`, { items: billingRows, grand_total: grandTotal });
        toast.success('Order updated successfully!');
        setEditMode(false);
        setEditOrderId(null);
      } else {
        await axiosInstance.post('/orders', { items: billingRows, grand_total: grandTotal });
        toast.success('Order placed successfully!');
      }
      setBillingRows([]);
      setGrandTotal(0);
      await clearCart();
      navigate('/orders');
    } catch (error) {
      toast.error(editMode ? 'Failed to update order' : 'Failed to place order');
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <Layout user={user} setUser={setUser}>
      <div className="flex flex-col h-full relative">
        <div className="flex-1 overflow-auto p-3 md:p-8 pb-48">
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
                  setEditMode(false); setEditOrderId(null); setBillingRows([]); setGrandTotal(0); toast.info('Edit cancelled');
                }}
                variant="outline"
                className="text-amber-700 border-amber-300 hover:bg-amber-100 font-secondary"
              >
                <X className="mr-2 h-4 w-4" /> Cancel Edit
              </Button>
            </div>
          )}
          <div className="mb-2">
            <h2 className="text-base md:text-lg font-bold font-primary text-emerald-950 mb-1">{editMode ? 'Edit Order' : 'Your Cart'}</h2>
            <p className="text-xs md:text-sm text-zinc-500 font-secondary">{editMode ? 'Modify your existing order' : 'Review your items and place order'}</p>
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
                            <Input
                              data-testid={`qty-input-${index}`}
                              type="text"
                              inputMode="decimal"
                              value={row.quantity}
                              onChange={(e) => updateQuantity(row.id, e.target.value)}
                              onFocus={(e) => { const len = e.target.value.length; e.target.setSelectionRange(len, len); }}
                              onClick={(e) => { const len = e.target.value.length; e.target.setSelectionRange(len, len); }}
                              onKeyUp={(e) => { const len = e.target.value.length; e.target.setSelectionRange(len, len); }}
                              placeholder="1"
                              className="h-8 w-16 bg-transparent border border-zinc-200 rounded-md px-2 py-1 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono text-right"
                            />
                          </div>
                        </td>
                    <td className="p-2 align-middle font-mono text-sm font-medium text-emerald-900">₹{row.total.toFixed(2)}</td>
                    <td className="p-2 align-middle">
                      <button data-testid={`delete-row-btn-${index}`} onClick={() => deleteRow(row.id)} className="text-zinc-400 hover:text-rose-500 p-1 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4">
            <Button data-testid="add-item-btn" onClick={() => navigate('/')} variant="outline" className="w-full h-12 border-2 border-emerald-900 text-emerald-900 hover:bg-emerald-50 transition-all font-secondary text-base">
              <Plus className="h-5 w-5 mr-2" /> Add More Items
            </Button>
          </div>
        </div>

        {/* Order Bar - Positioned above the Layout Bottom Nav */}
        <div className="fixed bottom-16 left-0 right-0 bg-white border-t-2 border-zinc-200 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] z-40">
          <div className="max-w-7xl mx-auto px-3 md:px-8 py-3 md:py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col items-start">
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 font-primary">Grand Total</p>
                <p className="text-2xl md:text-4xl font-mono font-bold text-emerald-950 tracking-tighter leading-tight" data-testid="grand-total">₹{grandTotal.toFixed(2)}</p>
              </div>
              <Button data-testid="place-order-btn" onClick={placeOrder} className={`${editMode ? 'bg-amber-400 hover:bg-amber-500 text-amber-950' : 'bg-lime-400 hover:bg-lime-500 text-lime-950'} h-12 md:h-14 px-6 md:px-8 text-base md:text-lg font-primary font-bold transition-all whitespace-nowrap flex-shrink-0`}>
                {editMode ? 'Update Order' : 'Place Order'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showAddressModal} onOpenChange={setShowAddressModal}>
        <DialogContent className="bg-white border-none shadow-2xl sm:max-w-[500px] p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="p-6 border-b border-zinc-100 bg-emerald-900">
            <DialogTitle className="text-xl font-bold font-primary text-white">Complete Your Profile</DialogTitle>
            <p className="text-sm text-emerald-100 font-secondary mt-1">We need your contact details to deliver your order</p>
          </DialogHeader>
          <div className="p-6 space-y-6">
            <div>
              <Label htmlFor="modal-phone" className="text-sm font-primary font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center"><Phone className="h-4 w-4 mr-2" /> Phone Number *</Label>
              <Input id="modal-phone" data-testid="modal-phone-input" type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="Enter your phone number" className="font-secondary h-12"/>
            </div>
            
            <div>
              <Label htmlFor="modal-address" className="text-sm font-primary font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center"><MapPin className="h-4 w-4 mr-2" /> Delivery Address *</Label>
              <Input id="modal-address" data-testid="modal-address-input" value={homeAddress} onChange={(e) => setHomeAddress(e.target.value)} placeholder="Enter your delivery address" className="font-secondary h-12"/>
            </div>

            {/* Hidden/Automated Geolocation Input inside the checkout modal */}
            <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-primary font-bold text-zinc-500 uppercase tracking-wider flex items-center mb-0">
                  <Map className="h-4 w-4 mr-2" /> Precise GPS Location
                </Label>
                
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={handleGetLocation} 
                  disabled={isLocating}
                  className="h-8 text-xs font-secondary text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                >
                  {isLocating ? (
                    <><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-emerald-700 mr-1.5"></div> Capturing...</>
                  ) : (
                    <><Navigation className="h-3 w-3 mr-1.5" /> Capture GPS</>
                  )}
                </Button>
              </div>
              
              <Input 
                value={geolocation || 'No GPS coordinates captured yet'} 
                readOnly 
                className={`font-mono text-sm ${geolocation ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-zinc-500 bg-white border-zinc-200'}`}
              />
              <p className="text-[11px] text-zinc-500 mt-2 font-secondary">
                Capturing your exact coordinates helps our delivery drivers locate your home accurately.
              </p>
            </div>
          </div>
          <DialogFooter className="p-6 pt-0 flex gap-3">
            <Button data-testid="modal-cancel-btn" onClick={() => setShowAddressModal(false)} variant="outline" className="flex-1 h-12 font-secondary">Cancel</Button>
            <Button data-testid="modal-save-order-btn" onClick={handleSaveProfileAndOrder} disabled={savingProfile} className="flex-1 bg-emerald-900 hover:bg-emerald-950 text-white h-12 font-primary font-medium">
              {savingProfile ? 'Processing...' : (editMode ? 'Save & Update Order' : 'Save & Place Order')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default BillingPage;