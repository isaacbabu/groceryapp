import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { axiosInstance } from '@/App';
import { ArrowLeft, Plus, Trash2, Tag, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

const AdminCategories = ({ user }) => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [deleteCategoryId, setDeleteCategoryId] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user?.is_admin) {
      toast.error('Admin access required');
      navigate('/');
      return;
    }
    fetchCategories();
  }, [user, navigate]);

  const fetchCategories = async () => {
    try {
      const response = await axiosInstance.get('/admin/categories');
      setCategories(response.data);
    } catch (error) {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!newCategoryName.trim()) {
      toast.error('Category name is required');
      return;
    }

    setSubmitting(true);
    try {
      const response = await axiosInstance.post('/admin/categories', { name: newCategoryName.trim() });
      setCategories([...categories, response.data].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success('Category added successfully');
      setShowModal(false);
      setNewCategoryName('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add category');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (categoryId) => {
    try {
      await axiosInstance.delete(`/admin/categories/${categoryId}`);
      setCategories(categories.filter(cat => cat.category_id !== categoryId));
      toast.success('Category deleted successfully');
      setDeleteCategoryId(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete category');
      setDeleteCategoryId(null);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setNewCategoryName('');
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-900 mx-auto"></div>
          <p className="mt-4 text-zinc-600 font-secondary">Loading categories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <div className="bg-emerald-900 border-b border-emerald-950 px-4 md:px-8 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl md:text-2xl font-bold font-primary text-white tracking-tight">Emmanuel Supermarket - Admin</h1>
          <p className="text-sm text-emerald-100 font-secondary mt-0.5">Online Grocery Shopping</p>
        </div>
      </div>

      <div className="py-8 px-4">
        <div className="max-w-4xl mx-auto">
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
              <h1 className="text-3xl font-bold font-primary text-emerald-950 tracking-tight">Manage Categories</h1>
              <p className="text-sm text-zinc-500 font-secondary mt-1">Add or remove product categories</p>
            </div>
            <Button
              data-testid="add-category-btn"
              onClick={() => setShowModal(true)}
              className="bg-lime-400 hover:bg-lime-500 text-lime-950 font-secondary font-bold"
            >
              <Plus className="mr-2 h-4 w-4" /> Add Category
            </Button>
          </div>

          {categories.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center">
              <Tag className="h-16 w-16 text-zinc-300 mx-auto mb-4" />
              <h2 className="text-xl font-bold font-primary text-zinc-900 mb-2">No categories yet</h2>
              <p className="text-zinc-500 font-secondary mb-4">Add your first category to get started</p>
              <Button
                onClick={() => setShowModal(true)}
                className="bg-emerald-900 hover:bg-emerald-950 font-secondary"
              >
                <Plus className="mr-2 h-4 w-4" /> Add Category
              </Button>
            </div>
          ) : (
            <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 bg-zinc-50 border-b border-zinc-200">
                <h3 className="font-primary font-bold text-zinc-700">All Categories ({categories.length})</h3>
              </div>
              <div className="divide-y divide-zinc-100">
                {categories.map((category) => (
                  <div 
                    key={category.category_id} 
                    data-testid={`category-row-${category.category_id}`}
                    className="flex items-center justify-between p-4 hover:bg-zinc-50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        category.is_default ? 'bg-emerald-100' : 'bg-lime-100'
                      }`}>
                        <Tag className={`h-5 w-5 ${category.is_default ? 'text-emerald-700' : 'text-lime-700'}`} />
                      </div>
                      <div>
                        <p className="font-primary font-bold text-zinc-900">{category.name}</p>
                        <p className="text-xs text-zinc-500 font-secondary">
                          {category.is_default ? (
                            <span className="inline-flex items-center text-emerald-600">
                              <Lock className="h-3 w-3 mr-1" /> Default Category
                            </span>
                          ) : (
                            'Custom Category'
                          )}
                        </p>
                      </div>
                    </div>
                    {!category.is_default && (
                      <Button
                        data-testid={`delete-category-btn-${category.category_id}`}
                        onClick={() => setDeleteCategoryId(category.category_id)}
                        variant="outline"
                        size="sm"
                        className="text-rose-600 border-rose-300 hover:bg-rose-50 font-secondary"
                      >
                        <Trash2 className="mr-1 h-4 w-4" /> Delete
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Category Modal */}
      <Dialog open={showModal} onOpenChange={handleCloseModal}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold font-primary text-emerald-950">
              Add New Category
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="categoryName" className="text-sm font-primary font-bold text-zinc-500 uppercase tracking-wider mb-2 block">
                Category Name *
              </Label>
              <Input
                id="categoryName"
                data-testid="category-name-input"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g., Beverages"
                className="font-secondary"
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                data-testid="cancel-category-btn"
                variant="outline"
                onClick={handleCloseModal}
                className="flex-1 font-secondary"
              >
                Cancel
              </Button>
              <Button
                data-testid="save-category-btn"
                onClick={handleSubmit}
                disabled={submitting || !newCategoryName.trim()}
                className="flex-1 bg-emerald-900 hover:bg-emerald-950 font-secondary"
              >
                {submitting ? 'Adding...' : 'Add Category'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteCategoryId} onOpenChange={() => setDeleteCategoryId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-primary">Delete Category?</AlertDialogTitle>
            <AlertDialogDescription className="font-secondary">
              This action cannot be undone. This will permanently delete the category.
              Note: Categories with items cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-secondary">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDelete(deleteCategoryId)}
              className="bg-rose-600 hover:bg-rose-700 font-secondary"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminCategories;
