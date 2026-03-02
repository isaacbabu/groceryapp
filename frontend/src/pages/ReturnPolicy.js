import React from 'react';
import Layout from '@/components/Layout';

const ReturnPolicy = ({ user }) => {
  return (
    <Layout user={user}>
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold font-primary text-emerald-950 mb-8 border-b border-zinc-200 pb-4">Return Policy</h1>
        
        <div className="space-y-4 font-secondary text-zinc-700 leading-relaxed">
          <p>We offer refund / exchange within first 3 days from the date of your purchase. If 3 days have passed since your purchase, you will not be offered a return, exchange or refund of any kind.</p>
          
          <p>In order to become eligible for a return or an exchange:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>The purchased item should be unused and in the same condition as you received it.</li>
            <li>The item must have original packaging.</li>
            <li>If the item that you purchased on a sale, then the item may not be eligible for a return / exchange.</li>
          </ul>
          
          <p>Further, only such items are replaced by us (based on an exchange request), if such items are found defective or damaged.</p>
          
          <p>You agree that there may be a certain category of products / items that are exempted from returns or refunds. Such categories of the products would be identified to you at the item of purchase.</p>
          
          <p>For exchange / return accepted request(s) (as applicable), once your returned product / item is received and inspected by us, we will send you an email to notify you about receipt of the returned / exchanged product.</p>
          <p>The exchanged product will be delivered within 10 -15 days</p>
          
          <p>Further, if the same has been approved after the quality check at our end, your request (i.e. return / exchange) will be processed in accordance with our policies.</p>
        </div>
      </div>
    </Layout>
  );
};

export default ReturnPolicy;