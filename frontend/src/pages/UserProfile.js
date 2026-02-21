import React, { useState, useEffect } from 'react';
import { axiosInstance } from '@/App';
import { User, Phone, MapPin, Map, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import Layout from '@/components/Layout';

const UserProfile = ({ user: initialUser }) => {
  const [user, setUser] = useState(initialUser);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [geolocation, setGeolocation] = useState(''); // New state for precise GPS
  const [loading, setLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    if (user) {
      setPhoneNumber(user.phone_number || '');
      setHomeAddress(user.home_address || '');
      setGeolocation(user.geolocation || '');
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
        geolocation: geolocation, // Send the GPS data to backend
      });
      setUser(response.data);
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setIsLocating(true);
    toast.info('Capturing precise GPS coordinates...', { duration: 2000 });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        // Save exact coordinates to our new field
        setGeolocation(`${latitude}, ${longitude}`);
        toast.success('GPS coordinates captured!');
        setIsLocating(false);
      },
      (error) => {
        setIsLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error('Location permission was denied. Please allow access.');
            break;
          case error.POSITION_UNAVAILABLE:
            toast.error('Location information is currently unavailable.');
            break;
          case error.TIMEOUT:
            toast.error('The request to get your location timed out.');
            break;
          default:
            toast.error('An unknown error occurred.');
            break;
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <Layout user={user} setUser={setUser}>
      <div className="py-8 px-4 max-w-2xl mx-auto">
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-emerald-900 p-8 text-center">
            {user?.picture ? (
              <img src={user.picture} alt={user.name} className="w-24 h-24 rounded-full mx-auto border-4 border-white shadow-lg" />
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
              <Label htmlFor="phone" className="text-sm font-primary font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center">
                <Phone className="h-4 w-4 mr-2" /> Phone Number *
              </Label>
              <Input id="phone" type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="Enter your phone number" className="font-secondary"/>
            </div>

            {/* Manual Address Input */}
            <div>
              <Label htmlFor="address" className="text-sm font-primary font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center">
                <MapPin className="h-4 w-4 mr-2" /> Manual Delivery Address *
              </Label>
              <Input 
                id="address" 
                value={homeAddress} 
                onChange={(e) => setHomeAddress(e.target.value)} 
                placeholder="Enter your house no, street, city..." 
                className="font-secondary"
              />
            </div>

            {/* Hidden/Automated Geolocation Input */}
            <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-primary font-bold text-zinc-500 uppercase tracking-wider flex items-center mb-0">
                  <Map className="h-4 w-4 mr-2" /> Precise GPS Location
                </Label>
                
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={handleGetLocation} 
                  disabled={isLocating}
                  className="h-8 text-xs font-secondary text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                >
                  {isLocating ? (
                    <><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-emerald-700 mr-1.5"></div> Capturing...</>
                  ) : (
                    <><Navigation className="h-3 w-3 mr-1.5" /> Capture GPS</>
                  )}
                </Button>
              </div>
              
              <Input 
                value={geolocation || 'No GPS coordinates captured yet'} 
                readOnly 
                className={`font-mono text-sm ${geolocation ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-zinc-400 bg-zinc-100'}`}
              />
              <p className="text-xs text-zinc-500 mt-2 font-secondary">
                Capturing your exact coordinates helps our delivery drivers locate your home accurately.
              </p>
            </div>

            <Button onClick={handleUpdate} disabled={loading} className="w-full bg-emerald-900 hover:bg-emerald-950 text-white h-12 text-base font-primary font-medium mt-4">
              {loading ? 'Updating...' : 'Update Profile'}
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default UserProfile;