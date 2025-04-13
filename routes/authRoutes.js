// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { register, login, createAdmin } = require('../controllers/authController');
const User = require('../models/User');

router.post('/register', register);
router.post('/login', login);
router.post('/create-admin', createAdmin); // Use once to create initial admin
router.get('/setup-admin', async (req, res) => {
    try {
        // Check if admin already exists
        const adminExists = await User.findOne({ email: 'admin@rwandaeconomicpulse.com' });
        if (adminExists) {
        return res.json({ message: 'Admin already exists', email: adminExists.email });
        }

        // Create admin user
        const admin = await User.create({
        email: 'admin@rwandaeconomicpulse.com',
        password: 'lolopNews0788',
        name: 'Site Administrator',
        role: 'admin'
        });

        res.json({ 
        message: 'Admin created successfully', 
        email: admin.email,
        role: admin.role 
        });
    } catch (error) {
        console.error('Error creating admin:', error);
        res.status(500).json({ 
        message: 'Error creating admin', 
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

router.get('/test-admin', async (req, res) => {
  try {
    const admin = await User.findOne({ role: 'admin' });
    if (admin) {
      res.json({ 
        message: 'Admin user found',
        email: admin.email,
        name: admin.name,
        role: admin.role
      });
    } else {
      res.json({ message: 'No admin user found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Test password verification
router.post('/test-password', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.json({ message: 'User not found' });
    }
    
    const passwordMatch = await user.comparePassword(password);
    res.json({ 
      userFound: true,
      passwordMatch,
      userRole: user.role
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;