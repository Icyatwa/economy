// src/controllers/authController.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

exports.register = async (req, res) => {
  try {
    // Check registration token
    const { registrationToken } = req.body;
    
    if (!registrationToken || registrationToken !== process.env.ADMIN_REGISTRATION_TOKEN) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid registration token' 
      });
    }
    
    // Check if admin already exists
    const adminExists = await User.findOne({ role: 'admin' });

    if (adminExists) {
      return res.status(400).json({ 
        success: false,
        message: 'Registration closed. Admin already exists.' 
      });
    }

    // Validate input
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide name, email and password' 
      });
    }
    
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }

    // Create admin user
    const admin = await User.create({
      name,
      email,
      password,
      role: 'admin'
    });

    // Create token
    const token = generateToken(admin._id);

    res.status(201).json({
      success: true,
      message: 'Admin registered successfully',
      token,
      user: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle duplicate email error
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false,
        message: 'Email already in use' 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt for email:', email); // Removed password from log for security
    
    // Check if email and password exist
    if (!email || !password) {
      console.log('Missing credentials');
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // Find user with password
    const user = await User.findOne({ email }).select('+password');
    console.log('User found in database:', user ? 'Yes' : 'No');
    
    if (!user) {
      console.log('User not found for email:', email);
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    console.log('User exists, checking password...');
    const passwordMatch = await user.comparePassword(password);
    console.log('Password match result:', passwordMatch);

    if (!passwordMatch) {
      console.log('Password does not match');
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    console.log('User role:', user.role);
    // Check if user is admin
    if (user.role !== 'admin') {
      console.log('User is not admin');
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    // Create token
    const token = generateToken(user._id);
    console.log('Token generated successfully');

    res.status(200).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.createAdmin = async (req, res) => {
  try {
    // This is a setup endpoint - you should comment it out after creating the initial admin
    const adminExists = await User.findOne({ role: 'admin' });
    if (adminExists) {
      return res.status(400).json({ message: 'Admin already exists' });
    }

    const admin = await User.create({
      email: 'admin@rwandaeconomicpulse.com',
      password: 'lolopNews0788',
      name: 'Site Administrator',
      role: 'admin'
    });

    res.status(201).json({ message: 'Admin created successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};