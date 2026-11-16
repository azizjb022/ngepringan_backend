const dashboardService = require('../services/dashboardService');

exports.getSummary = async (req, res) => {
  try {
    const data = await dashboardService.getSummaryData();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAnalytics = async (req, res) => {
  try {
    const data = await dashboardService.getAnalyticsData();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
