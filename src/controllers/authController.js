// src/controllers/authController.js

import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";
import bcrypt from "bcryptjs";

// @desc    Register user baru
// @route   POST /api/auth/register
// @access  Private (Admin only)
export const registerUser = async (req, res) => {
  const { name, username, password, role, category, employeeId } = req.body;

  try {
    const userExists = await User.findOne({ username });

    if (userExists) {
      return res.status(400).json({ message: "Username sudah digunakan" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    // const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      username,
      // password: hashedPassword,
      password,
      role,
      category,
      employeeId,
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        username: user.username,
        role: user.role,
        token: generateToken(user._id),
      });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });

    if (user && (await bcrypt.compare(password, user.password))) {
      res.json({
        _id: user._id,
        name: user.name,
        username: user.username,
        role: user.role,
        category: user.category,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: "Username atau password salah" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
