import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { axiosInstance } from '@/App';
import { ArrowLeft, Package, User, MapPin, Phone, Mail, Trash2, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const AdminDashboard = ({ user }) => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteOrderId, setDeleteOrderId] = useState(null);

  // Manage Admins State
  const [showAdminsModal, setShowAdminsModal] = useState(false);
  const [adminsList, setAdminsList] = useState([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [adminsLoading, setAdminsLoading] = useState(false);

  useEffect(() => {
    if (!user?.is_admin) {
      toast.error('Admin access required');
      navigate('/');
      return;
    }
    fetchOrders();
  }, [user, navigate]);

  const fetchOrders = async () => {
    try {
      const response = await axiosInstance.get('/admin/orders');
      setOrders(response.data);
    } catch (error) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (orderId) => {
    try {
      await axiosInstance.delete(`/orders/${orderId}`);
      setOrders(orders.filter(order => order.order_id !== orderId));
      toast.success('Order deleted successfully');
      setDeleteOrderId(null);
    } catch (error) {
      toast.error('Failed to delete order');
    }
  };

  const handleConfirmOrder = async (orderId) => {
    try {
      await axiosInstance.patch(`/admin/orders/${orderId}/confirm`);
      setOrders(orders.map(order => 
        order.order_id === orderId ? { ...order, status: 'Order Confirmed' } : order
      ));
      toast.success('Order confirmed successfully');
    } catch (error) {
      toast.error('Failed to confirm order');
    }
  };

  // Admin Role Management Functions
  const fetchAdmins = async () => {
    setAdminsLoading(true);
    try {
      const response = await axiosInstance.get('/admin/roles');
      setAdminsList(response.data);
    } catch (error) {
      toast.error('Failed to fetch admin list');
    } finally {
      setAdminsLoading(false);
    }
  };

  const handleOpenAdminsModal = () => {
    setShowAdminsModal(true);
    fetchAdmins();
  };

  const handleAddAdmin = async () => {
    if (!newAdminEmail.trim() || !newAdminEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    try {
      await axiosInstance.post('/admin/roles', { email: newAdminEmail.trim() });
      toast.success('Admin added successfully!');
      setNewAdminEmail('');
      fetchAdmins(); // Refresh list
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add admin');
    }
  };

  const handleRevokeAdmin = async (userId) => {
    try {
      await axiosInstance.delete(`/admin/roles/${userId}`);
      toast.success('Admin revoked successfully');
      fetchAdmins(); // Refresh list
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to revoke admin');
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-900 mx-auto"></div>
          <p className="mt-4 text-zinc-600 font-secondary">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <div className="bg-emerald-900 border-b border-emerald-950 px-4 md:px-8 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <div className="cursor-pointer inline-block" onClick={() => navigate('/')}>
            <h1 className="text-xl md:text-2xl font-bold font-primary text-white tracking-tight">Emmanuel Supermarket - Admin</h1>
            <p className="text-sm text-emerald-100 font-secondary mt-0.5">Online Grocery Shopping</p>
          </div>
        </div>
      </div>

      <div className="py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <Button
            data-testid="back-btn"
            onClick={() => navigate('/')}
            variant="ghost"
            className="font-secondary"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Billing
          </Button>
          <div className="text-center">
            <h1 className="text-3xl font-bold font-primary text-emerald-950 tracking-tight">Admin Dashboard</h1>
            <p className="text-sm text-zinc-500 font-secondary mt-1">All orders from all users</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              onClick={handleOpenAdminsModal}
              variant="outline"
              className="bg-white hover:bg-zinc-50 text-emerald-900 border-emerald-200 font-secondary"
            >
              <ShieldCheck className="mr-2 h-4 w-4" /> Manage Admins
            </Button>
            <Button
              onClick={() => navigate('/admin/categories')}
              variant="outline"
              className="bg-white hover:bg-zinc-50 text-emerald-900 border-emerald-200 font-secondary"
            >
              Manage Categories
            </Button>
            <Button
              onClick={() => navigate('/admin/items')}
              className="bg-emerald-900 hover:bg-emerald-950 font-secondary"
            >
              Manage Items
            </Button>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center">
            <Package className="h-16 w-16 text-zinc-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold font-primary text-zinc-900 mb-2">No orders yet</h2>
            <p className="text-zinc-500 font-secondary">Orders will appear here once customers start placing them</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.order_id} className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-zinc-100 bg-zinc-50/50">
                  <div className="grid md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 font-primary mb-1">Order ID</p>
                      <p className="font-mono text-sm text-emerald-900 font-medium">{order.order_id}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 font-primary mb-1">Status</p>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium font-secondary ${
                        order.status === 'Order Confirmed' 
                          ? 'bg-emerald-100 text-emerald-900' 
                          : 'bg-amber-100 text-amber-900'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 font-primary mb-1">Date</p>
                      <p className="font-secondary text-sm text-zinc-700">
                        {new Date(order.created_at).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 font-primary mb-1">Total</p>
                      <p className="text-2xl font-mono font-bold text-emerald-950 tracking-tighter">₹{order.grand_total.toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  {/* Customer Details */}
                  <div className="mb-6 pb-6 border-b border-zinc-100">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400 font-primary mb-3">Customer Details</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="flex items-start space-x-3">
                        <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4 text-emerald-900" />
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500 font-secondary">Name</p>
                          <p className="font-secondary text-sm text-zinc-900 font-medium">{order.user_name}</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3">
                        <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <Mail className="h-4 w-4 text-emerald-900" />
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500 font-secondary">Email</p>
                          <p className="font-secondary text-sm text-zinc-900 font-medium">{order.user_email}</p>
                        </div>
                      </div>
                      {order.user_phone && (
                        <div className="flex items-start space-x-3">
                          <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <Phone className="h-4 w-4 text-emerald-900" />
                          </div>
                          <div>
                            <p className="text-xs text-zinc-500 font-secondary">Phone</p>
                            <p className="font-secondary text-sm text-zinc-900 font-medium">{order.user_phone}</p>
                          </div>
                        </div>
                      )}
                      {order.user_address && (
                        <div className="flex items-start space-x-3">
                          <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <MapPin className="h-4 w-4 text-emerald-900" />
                          </div>
                          <div>
                            <p className="text-xs text-zinc-500 font-secondary">Delivery Address</p>
                            <p className="font-secondary text-sm text-zinc-900 font-medium">{order.user_address}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="mb-4">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400 font-primary mb-3">Order Items</h3>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-zinc-100">
                          <th className="pb-2 text-left text-xs font-bold uppercase tracking-wider text-zinc-400 font-primary">Item</th>
                          <th className="pb-2 text-right text-xs font-bold uppercase tracking-wider text-zinc-400 font-primary">Rate</th>
                          <th className="pb-2 text-right text-xs font-bold uppercase tracking-wider text-zinc-400 font-primary">Qty</th>
                          <th className="pb-2 text-right text-xs font-bold uppercase tracking-wider text-zinc-400 font-primary">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((item, idx) => (
                          <tr key={idx} className="border-b border-zinc-50">
                            <td className="py-2 font-secondary text-sm text-zinc-700">{item.item_name}</td>
                            <td className="py-2 text-right font-mono text-sm text-emerald-700">₹{item.rate.toFixed(2)}</td>
                            <td className="py-2 text-right font-mono text-sm text-zinc-700">{item.quantity}</td>
                            <td className="py-2 text-right font-mono text-sm font-medium text-emerald-900">₹{item.total.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end gap-2">
                    {order.status === 'Pending' && (
                      <Button
                        onClick={() => handleConfirmOrder(order.order_id)}
                        className="bg-emerald-900 hover:bg-emerald-950 text-white font-secondary"
                      >
                        Confirm Order
                      </Button>
                    )}
                    <Button
                      onClick={() => setDeleteOrderId(order.order_id)}
                      variant="outline"
                      className="text-rose-600 border-rose-300 hover:bg-rose-50 font-secondary"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete Order
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>

      {/* MANAGE ADMINS MODAL */}
      <Dialog open={showAdminsModal} onOpenChange={setShowAdminsModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold font-primary text-emerald-950 flex items-center">
              <ShieldCheck className="mr-2 h-6 w-6 text-emerald-700" /> Manage Admins
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-2">
            {/* Add New Admin Section */}
            <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200">
              <Label htmlFor="adminEmail" className="text-sm font-primary font-bold text-zinc-700 block mb-2">
                Promote User to Admin
              </Label>
              <div className="flex gap-2">
                <Input
                  id="adminEmail"
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="font-secondary bg-white"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddAdmin()}
                />
                <Button onClick={handleAddAdmin} className="bg-emerald-900 hover:bg-emerald-950 font-secondary">
                  Add
                </Button>
              </div>
              <p className="text-xs text-zinc-500 font-secondary mt-2">
                *The user must have logged in to the app at least once before you can make them an admin.
              </p>
            </div>

            {/* List Admins Section */}
            <div>
              <Label className="text-sm font-primary font-bold text-zinc-500 uppercase tracking-wider mb-3 block">
                Current Admins
              </Label>
              {adminsLoading ? (
                 <div className="flex justify-center py-4"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-900"></div></div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {adminsList.map((admin) => (
                    <div key={admin.user_id} className="flex items-center justify-between p-3 bg-white border border-zinc-200 rounded-lg">
                      <div className="min-w-0">
                        <p className="font-primary font-bold text-zinc-900 truncate text-sm">
                          {admin.name || "Unknown"}
                          {admin.email === "isaac.babu.personal@gmail.com" && (
                             <span className="ml-2 inline-block px-2 py-0.5 text-[10px] uppercase font-bold bg-emerald-100 text-emerald-800 rounded font-secondary">Super Admin</span>
                          )}
                        </p>
                        <p className="text-xs text-zinc-500 font-secondary truncate">{admin.email}</p>
                      </div>
                      
                      {/* Cannot delete the super admin or yourself */}
                      {admin.email !== "isaac.babu.personal@gmail.com" && admin.user_id !== user?.user_id && (
                        <button 
                          onClick={() => handleRevokeAdmin(admin.user_id)}
                          className="text-zinc-400 hover:text-rose-600 p-2 transition-colors flex-shrink-0"
                          title="Revoke Admin Access"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteOrderId} onOpenChange={() => setDeleteOrderId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this order? This action cannot be undone and will remove the order from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDelete(deleteOrderId)} className="bg-rose-600 hover:bg-rose-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminDashboard;