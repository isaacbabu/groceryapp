import React from 'react';
import Layout from '@/components/Layout';

const ShippingPolicy = ({ user }) => {
  return (
    <Layout user={user}>
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold font-primary text-emerald-950 mb-8 border-b border-zinc-200 pb-4">Shipping Policy</h1>
        
        <div className="space-y-4 font-secondary text-zinc-700 leading-relaxed">
          <p>The orders for the user are shipped through registered domestic courier companies and/or speed post only.</p>
          
          <p>Orders are shipped and delivered within 2 days from the date of the order and/or payment or as per the delivery date agreed at the time of order confirmation and delivering of the shipment, subject to courier company / post office norms.</p>
          
          <p>Platform Owner shall not be liable for any delay in delivery by the courier company / postal authority.</p>
          
          <p>Delivery of all orders will be made to the address provided by the buyer at the time of purchase. Delivery of our services will be confirmed on your email ID as specified at the time of registration.</p>
          
          <p>If there are any shipping cost(s) levied by the seller or the Platform Owner (as the case be), the same is not refundable.</p>
        </div>
      </div>
    </Layout>
  );
};

export default ShippingPolicy;