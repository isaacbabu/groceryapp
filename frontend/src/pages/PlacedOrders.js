import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { axiosInstance } from '@/App';
import { ArrowLeft, Trash2, Package, Pencil } from 'lucide-react';
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

const PlacedOrders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteOrderId, setDeleteOrderId] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await axiosInstance.get('/orders');
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

  const handleEditOrder = (order) => {
    // Navigate to billing page with order data for editing
    navigate('/', { 
      state: { 
        editOrder: {
          order_id: order.order_id,
          items: order.items
        }
      } 
    });
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
        <div className="max-w-6xl mx-auto">
          <h1 className="text-xl md:text-2xl font-bold font-primary text-white tracking-tight">Emmanuel Supermarket</h1>
          <p className="text-sm text-emerald-100 font-secondary mt-0.5">Online Grocery Shopping</p>
        </div>
      </div>

      <div className="py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <Button
            data-testid="back-btn"
            onClick={() => navigate('/')}
            variant="ghost"
            className="font-secondary"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Billing
          </Button>
          <div>
            <h1 className="text-3xl font-bold font-primary text-emerald-950 tracking-tight">Placed Orders</h1>
          </div>
          <div className="w-24"></div>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center">
            <Package className="h-16 w-16 text-zinc-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold font-primary text-zinc-900 mb-2">No orders yet</h2>
            <p className="text-zinc-500 font-secondary">Place your first order to see it here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.order_id} data-testid={`order-${order.order_id}`} className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 font-primary mb-1">Order ID</p>
                    <p className="font-mono text-sm text-emerald-900 font-medium">{order.order_id}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 font-primary mb-1">Status</p>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-900 font-secondary">
                      {order.status}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 font-primary mb-1">Date</p>
                    <p className="font-secondary text-sm text-zinc-700">
                      {new Date(order.created_at).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </p>
                  </div>
                </div>

                <div className="p-6">
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

                  <div className="mt-6 flex items-center justify-between">
                    <Button
                      data-testid={`delete-order-btn-${order.order_id}`}
                      onClick={() => setDeleteOrderId(order.order_id)}
                      variant="outline"
                      className="text-rose-600 border-rose-300 hover:bg-rose-50 font-secondary"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete Order
                    </Button>
                    <div className="text-right">
                      <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1 font-primary">Grand Total</p>
                      <p className="text-3xl font-mono font-bold text-emerald-950 tracking-tighter" data-testid={`order-total-${order.order_id}`}>₹{order.grand_total.toFixed(2)}</p>
                    </div>
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
              Are you sure you want to delete this order? This action cannot be undone.
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
    </div>
  );
};

export default PlacedOrders;