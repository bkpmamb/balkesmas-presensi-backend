import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const portect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // Ambil token dari header "Bearer <token>"
      token = req.headers.authorization.split(" ")[1];

      // Verifikasi token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Ambil data user dari DB (tanpa password) dan masukkan ke req.user
      req.user = await User.findById(decoded.id).select("-password");

      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: "Tidak diizinkan, token gagal" });
    }
  }

  if (!token) {
    res.status(401).json({ message: "Tidak diizinkan, tidak ada token" });
  }
};

export const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ message: "Hanya Admin yang diizinkan" });
  }
};
