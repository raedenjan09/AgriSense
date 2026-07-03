const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: role || 'Farmer'
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profilePicture: user.profilePicture || '',
        token: generateToken(user._id)
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');

    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profilePicture: user.profilePicture || '',
        token: generateToken(user._id)
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Protect middleware to authenticate requests via JWT
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

// PUT: Update user profile
router.put('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      user.name = req.body.name || user.name;
      user.email = req.body.email || user.email;
      if (req.body.profilePicture !== undefined) {
        user.profilePicture = req.body.profilePicture;
      }

      const updatedUser = await user.save();

      res.json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        profilePicture: updatedUser.profilePicture || '',
        token: generateToken(updatedUser._id)
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error updating profile', error: error.message });
  }
});

// GET: Generate Cloudinary signature for signed uploads
router.get('/cloudinary-sign', protect, (req, res) => {
  try {
    const cloudinaryUrl = process.env.CLOUDINARY_URL;
    if (!cloudinaryUrl) {
      return res.status(500).json({ message: 'Cloudinary URL is not configured on the server' });
    }

    const match = cloudinaryUrl.match(/cloudinary:\/\/([^:]+):([^@]+)@(.+)/);
    if (!match) {
      return res.status(500).json({ message: 'Invalid Cloudinary configuration format' });
    }

    const apiKey = match[1];
    const apiSecret = match[2];
    const cloudName = match[3];

    const timestamp = Math.round(new Date().getTime() / 1000);
    
    // Cloudinary signature: SHA-1 hex hash of sorted parameters + API Secret
    // We only sign "timestamp", so parameters sorted: "timestamp=<value>"
    const crypto = require('crypto');
    const signatureStr = `timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(signatureStr).digest('hex');

    res.json({
      signature,
      timestamp,
      apiKey,
      cloudName
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating Cloudinary signature', error: error.message });
  }
});

// GET: Get all users (Admin/Extension Worker only)
router.get('/users', protect, async (req, res) => {
  try {
    if (req.user.role === 'Farmer') {
      return res.status(403).json({ message: 'Access denied. Administrators only.' });
    }
    const users = await User.find({}).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching users', error: error.message });
  }
});

// PUT: Update user role (Admin/Extension Worker only)
router.put('/users/:id/role', protect, async (req, res) => {
  try {
    if (req.user.role === 'Farmer') {
      return res.status(403).json({ message: 'Access denied. Administrators only.' });
    }
    const userToUpdate = await User.findById(req.params.id);
    if (!userToUpdate) {
      return res.status(404).json({ message: 'User not found' });
    }
    userToUpdate.role = req.body.role;
    await userToUpdate.save();
    res.json({ message: 'User role updated successfully', user: userToUpdate });
  } catch (error) {
    res.status(500).json({ message: 'Server error updating user role', error: error.message });
  }
});

module.exports = router;
