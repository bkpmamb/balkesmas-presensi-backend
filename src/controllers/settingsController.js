import Settings from "../models/Settings.js";

// @desc    Get current settings (location kantor)
// @route   GET /api/admin/settings
// @access  Private/Admin
export const getSettings = async (req, res) => {
  try {
    const settings = await Settings.getActiveSettings();

    res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Gagal mengambil pengaturan",
      error: error.message,
    });
  }
};

// @desc    Update settings (location kantor)
// @route   PUT /api/admin/settings
// @access  Private/Admin
export const updateSettings = async (req, res) => {
  try {
    const {
      officeName,
      officeAddress,
      targetLatitude,
      targetLongitude,
      radiusMeters,
    } = req.body;

    // Validasi input
    if (targetLatitude !== undefined) {
      if (targetLatitude < -90 || targetLatitude > 90) {
        return res.status(400).json({
          success: false,
          message: "Latitude harus antara -90 dan 90",
        });
      }
    }

    if (targetLongitude !== undefined) {
      if (targetLongitude < -180 || targetLongitude > 180) {
        return res.status(400).json({
          success: false,
          message: "Longitude harus antara -180 dan 180",
        });
      }
    }

    if (radiusMeters !== undefined) {
      if (radiusMeters < 10 || radiusMeters > 5000) {
        return res.status(400).json({
          success: false,
          message: "Radius harus antara 10 dan 5000 meter",
        });
      }
    }

    // Get current settings
    let settings = await Settings.getActiveSettings();

    // Update fields
    if (officeName) settings.officeName = officeName.trim();
    if (officeAddress) settings.officeAddress = officeAddress.trim();
    if (targetLatitude !== undefined) settings.targetLatitude = targetLatitude;
    if (targetLongitude !== undefined)
      settings.targetLongitude = targetLongitude;
    if (radiusMeters !== undefined) settings.radiusMeters = radiusMeters;

    await settings.save();

    res.status(200).json({
      success: true,
      message: "Pengaturan lokasi kantor berhasil diperbarui",
      data: settings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Gagal memperbarui pengaturan",
      error: error.message,
    });
  }
};

// @desc    Test location (cek apakah koordinat dalam radius)
// @route   POST /api/admin/settings/test-location
// @access  Private/Admin
export const testLocation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude dan longitude wajib diisi",
      });
    }

    const settings = await Settings.getActiveSettings();

    // Hitung jarak menggunakan Haversine
    const getDistance = (lat1, lon1, lat2, lon2) => {
      const R = 6371e3; // meter
      const φ1 = (lat1 * Math.PI) / 180;
      const φ2 = (lat2 * Math.PI) / 180;
      const Δφ = ((lat2 - lat1) * Math.PI) / 180;
      const Δλ = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    const distance = getDistance(
      latitude,
      longitude,
      settings.targetLatitude,
      settings.targetLongitude
    );

    const isWithinRange = distance <= settings.radiusMeters;

    res.status(200).json({
      success: true,
      data: {
        testCoordinates: {
          latitude,
          longitude,
        },
        officeCoordinates: {
          latitude: settings.targetLatitude,
          longitude: settings.targetLongitude,
        },
        distance: Math.round(distance),
        radiusLimit: settings.radiusMeters,
        isWithinRange,
        message: isWithinRange
          ? `Lokasi dalam radius (${Math.round(distance)}m dari kantor)`
          : `Lokasi di luar radius (${Math.round(
              distance
            )}m dari kantor, batas ${settings.radiusMeters}m)`,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Gagal melakukan test lokasi",
      error: error.message,
    });
  }
};
