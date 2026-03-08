/**
 * Time Service
 * Handles time tracking data operations with database persistence
 */

const db = require('./database');
const logger = require('./logger');

class TimeService {
  /**
   * Get time data for a user on a specific date
   * @param {string} userId - User ID
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<object>} Time data for the date
   */
  async getByDate(userId, date) {
    const timeData = db.getTimeData(userId);
    return { 
      date, 
      sites: timeData[date] || {} 
    };
  }

  /**
   * Get time data for a date range
   * @param {string} userId - User ID
   * @param {string} startDate - Start date
   * @param {string} endDate - End date
   * @returns {Promise<Array>} Time data for the range
   */
  async getByDateRange(userId, startDate, endDate) {
    const result = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const timeData = db.getTimeData(userId);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const sites = timeData[dateStr];
      if (sites && Object.keys(sites).length > 0) {
        result.push({ date: dateStr, sites });
      }
    }

    return result;
  }

  /**
   * Save time tracking data
   * @param {string} userId - User ID
   * @param {string} date - Date
   * @param {object} sites - Site time data
   * @returns {Promise<object>} Saved data
   */
  async save(userId, date, sites) {
    const timeData = db.getTimeData(userId);
    
    if (!timeData[date]) {
      timeData[date] = {};
    }

    // Merge new data with existing
    for (const [site, minutes] of Object.entries(sites)) {
      timeData[date][site] = (timeData[date][site] || 0) + minutes;
    }

    db.setTimeData(userId, timeData);
    logger.info('Time data saved', { userId, date });

    return { date, sites: timeData[date] };
  }

  /**
   * Get summary statistics
   * @param {string} userId - User ID
   * @param {number} days - Number of days to include
   * @returns {Promise<object>} Summary statistics
   */
  async getSummary(userId, days) {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);

    const dateRange = await this.getByDateRange(
      userId,
      start.toISOString().split('T')[0],
      end.toISOString().split('T')[0]
    );

    // Calculate totals
    let totalMinutes = 0;
    const siteTotals = {};

    for (const dayData of dateRange) {
      for (const [site, minutes] of Object.entries(dayData.sites)) {
        totalMinutes += minutes;
        siteTotals[site] = (siteTotals[site] || 0) + minutes;
      }
    }

    return {
      totalMinutes,
      totalHours: Math.round(totalMinutes / 60 * 10) / 10,
      avgMinutesPerDay: Math.round(totalMinutes / days),
      daysTracked: dateRange.length,
      topSites: Object.entries(siteTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([site, minutes]) => ({ site, minutes }))
    };
  }

  /**
   * Sync time data from extension
   * @param {string} userId - User ID
   * @param {object} clientData - Time data from client (keyed by date)
   * @returns {Promise<object>} Merged time data
   */
  async syncTimeData(userId, clientData) {
    const timeData = db.getTimeData(userId);

    // Merge client data with server data
    for (const [date, sites] of Object.entries(clientData)) {
      if (!timeData[date]) {
        timeData[date] = {};
      }
      
      for (const [site, minutes] of Object.entries(sites)) {
        // Take the max value (client may have more recent data)
        timeData[date][site] = Math.max(
          timeData[date][site] || 0,
          minutes
        );
      }
    }

    db.setTimeData(userId, timeData);
    logger.info('Time data synced', { userId, dates: Object.keys(clientData).length });

    return timeData;
  }

  /**
   * Clear old time data
   * @param {string} userId - User ID
   * @param {number} keepDays - Days to keep
   * @returns {Promise<number>} Number of days cleared
   */
  async clearOldData(userId, keepDays = 90) {
    const timeData = db.getTimeData(userId);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - keepDays);
    const cutoff = cutoffDate.toISOString().split('T')[0];

    let clearedCount = 0;
    
    for (const date of Object.keys(timeData)) {
      if (date < cutoff) {
        delete timeData[date];
        clearedCount++;
      }
    }

    if (clearedCount > 0) {
      db.setTimeData(userId, timeData);
      logger.info('Cleared old time data', { userId, clearedCount });
    }

    return clearedCount;
  }
}

module.exports = TimeService;
