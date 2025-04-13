// backend/scripts/resetAdmin.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../src/models/User');

dotenv.config();

const resetAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Delete existing admin
    const deletedAdmin = await User.deleteOne({ email: 'admin@rwandaeconomicpulse.com' });
    console.log('Deleted existing admin:', deletedAdmin.deletedCount > 0);

    // Create new admin user
    const admin = await User.create({
      email: 'admin@rwandaeconomicpulse.com',
      password: 'lolopNews0788',
      name: 'Site Administrator',
      role: 'admin'
    });

    console.log('Admin created successfully:', admin.email);
    
    // Verify the admin was created properly
    const verifyAdmin = await User.findOne({ email: 'admin@rwandaeconomicpulse.com' });
    console.log('Admin verified:', verifyAdmin ? verifyAdmin.email : 'Not found');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

resetAdmin();