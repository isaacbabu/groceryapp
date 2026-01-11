import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Info, ShoppingCart, Users, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';

const AboutPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-zinc-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Button
            data-testid="back-btn"
            onClick={() => navigate('/')}
            variant="ghost"
            className="font-secondary"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Billing
          </Button>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-emerald-900 p-8 text-center">
            <div className="w-16 h-16 bg-lime-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <Info className="h-8 w-8 text-lime-950" />
            </div>
            <h1 className="text-3xl font-bold font-primary text-white">About Grocery Billing</h1>
            <p className="text-emerald-100 font-secondary mt-2">Modern ledger for your grocery store</p>
          </div>

          <div className="p-8 space-y-8">
            <div>
              <h2 className="text-2xl font-bold font-primary text-emerald-950 mb-4">Welcome to Grocery Billing</h2>
              <p className="text-zinc-600 font-secondary leading-relaxed">
                A professional billing application designed specifically for grocery stores. Our platform combines 
                the precision of traditional accounting software with modern, user-friendly design.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center p-6 border border-zinc-200 rounded-xl">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <ShoppingCart className="h-6 w-6 text-emerald-900" />
                </div>
                <h3 className="font-primary font-bold text-emerald-950 mb-2">Quick Billing</h3>
                <p className="text-sm text-zinc-600 font-secondary">Create bills rapidly with our intuitive interface</p>
              </div>

              <div className="text-center p-6 border border-zinc-200 rounded-xl">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Users className="h-6 w-6 text-emerald-900" />
                </div>
                <h3 className="font-primary font-bold text-emerald-950 mb-2">User Management</h3>
                <p className="text-sm text-zinc-600 font-secondary">Manage customer profiles and delivery addresses</p>
              </div>

              <div className="text-center p-6 border border-zinc-200 rounded-xl">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Package className="h-6 w-6 text-emerald-900" />
                </div>
                <h3 className="font-primary font-bold text-emerald-950 mb-2">Order Tracking</h3>
                <p className="text-sm text-zinc-600 font-secondary">Track all orders with real-time status updates</p>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold font-primary text-emerald-950 mb-3">Key Features</h3>
              <ul className="space-y-2 text-zinc-600 font-secondary">
                <li className="flex items-start">
                  <span className="text-lime-400 mr-2">•</span>
                  <span>Automated bill calculation with real-time totals</span>
                </li>
                <li className="flex items-start">
                  <span className="text-lime-400 mr-2">•</span>
                  <span>Product catalog with images and pricing</span>
                </li>
                <li className="flex items-start">
                  <span className="text-lime-400 mr-2">•</span>
                  <span>Order history and management</span>
                </li>
                <li className="flex items-start">
                  <span className="text-lime-400 mr-2">•</span>
                  <span>Admin dashboard for inventory and order management</span>
                </li>
                <li className="flex items-start">
                  <span className="text-lime-400 mr-2">•</span>
                  <span>Secure Google authentication</span>
                </li>
              </ul>
            </div>

            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-6">
              <h3 className="text-lg font-bold font-primary text-emerald-950 mb-2">Version</h3>
              <p className="text-zinc-600 font-secondary">v1.0.0 - December 2025</p>
              <p className="text-sm text-zinc-500 font-secondary mt-2">
                Built with React, FastAPI, and MongoDB
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;