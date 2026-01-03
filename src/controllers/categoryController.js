import Category from "../models/Category.js";
import User from "../models/User.js";
import Shift from "../models/Shift.js";

// @desc    Get all categories
// @route   GET /api/admin/categories
// @access  Private/Admin
export const getAllCategories = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const skip = (page - 1) * limit;

    const searchFilter = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { prefix: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const categories = await Category.find(searchFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalCategories = await Category.countDocuments(searchFilter);
    const totalPages = Math.ceil(totalCategories / limit);

    res.status(200).json({
      success: true,
      message: "Daftar kategori berhasil diambil",
      data: categories,
      pagination: {
        totalData: totalCategories,
        totalPages: totalPages,
        currentPage: page,
        limit: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Gagal mengambil daftar kategori",
      error: error.message,
    });
  }
};

// @desc    Get all categories (simple, no pagination - untuk dropdown)
// @route   GET /api/admin/categories/list
// @access  Private/Admin

export const getCategoriesList = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .select("_id name prefix")
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Gagal mengambil daftar kategori",
      error: error.message,
    });
  }
};

// @desc    Get category by ID
// @route   GET /api/admin/categories/:id
// @access  Private/Admin
export const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Kategori tidak ditemukan",
      });
    }

    // Hitung jumlah karyawan & shift di kategori ini
    const employeeCount = await User.countDocuments({ category: category._id });
    const shiftCount = await Shift.countDocuments({ category: category._id });

    res.status(200).json({
      success: true,
      data: {
        ...category.toObject(),
        employeeCount,
        shiftCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Gagal mengambil detail kategori",
      error: error.message,
    });
  }
};

// @desc    Create new category
// @route   POST /api/admin/categories
// @access  Private/Admin
export const createCategory = async (req, res) => {
  try {
    const { name, prefix, description } = req.body;

    // Validasi input
    if (!name || !prefix) {
      return res.status(400).json({
        success: false,
        message: "Nama dan prefix kategori wajib diisi",
      });
    }

    // Cek duplicate name
    const nameExists = await Category.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });
    if (nameExists) {
      return res.status(400).json({
        success: false,
        message: `Kategori dengan nama "${name}" sudah ada`,
      });
    }

    // Cek duplicate prefix
    const prefixExists = await Category.findOne({
      prefix: prefix.toUpperCase(),
    });
    if (prefixExists) {
      return res.status(400).json({
        success: false,
        message: `Prefix "${prefix}" sudah digunakan`,
      });
    }

    // Create category
    const category = await Category.create({
      name: name.trim(),
      prefix: prefix.toUpperCase().trim(),
      description: description?.trim(),
    });

    res.status(201).json({
      success: true,
      message: "Kategori berhasil ditambahkan",
      data: category,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Gagal menambahkan kategori",
      error: error.message,
    });
  }
};

// @desc    Update category
// @route   PUT /api/admin/categories/:id
// @access  Private/Admin
export const updateCategory = async (req, res) => {
  try {
    const { name, prefix, description, isActive } = req.body;

    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Kategori tidak ditemukan",
      });
    }

    // Jika update name, cek duplicate (exclude current category)
    if (name && name !== category.name) {
      const nameExists = await Category.findOne({
        name: { $regex: new RegExp(`^${name}$`, "i") },
        _id: { $ne: req.params.id },
      });
      if (nameExists) {
        return res.status(400).json({
          success: false,
          message: `Kategori dengan nama "${name}" sudah ada`,
        });
      }
      category.name = name.trim();
    }

    // Jika update prefix, cek duplicate (exclude current category)
    if (prefix && prefix.toUpperCase() !== category.prefix) {
      const prefixExists = await Category.findOne({
        prefix: prefix.toUpperCase(),
        _id: { $ne: req.params.id },
      });
      if (prefixExists) {
        return res.status(400).json({
          success: false,
          message: `Prefix "${prefix}" sudah digunakan`,
        });
      }
      category.prefix = prefix.toUpperCase().trim();
    }

    if (description !== undefined) category.description = description?.trim();
    if (isActive !== undefined) category.isActive = isActive;

    await category.save();

    res.status(200).json({
      success: true,
      message: "Kategori berhasil diperbarui",
      data: category,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Gagal memperbarui kategori",
      error: error.message,
    });
  }
};

// @desc    Delete category
// @route   DELETE /api/admin/categories/:id
// @access  Private/Admin
export const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Kategori tidak ditemukan",
      });
    }

    // Cek apakah ada karyawan yang menggunakan kategori ini
    const employeeCount = await User.countDocuments({ category: category._id });
    if (employeeCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Kategori tidak dapat dihapus karena masih digunakan oleh ${employeeCount} karyawan`,
      });
    }

    // Cek apakah ada shift yang menggunakan kategori ini
    const shiftCount = await Shift.countDocuments({ category: category._id });
    if (shiftCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Kategori tidak dapat dihapus karena masih memiliki ${shiftCount} shift`,
      });
    }

    await Category.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: `Kategori "${category.name}" berhasil dihapus`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Gagal menghapus kategori",
      error: error.message,
    });
  }
};

// @desc    Toggle category active status
// @route   PATCH /api/admin/categories/:id/toggle
// @access  Private/Admin
export const toggleCategoryStatus = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Kategori tidak ditemukan",
      });
    }

    category.isActive = !category.isActive;
    await category.save();

    res.status(200).json({
      success: true,
      message: `Kategori "${category.name}" ${
        category.isActive ? "diaktifkan" : "dinonaktifkan"
      }`,
      data: category,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Gagal mengubah status kategori",
      error: error.message,
    });
  }
};
