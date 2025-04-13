// backend/scripts/initAdmin.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../src/models/User');

dotenv.config();

const initAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const adminExists = await User.findOne({ role: 'admin' });
    if (adminExists) {
      console.log('Admin already exists:', adminExists.email);
      process.exit(0);
    }

    // Create admin user
    const admin = await User.create({
      email: 'admin@rwandaeconomicpulse.com',
      password: 'lolopNews0788',
      name: 'Site Administrator',
      role: 'admin'
    });

    console.log('Admin created successfully:', admin.email);
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin:', error);
    process.exit(1);
  }
};

initAdmin();