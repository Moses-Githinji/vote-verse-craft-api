export class LogisticsService {
  /**
   * Calculates the required booths based on voter throughput.
   * Formula: B = ceil((N * T) / D)
   * N = Total Voters
   * T = Time per Voter (default 2.5 mins)
   * D = Election Duration (minutes)
   */
  static calculateRequiredBooths(voters: number, durationMinutes: number, timePerVoter: number = 2.5): number {
    if (voters <= 0 || durationMinutes <= 0) return 0;
    
    // Add a 20% "Chaos Buffer" for orientation and delays
    const bufferedVoters = voters * 1.2;
    const totalVoterMinutes = bufferedVoters * timePerVoter;
    
    return Math.ceil(totalVoterMinutes / durationMinutes);
  }

  /**
   * Returns a stress indicator for a given configuration.
   */
  static getWaitTimeStress(voters: number, booths: number, durationMinutes: number): 'low' | 'moderate' | 'high' | 'critical' {
    if (voters <= 0 || durationMinutes <= 0 || booths <= 0) return 'low';
    
    const capacityPerMinute = booths / 2.5; // booths / timePerVoter
    const totalCapacity = capacityPerMinute * durationMinutes;
    const utilization = voters / totalCapacity;

    if (utilization < 0.7) return 'low';
    if (utilization < 0.9) return 'moderate';
    if (utilization < 1.1) return 'high';
    return 'critical';
  }

  /**
   * Calculates the logistics surcharge based on distance and the number of booths.
   */
  static calculateSurcharge(location: string, booths: number): number {
    if (!location) return 0;

    const baseFee = 5000;
    const perBoothFee = 500;
    
    let distancePremium = 2000;
    const loc = location.toLowerCase();
    if (loc.includes('nairobi')) {
      distancePremium = 1000;
    } else if (loc.includes('mombasa') || loc.includes('kisumu')) {
      distancePremium = 5000;
    }

    return baseFee + (booths * perBoothFee) + distancePremium;
  }

  /**
   * Calculates the total price including software and logistics.
   */
  static calculateTotalPrice(planId: string, voterCount: number, logisticsSurcharge: number, boothsNeeded: number): number {
    let baseSoftwareFee = 0;

    switch (planId) {
      case 'starter':
        baseSoftwareFee = 10000;
        break;
      case 'standard':
        baseSoftwareFee = 25000;
        break;
      case 'premium':
        baseSoftwareFee = 50000;
        break;
      default:
        baseSoftwareFee = 0;
    }

    // Voter load fee: 10 KES per voter after first 100
    const voterBuffer = 200; // Increased buffer for consultative model
    const voterFee = voterCount > voterBuffer ? (voterCount - voterBuffer) * 10 : 0;

    // Resource Premium for high booth counts
    const resourcePremium = boothsNeeded > 10 ? (boothsNeeded - 10) * 2000 : 0;

    return baseSoftwareFee + voterFee + logisticsSurcharge + resourcePremium;
  }

  /**
   * Returns the breakdown of fees for a configuration.
   */
  static getFeeBreakdown(planId: string, voterCount: number, logisticsSurcharge: number, boothsNeeded: number) {
    let baseSoftwareFee = 0;

    switch (planId) {
      case 'starter': baseSoftwareFee = 10000; break;
      case 'standard': baseSoftwareFee = 25000; break;
      case 'premium': baseSoftwareFee = 50000; break;
    }

    const voterBuffer = 200;
    const voterFee = voterCount > voterBuffer ? (voterCount - voterBuffer) * 10 : 0;
    const resourcePremium = boothsNeeded > 10 ? (boothsNeeded - 10) * 2000 : 0;

    return {
      softwareFee: baseSoftwareFee,
      voterFee: voterFee,
      logisticsFee: logisticsSurcharge + resourcePremium,
      total: baseSoftwareFee + voterFee + logisticsSurcharge + resourcePremium
    };
  }
}
