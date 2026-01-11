import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { axiosInstance } from '@/App';
import { ArrowLeft, Plus, Edit, Trash2, Upload, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

const AdminItems = ({ user }) => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteItemId, setDeleteItemId] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    rate: '',
    image_url: '',
    category: 'Vegetables'
  });
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (!user?.is_admin) {
      toast.error('Admin access required');
      navigate('/');
      return;
    }
    fetchItems();
  }, [user, navigate]);

  const fetchItems = async () => {
    try {
      const response = await axiosInstance.get('/items');
      setItems(response.data);
    } catch (error) {
      toast.error('Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      e.target.value = '';
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      e.target.value = '';
      return;
    }

    setUploadingImage(true);
    const reader = new FileReader();
    
    reader.onloadend = () => {
      setFormData({ ...formData, image_url: reader.result });
      setUploadingImage(false);
      toast.success('Image uploaded successfully');
    };
    
    reader.onerror = () => {
      toast.error('Failed to upload image');
      setUploadingImage(false);
    };
    
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.rate || !formData.image_url) {
      toast.error('All fields are required');
      return;
    }

    try {
      if (editingItem) {
        await axiosInstance.put(`/admin/items/${editingItem.item_id}`, formData);
        toast.success('Item updated successfully');
      } else {
        await axiosInstance.post('/admin/items', formData);
        toast.success('Item added successfully');
      }
      
      setShowModal(false);
      setEditingItem(null);
      setFormData({ name: '', rate: '', image_url: '', category: 'Vegetables' });
      fetchItems();
    } catch (error) {
      toast.error(editingItem ? 'Failed to update item' : 'Failed to add item');
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      rate: item.rate.toString(),
      image_url: item.image_url,
      category: item.category
    });
    setShowModal(true);
  };

  const handleDelete = async (itemId) => {
    try {
      await axiosInstance.delete(`/admin/items/${itemId}`);
      setItems(items.filter(item => item.item_id !== itemId));
      toast.success('Item deleted successfully');
      setDeleteItemId(null);
    } catch (error) {
      toast.error('Failed to delete item');
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setFormData({ name: '', rate: '', image_url: '', category: 'Vegetables' });
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-900 mx-auto"></div>
          <p className="mt-4 text-zinc-600 font-secondary">Loading items...</p>
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
            onClick={() => navigate('/admin')}
            variant="ghost"
            className="font-secondary"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Button>
          <div className="text-center">
            <h1 className="text-3xl font-bold font-primary text-emerald-950 tracking-tight">Manage Items</h1>
            <p className="text-sm text-zinc-500 font-secondary mt-1">Add, edit, or remove grocery items</p>
          </div>
          <Button
            data-testid="add-item-btn"
            onClick={() => setShowModal(true)}
            className="bg-lime-400 hover:bg-lime-500 text-lime-950 font-secondary font-bold"
          >
            <Plus className="mr-2 h-4 w-4" /> Add Item
          </Button>
        </div>

        {items.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center">
            <Package className="h-16 w-16 text-zinc-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold font-primary text-zinc-900 mb-2">No items yet</h2>
            <p className="text-zinc-500 font-secondary mb-4">Add your first item to get started</p>
            <Button
              onClick={() => setShowModal(true)}
              className="bg-emerald-900 hover:bg-emerald-950 font-secondary"
            >
              <Plus className="mr-2 h-4 w-4" /> Add Item
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
            {items.map((item) => (
              <div key={item.item_id} data-testid={`item-card-${item.item_id}`} className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden group hover:shadow-lg transition-all">
                <div className="aspect-[4/3] w-full overflow-hidden bg-zinc-100">
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="p-4">
                  <div className="mb-2">
                    <span className="inline-block px-2 py-1 text-xs font-medium bg-zinc-100 text-zinc-700 rounded font-secondary">
                      {item.category}
                    </span>
                  </div>
                  <h3 className="font-primary font-bold text-zinc-900 mb-1">{item.name}</h3>
                  <p className="font-mono text-emerald-700 font-medium text-lg">₹{item.rate.toFixed(2)}</p>
                  
                  <div className="mt-4 flex gap-2">
                    <Button
                      data-testid={`edit-item-btn-${item.item_id}`}
                      onClick={() => handleEdit(item)}
                      variant="outline"
                      size="sm"
                      className="flex-1 font-secondary"
                    >
                      <Edit className="mr-1 h-3 w-3" /> Edit
                    </Button>
                    <Button
                      data-testid={`delete-item-btn-${item.item_id}`}
                      onClick={() => setDeleteItemId(item.item_id)}
                      variant="outline"
                      size="sm"
                      className="flex-1 text-rose-600 border-rose-300 hover:bg-rose-50 font-secondary"
                    >
                      <Trash2 className="mr-1 h-3 w-3" /> Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Item Modal */}
      <Dialog open={showModal} onOpenChange={handleCloseModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold font-primary text-emerald-950">
              {editingItem ? 'Edit Item' : 'Add New Item'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="name" className="text-sm font-primary font-bold text-zinc-500 uppercase tracking-wider mb-2 block">
                Item Name *
              </Label>
              <Input
                id="name"
                data-testid="item-name-input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Tomato"
                className="font-secondary"
              />
            </div>

            <div>
              <Label htmlFor="rate" className="text-sm font-primary font-bold text-zinc-500 uppercase tracking-wider mb-2 block">
                Rate (₹) *
              </Label>
              <Input
                id="rate"
                data-testid="item-rate-input"
                type="number"
                step="0.01"
                value={formData.rate}
                onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                placeholder="e.g., 50.00"
                className="font-mono"
              />
            </div>

            <div>
              <Label htmlFor="category" className="text-sm font-primary font-bold text-zinc-500 uppercase tracking-wider mb-2 block">
                Category *
              </Label>
              <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                <SelectTrigger data-testid="item-category-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Vegetables">Vegetables</SelectItem>
                  <SelectItem value="Fruits">Fruits</SelectItem>
                  <SelectItem value="Dairy">Dairy</SelectItem>
                  <SelectItem value="Grains">Grains</SelectItem>
                  <SelectItem value="Beverages">Beverages</SelectItem>
                  <SelectItem value="Snacks">Snacks</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="image" className="text-sm font-primary font-bold text-zinc-500 uppercase tracking-wider mb-2 block">
                Image URL *
              </Label>
              <Input
                id="image"
                data-testid="item-image-input"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                placeholder="https://example.com/image.jpg"
                className="font-secondary"
              />
              {formData.image_url && (
                <div className="mt-2">
                  <img
                    src={formData.image_url}
                    alt="Preview"
                    className="w-32 h-32 object-cover rounded-lg border border-zinc-200"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      toast.error('Invalid image URL');
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              data-testid="cancel-item-btn"
              onClick={handleCloseModal}
              variant="outline"
              className="flex-1 font-secondary"
            >
              Cancel
            </Button>
            <Button
              data-testid="submit-item-btn"
              onClick={handleSubmit}
              className="flex-1 bg-emerald-900 hover:bg-emerald-950 font-secondary"
            >
              {editingItem ? 'Update Item' : 'Add Item'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteItemId} onOpenChange={() => setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this item? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDelete(deleteItemId)} className="bg-rose-600 hover:bg-rose-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminItems;