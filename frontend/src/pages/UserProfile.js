import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { axiosInstance } from '@/App';
import { ArrowLeft, User, Phone, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const UserProfile = ({ user: initialUser }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(initialUser);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setPhoneNumber(user.phone_number || '');
      setHomeAddress(user.home_address || '');
    }
  }, [user]);

  const handleUpdate = async () => {
    if (!phoneNumber || !homeAddress) {
      toast.error('Phone number and address are required');
      return;
    }

    setLoading(true);
    try {
      const response = await axiosInstance.put('/user/profile', {
        phone_number: phoneNumber,
        home_address: homeAddress,
      });
      setUser(response.data);
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <div className="bg-emerald-900 border-b border-emerald-950 px-4 md:px-8 py-4 shadow-lg">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl md:text-2xl font-bold font-primary text-white tracking-tight">Emmanuel Agencies</h1>
          <p className="text-sm text-emerald-100 font-secondary mt-0.5">Online Grocery Shopping</p>
        </div>
      </div>

      <div className="py-8 px-4">
      <div className="max-w-2xl mx-auto">
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
            {user?.picture ? (
              <img
                src={user.picture}
                alt={user.name}
                className="w-24 h-24 rounded-full mx-auto border-4 border-white shadow-lg"
              />
            ) : (
              <div className="w-24 h-24 rounded-full mx-auto border-4 border-white bg-lime-400 flex items-center justify-center">
                <User className="h-12 w-12 text-lime-950" />
              </div>
            )}
            <h1 className="text-2xl font-bold font-primary text-white mt-4">{user?.name}</h1>
            <p className="text-emerald-100 font-secondary text-sm mt-1">{user?.email}</p>
          </div>

          <div className="p-8 space-y-6">
            <div>
              <Label className="text-sm font-primary font-bold text-zinc-500 uppercase tracking-wider mb-2 block">
                User ID
              </Label>
              <Input
                data-testid="user-id-input"
                value={user?.user_id || ''}
                disabled
                className="bg-zinc-50 font-mono text-zinc-600"
              />
            </div>

            <div>
              <Label htmlFor="phone" className="text-sm font-primary font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center">
                <Phone className="h-4 w-4 mr-2" /> Phone Number *
              </Label>
              <Input
                id="phone"
                data-testid="phone-input"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Enter your phone number"
                className="font-secondary"
              />
            </div>

            <div>
              <Label htmlFor="address" className="text-sm font-primary font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center">
                <MapPin className="h-4 w-4 mr-2" /> Home Delivery Address *
              </Label>
              <Input
                id="address"
                data-testid="address-input"
                value={homeAddress}
                onChange={(e) => setHomeAddress(e.target.value)}
                placeholder="Enter your home address"
                className="font-secondary"
              />
            </div>

            <Button
              data-testid="update-profile-btn"
              onClick={handleUpdate}
              disabled={loading}
              className="w-full bg-emerald-900 hover:bg-emerald-950 text-white h-12 text-base font-primary font-medium"
            >
              {loading ? 'Updating...' : 'Update Profile'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;