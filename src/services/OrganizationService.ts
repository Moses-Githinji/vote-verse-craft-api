import { Organization } from '../models/Organization';
import { Subscription } from '../models/Subscription';
import { Booking } from '../models/Booking';
import { Election } from '../models/Election';
import { Voter } from '../models/Voter';
import { AuditLog } from '../models/AuditLog';
import { Admin, User } from '../models/User';
import { Invoice } from '../models/Invoice';
import { EShopOrder } from '../models/EShopOrder';
import { PaymentTransaction } from '../models/PaymentTransaction';
import { Candidate } from '../models/Candidate';
import { Vote } from '../models/Vote';
import { logger } from '../utils/logger';

export class OrganizationService {
  /**
   * Performs a cascade delete for one or more organizations.
   * This ensures no orphaned records remain.
   */
  static async cascadeDelete(orgIds: string[]) {
    if (!orgIds || orgIds.length === 0) return;

    logger.info(`[CASCADE_DELETE] Starting for ${orgIds.length} organizations: ${orgIds.join(', ')}`);

    // 1. Elections & Related (Votes, Candidates)
    const elections = await Election.find({ organizationId: { $in: orgIds } }).select('_id');
    const electionIds = elections.map(e => e._id);

    if (electionIds.length > 0) {
      await Promise.all([
        Vote.deleteMany({ electionId: { $in: electionIds } }),
        Candidate.deleteMany({ electionId: { $in: electionIds } }),
        Election.deleteMany({ _id: { $in: electionIds } })
      ]);
    }

    // 2. Direct Organization References
    await Promise.all([
      Voter.deleteMany({ organizationId: { $in: orgIds } }),
      Booking.deleteMany({ organizationId: { $in: orgIds } }),
      Subscription.deleteMany({ organizationId: { $in: orgIds } }),
      AuditLog.deleteMany({ organizationId: { $in: orgIds } }),
      Admin.deleteMany({ organizationId: { $in: orgIds } }),
      User.deleteMany({ organizationId: { $in: orgIds } }),
      Invoice.deleteMany({ organizationId: { $in: orgIds } }),
      EShopOrder.deleteMany({ organizationId: { $in: orgIds } }),
      PaymentTransaction.deleteMany({ organizationId: { $in: orgIds } })
    ]);

    // 3. Finally, delete the Organizations
    const result = await Organization.deleteMany({ _id: { $in: orgIds } });
    
    logger.info(`[CASCADE_DELETE] Finished. Deleted ${result.deletedCount} organizations and all associated data.`);
    return result;
  }
}
