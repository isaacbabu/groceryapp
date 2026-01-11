import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { axiosInstance } from '@/App';
import { ArrowLeft, Package, User, MapPin, Phone, Mail, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
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
    <div className="min-h-screen bg-zinc-50 py-8 px-4">
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
          <Button
            data-testid="manage-items-btn"
            onClick={() => navigate('/admin/items')}
            className="bg-emerald-900 hover:bg-emerald-950 font-secondary"
          >
            Manage Items
          </Button>
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
              <div key={order.order_id} data-testid={`admin-order-${order.order_id}`} className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
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

                  <div className="flex justify-end">
                    <Button
                      data-testid={`admin-delete-order-btn-${order.order_id}`}
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