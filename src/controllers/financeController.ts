import { Request, Response } from 'express';
import { Invoice } from '../models/Invoice';
import { Expenditure } from '../models/Expenditure';
import { Organization } from '../models/Organization';


export const getInvoices = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1')));
    const limit = Math.min(50, parseInt(String(req.query.limit || '20')));
    const skip = (page - 1) * limit;

    const validOrgs = await Organization.find().select('_id').lean();
    const validOrgIds = validOrgs.map((o) => o._id);

    const [invoices, total] = await Promise.all([
      Invoice.find({ organizationId: { $in: validOrgIds } })
        .sort({ issuedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('organizationId', 'name email')
        .lean(),
      Invoice.countDocuments({ organizationId: { $in: validOrgIds } }),
    ]);

    res.json({
      success: true,
      data: {
        invoices,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getExpenditures = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1')));
    const limit = Math.min(50, parseInt(String(req.query.limit || '20')));
    const skip = (page - 1) * limit;

    const [expenditures, total] = await Promise.all([
      Expenditure.find()
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .populate('recordedBy', 'name email')
        .lean(),
      Expenditure.countDocuments(),
    ]);

    res.json({
      success: true,
      data: {
        expenditures,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createExpenditure = async (req: Request, res: Response) => {
  try {
    const { description, category, amount, date, notes } = req.body;
    const recordedBy = (req as any).user.id; // From auth middleware
    
    if (!description || !category || !amount) {
      return res.status(400).json({ success: false, message: 'Description, category, and amount are required' });
    }

    const expenditure = await Expenditure.create({
      description,
      category,
      amount,
      date: date || new Date(),
      notes,
      recordedBy
    });

    res.status(201).json({ success: true, data: expenditure });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getFinancialStats = async (req: Request, res: Response) => {
  try {
    const { timeframe } = req.query; // 'weekly', 'monthly', 'yearly'
    
    const validOrgs = await Organization.find().select('_id').lean();
    const validOrgIds = validOrgs.map((o) => o._id);
    
    // Revenue is sum of amountPaid for 'paid' and 'partially_paid' invoices
    const revenueAggr = await Invoice.aggregate([
      { $match: { organizationId: { $in: validOrgIds }, status: { $in: ['paid', 'partially_paid'] } } },
      { $group: { _id: null, total: { $sum: '$amountPaid' } } }
    ]);
    const totalRevenue = revenueAggr[0]?.total || 0;

    // Expenditure is sum of all expenditures
    const expenseAggr = await Expenditure.aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalExpenditure = expenseAggr[0]?.total || 0;

    // Calculate taxes on revenue
    const totalVAT = totalRevenue * 0.16;
    const totalWHT = totalRevenue * 0.05;
    const netIncome = totalRevenue - totalExpenditure - totalVAT - totalWHT;

    // Build chart data depending on timeframe
    let dateFormat = '%Y-%m-%d';
    let sortFormat: any = { _id: 1 };
    
    if (timeframe === 'weekly') {
      // Group by year and week
      dateFormat = '%Y-W%V';
    } else if (timeframe === 'monthly') {
      dateFormat = '%Y-%m';
    } else if (timeframe === 'yearly') {
      dateFormat = '%Y';
    }

    const revenueTimeline = await Invoice.aggregate([
      { $match: { organizationId: { $in: validOrgIds }, status: { $in: ['paid', 'partially_paid'] } } },
      { 
        $group: { 
          _id: { $dateToString: { format: dateFormat, date: '$issuedAt' } }, 
          revenue: { $sum: '$amountPaid' } 
        } 
      },
      { $sort: sortFormat }
    ]);

    const expenseTimeline = await Expenditure.aggregate([
      { 
        $group: { 
          _id: { $dateToString: { format: dateFormat, date: '$date' } }, 
          expenditure: { $sum: '$amount' } 
        } 
      },
      { $sort: sortFormat }
    ]);

    // Merge timelines
    const timelineMap = new Map();
    revenueTimeline.forEach(item => {
      timelineMap.set(item._id, { date: item._id, revenue: item.revenue, expenditure: 0, netIncome: 0 });
    });
    
    expenseTimeline.forEach(item => {
      if (timelineMap.has(item._id)) {
        const existing = timelineMap.get(item._id);
        existing.expenditure = item.expenditure;
      } else {
        timelineMap.set(item._id, { date: item._id, revenue: 0, expenditure: item.expenditure, netIncome: 0 });
      }
    });

    const chartData = Array.from(timelineMap.values()).sort((a: any, b: any) => a.date.localeCompare(b.date));
    
    // Calculate net income for each period
    chartData.forEach(item => {
      const vat = item.revenue * 0.16;
      const wht = item.revenue * 0.05;
      item.netIncome = item.revenue - item.expenditure - vat - wht;
    });

    res.json({
      success: true,
      data: {
        totalRevenue,
        totalExpenditure,
        totalVAT,
        totalWHT,
        netIncome,
        chartData
      }
    });

  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
