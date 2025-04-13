// backend/createAdmin.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Connect to MongoDB directly
mongoose.connect('mongodb+srv://icyatwandoba:X0V4dU7MOGX1falJ@cluster0.2plh1.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0')
  .then(async () => {
    console.log('Connected to MongoDB');

    // Create admin
    const hashedPassword = await bcrypt.hash('lolopNews0788', 12);
    
    const admin = await mongoose.connection.db.collection('users').insertOne({
      email: 'admin@rwandaeconomicpulse.com',
      password: hashedPassword,
      name: 'Site Administrator',
      role: 'admin',
      createdAt: new Date()
    });

    console.log('Admin created successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });