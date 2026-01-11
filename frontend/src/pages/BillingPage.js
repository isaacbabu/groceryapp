import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { axiosInstance } from '@/App';
import { Menu, Plus, Trash2, Search, LogOut, User, ShoppingBag, Info, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { toast } from 'sonner';

const BillingPage = ({ user }) => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [billingRows, setBillingRows] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [grandTotal, setGrandTotal] = useState(0);

  const fetchItems = async () => {
    try {
      const response = await axiosInstance.get('/items');
      setItems(response.data);
    } catch (error) {
      toast.error('Failed to load items');
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

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
      quantity: '',
      total: 0,
    };
    setBillingRows([...billingRows, newRow]);
    setShowModal(false);
    setSearchQuery('');
    toast.success(`${item.name} added to bill`);
    
    setTimeout(() => {
      const input = document.querySelector(`input[data-testid="qty-input-${billingRows.length}"]`);
      if (input) input.focus();
    }, 100);
  };

  const updateQuantity = (id, quantity) => {
    const qty = parseFloat(quantity) || 0;
    setBillingRows(billingRows.map(row => 
      row.id === id ? { ...row, quantity: qty, total: row.rate * qty } : row
    ));
  };

  const deleteRow = (id) => {
    setBillingRows(billingRows.filter(row => row.id !== id));
    toast.success('Item removed from bill');
  };

  const placeOrder = async () => {
    if (billingRows.length === 0) {
      toast.error('Add items to the bill first');
      return;
    }

    if (!user.phone_number || !user.home_address) {
      toast.error('Please complete your profile first');
      navigate('/profile');
      return;
    }

    try {
      await axiosInstance.post('/orders', {
        items: billingRows,
        grand_total: grandTotal,
      });
      toast.success('Order placed successfully!');
      setBillingRows([]);
      setGrandTotal(0);
    } catch (error) {
      toast.error('Failed to place order');
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

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
                  <h1 className="text-xl md:text-2xl font-bold font-primary text-white tracking-tight">Emmanuel Agencies</h1>
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
          <div className="mb-2">
            <h2 className="text-base md:text-lg font-bold font-primary text-emerald-950 mb-1">Ordering</h2>
            <p className="text-xs md:text-sm text-zinc-500 font-secondary">Create new order</p>
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
                      <Input
                        data-testid={`qty-input-${index}`}
                        type="number"
                        min="0"
                        step="0.1"
                        value={row.quantity}
                        onChange={(e) => updateQuantity(row.id, e.target.value)}
                        placeholder="0"
                        className="h-8 w-16 bg-transparent border border-zinc-200 rounded-md px-2 py-1 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono text-right"
                      />
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
              onClick={() => setShowModal(true)}
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
            className="bg-lime-400 hover:bg-lime-500 text-lime-950 h-12 md:h-14 px-4 md:px-8 text-sm md:text-lg font-primary font-bold transition-all whitespace-nowrap flex-shrink-0"
          >
            Place Order
          </Button>
        </div>
      </div>

      {/* Item Selection Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="bg-white border-none shadow-2xl sm:max-w-[800px] p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="p-6 border-b border-zinc-100 bg-zinc-50/50">
            <DialogTitle className="text-2xl font-bold font-primary text-emerald-950">Select Item</DialogTitle>
          </DialogHeader>
          
          <div className="p-6">
            <div className="relative mb-6">
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

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto">
              {filteredItems.map((item) => (
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
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="font-primary font-bold text-zinc-900 truncate">{item.name}</h3>
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
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BillingPage;