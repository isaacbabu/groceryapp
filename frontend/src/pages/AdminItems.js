import React, { useState, useEffect, useCallback } from 'react';
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
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteItemId, setDeleteItemId] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    rate: '',
    image_url: '',
    category: '',
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [useCdnUrl, setUseCdnUrl] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await axiosInstance.get('/categories');
      // Filter out "All" from categories for item creation
      const cats = response.data.filter((cat) => cat !== 'All');
      setCategories(cats);

      // Set default category if not set
      setFormData((prev) => {
        if (!prev.category && cats.length > 0) {
          return { ...prev, category: cats[0] };
        }
        return prev;
      });
    } catch (error) {
      console.error('Failed to load categories');
    }
  }, []);

  const fetchItems = useCallback(async () => {
    try {
      const response = await axiosInstance.get('/items');
      setItems(response.data);
    } catch (error) {
      toast.error('Failed to load items');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user?.is_admin) {
      toast.error('Admin access required');
      navigate('/');
      return;
    }
    fetchItems();
    fetchCategories();
  }, [user?.is_admin, navigate, fetchItems, fetchCategories]);

  const handleImageUpload = (e) => {
    if (useCdnUrl) return;

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
    // Validate all required fields
    const missingFields = [];
    if (!formData.name) missingFields.push('Item Name');
    if (!formData.rate) missingFields.push('Rate');
    if (!formData.image_url) missingFields.push('Image');
    if (!formData.category) missingFields.push('Category');

    if (missingFields.length > 0) {
      toast.error(`Please fill in: ${missingFields.join(', ')}`);
      console.error('Missing fields:', {
        name: !!formData.name,
        rate: !!formData.rate,
        image_url: !!formData.image_url,
        category: !!formData.category,
        categoryValue: formData.category,
      });
      return;
    }

    // Prepare payload with proper types
    const payload = {
      name: formData.name.trim(),
      rate: parseFloat(formData.rate),
      image_url: formData.image_url,
      category: formData.category,
    };

    console.log('Submitting item payload:', payload);

    try {
      if (editingItem) {
        await axiosInstance.put(`/admin/items/${editingItem.item_id}`, payload);
        toast.success('Item updated successfully');
      } else {
        await axiosInstance.post('/admin/items', payload);
        toast.success('Item added successfully');
      }

      setShowModal(false);
      setEditingItem(null);
      setUseCdnUrl(false);
      setFormData({ name: '', rate: '', image_url: '', category: categories[0] || '' });
      fetchItems();
    } catch (error) {
      console.error('Failed to add/update item:', error.response?.data || error.message);
      const errorDetail = error.response?.data?.detail;
      if (Array.isArray(errorDetail) && errorDetail.length > 0) {
        toast.error(`Validation error: ${errorDetail[0].msg}`);
      } else {
        toast.error(editingItem ? 'Failed to update item' : 'Failed to add item');
      }
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setUseCdnUrl(true);
    setFormData({
      name: item.name,
      rate: item.rate.toString(),
      image_url: item.image_url,
      category: item.category,
    });
    setShowModal(true);
  };

  const handleDelete = async (itemId) => {
    try {
      await axiosInstance.delete(`/admin/items/${itemId}`);
      setItems(items.filter((item) => item.item_id !== itemId));
      toast.success('Item deleted successfully');
      setDeleteItemId(null);
    } catch (error) {
      toast.error('Failed to delete item');
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setUseCdnUrl(false);
    setFormData({ name: '', rate: '', image_url: '', category: categories[0] || '' });
  };

  const handleOpenAddModal = () => {
    if (categories.length === 0) {
      toast.error('Please wait for categories to load');
      return;
    }
    setEditingItem(null);
    setUseCdnUrl(false);
    setFormData({ name: '', rate: '', image_url: '', category: categories[0] });
    setShowModal(true);
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
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <div className="bg-emerald-900 border-b border-emerald-950 px-4 md:px-8 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <div className="cursor-pointer inline-block" onClick={() => navigate('/')}>
            <h1 className="text-xl md:text-2xl font-bold font-primary text-white tracking-tight">
              Emmanuel Supermarket - Admin
            </h1>
            <p className="text-sm text-emerald-100 font-secondary mt-0.5">Online Grocery Shopping</p>
          </div>
        </div>
      </div>

      <div className="py-8 px-4">
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
              onClick={handleOpenAddModal}
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
              <Button onClick={handleOpenAddModal} className="bg-emerald-900 hover:bg-emerald-950 font-secondary">
                <Plus className="mr-2 h-4 w-4" /> Add Item
              </Button>
            </div>
          ) : (
            <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
              <div className="divide-y divide-zinc-100">
                {items.map((item) => (
                  <div
                    key={item.item_id}
                    data-testid={`item-card-${item.item_id}`}
                    className="flex items-center gap-4 p-4 hover:bg-zinc-50 transition-colors"
                  >
                    {/* Item Image */}
                    <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-zinc-100">
                      <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                    </div>

                    {/* Item Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-primary font-bold text-zinc-900 truncate">{item.name}</h3>
                        <span className="inline-block px-2 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-600 rounded font-secondary flex-shrink-0">
                          {item.category}
                        </span>
                      </div>
                      <p className="font-mono text-emerald-700 font-medium">₹{item.rate.toFixed(2)}</p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        data-testid={`edit-item-btn-${item.item_id}`}
                        onClick={() => handleEdit(item)}
                        variant="outline"
                        size="sm"
                        className="font-secondary"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        data-testid={`delete-item-btn-${item.item_id}`}
                        onClick={() => setDeleteItemId(item.item_id)}
                        variant="outline"
                        size="sm"
                        className="text-rose-600 border-rose-300 hover:bg-rose-50 font-secondary"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
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
              <Label
                htmlFor="name"
                className="text-sm font-primary font-bold text-zinc-500 uppercase tracking-wider mb-2 block"
              >
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
              <Label
                htmlFor="rate"
                className="text-sm font-primary font-bold text-zinc-500 uppercase tracking-wider mb-2 block"
              >
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
              <Label
                htmlFor="category"
                className="text-sm font-primary font-bold text-zinc-500 uppercase tracking-wider mb-2 block"
              >
                Category *
              </Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger data-testid="item-category-select">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label
                  htmlFor="image"
                  className="text-sm font-primary font-bold text-zinc-500 uppercase tracking-wider"
                >
                  <Upload className="h-4 w-4 inline mr-1" /> Image *
                </Label>
                <div className="flex items-center gap-1 text-xs font-secondary bg-zinc-100 rounded-full p-1">
                  <button
                    type="button"
                    className={`px-2 py-0.5 rounded-full ${
                      !useCdnUrl ? 'bg-white shadow-sm text-emerald-900 font-semibold' : 'text-zinc-600'
                    }`}
                    onClick={() => setUseCdnUrl(false)}
                  >
                    Upload
                  </button>
                  <button
                    type="button"
                    className={`px-2 py-0.5 rounded-full ${
                      useCdnUrl ? 'bg-white shadow-sm text-emerald-900 font-semibold' : 'text-zinc-600'
                    }`}
                    onClick={() => setUseCdnUrl(true)}
                  >
                    CDN URL
                  </button>
                </div>
              </div>

              {!useCdnUrl ? (
                <>
                  <Input
                    id="image"
                    data-testid="item-image-input"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                    className="font-secondary"
                  />
                  <p className="text-[11px] text-zinc-500 mt-1">Max 5MB. Supported: images only.</p>
                </>
              ) : (
                <Input
                  id="image-url"
                  data-testid="item-image-url-input"
                  type="text"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="https://cdn.example.com/path/to/image.jpg"
                  className="font-secondary"
                />
              )}

              {uploadingImage && !useCdnUrl && (
                <p className="text-sm text-zinc-500 mt-2">Uploading image...</p>
              )}
              {formData.image_url && !uploadingImage && (
                <div className="mt-2">
                  <img
                    src={formData.image_url}
                    alt="Preview"
                    className="w-32 h-32 object-cover rounded-lg border border-zinc-200"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      toast.error('Invalid image');
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
            <AlertDialogAction
              onClick={() => handleDelete(deleteItemId)}
              className="bg-rose-600 hover:bg-rose-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminItems;