import { Booking } from '../models/Booking';
import { InventoryConfig } from '../models/InventoryConfig';

export class AvailabilityService {
  /**
   * Helper to get start of day (00:00:00.000)
   */
  private static startOfDay(d: Date): Date {
    const res = new Date(d);
    res.setHours(0, 0, 0, 0);
    return res;
  }

  /**
   * Helper to get end of day (23:59:59.999)
   */
  private static endOfDay(d: Date): Date {
    const res = new Date(d);
    res.setHours(23, 59, 59, 999);
    return res;
  }

  /**
   * Helper to add days
   */
  private static addDays(d: Date, days: number): Date {
    const res = new Date(d);
    res.setDate(res.getDate() + days);
    return res;
  }

  /**
   * Checks if a requested number of booths and technicians are available during a date range.
   * Includes buffer days for setup/teardown.
   */
  static async checkAvailability(
    requestedStart: Date,
    requestedEnd: Date,
    boothsNeeded: number,
    staffNeeded: number = 1
  ): Promise<{ 
    available: boolean; 
    reason?: string;
  }> {
    const config = await this.getGlobalConfig();
    
    // Add buffer days to the requested range
    const setupDate = this.startOfDay(this.addDays(requestedStart, -config.bufferDays));
    const teardownDate = this.endOfDay(this.addDays(requestedEnd, config.bufferDays));

    // 1. Fetch all confirmed bookings that overlap with this buffered range
    const overlappingBookings = await Booking.find({
      status: 'confirmed',
      setupDate: { $lte: teardownDate },
      teardownDate: { $gte: setupDate }
    });

    // 2. Iterate through each day in the requested (buffered) range
    let current = new Date(setupDate);
    while (current <= teardownDate) {
      let boothsInUse = 0;
      let staffInUse = 0;

      for (const booking of overlappingBookings) {
        if (current >= booking.setupDate && current <= booking.teardownDate) {
          boothsInUse += booking.boothsRequested;
          staffInUse += booking.staffRequested;
        }
      }

      if (boothsInUse + boothsNeeded > config.totalBooths) {
        return { 
          available: false, 
          reason: `Insufficient booths on ${current.toISOString().split('T')[0]}. Available: ${config.totalBooths - boothsInUse}, Needed: ${boothsNeeded}` 
        };
      }

      if (staffInUse + staffNeeded > config.totalTechnicians) {
        return { 
          available: false, 
          reason: `Insufficient technical staff on ${current.toISOString().split('T')[0]}. Available: ${config.totalTechnicians - staffInUse}, Needed: ${staffNeeded}` 
        };
      }

      current.setDate(current.getDate() + 1);
    }

    return { available: true };
  }

  /**
   * Returns a list of dates that are fully or partially booked such that 
   * the requested capacity cannot be met.
   */
  static async getBlockedDates(
    monthsAhead: number = 3,
    boothsNeeded: number,
    staffNeeded: number = 1
  ): Promise<Date[]> {
    const config = await this.getGlobalConfig();
    const start = this.startOfDay(new Date());
    const end = this.endOfDay(this.addDays(start, monthsAhead * 30));

    const confirmedBookings = await Booking.find({
      status: 'confirmed',
      setupDate: { $lte: end },
      teardownDate: { $gte: start }
    });

    const blockedDates: Date[] = [];
    let current = new Date(start);

    while (current <= end) {
      let boothsInUse = 0;
      let staffInUse = 0;

      for (const booking of confirmedBookings) {
        if (current >= booking.setupDate && current <= booking.teardownDate) {
          boothsInUse += booking.boothsRequested;
          staffInUse += booking.staffRequested;
        }
      }

      if (boothsInUse + boothsNeeded > config.totalBooths || staffInUse + staffNeeded > config.totalTechnicians) {
        blockedDates.push(new Date(current));
      }
      
      current.setDate(current.getDate() + 1);
    }

    return blockedDates;
  }

  private static async getGlobalConfig() {
    let config = await InventoryConfig.findOne();
    if (!config) {
      config = await InventoryConfig.create({
        totalBooths: 20,
        totalTechnicians: 5,
        bufferDays: 1
      });
    }
    return config;
  }
}
